#!/usr/bin/env node
/**
 * Copies the backlog onto the GitHub project board, one way.
 *
 * The board (github.com/users/omars-lab/projects/2) is a picture of the backlog,
 * not a second record of it. Every open item in docs/issues.json and every check
 * only a person can do (docs/validation/ledger.json) becomes one card. Its column
 * says whose turn it is; its body is the item's own words and a link to where it
 * lives. A card whose item has closed moves to "Done"; nothing is deleted.
 *
 * Moving a card on the board changes nothing here and is undone by the next run:
 * to change an item, change it where it lives, then run this again.
 *
 * Cards are draft items on the board, not GitHub issues, so the repo still has no
 * issue tracker and nothing is copied into one.
 *
 * Usage:
 *   node .claude/skills/issues/scripts/sync-project-board.mjs            # sync
 *   node .claude/skills/issues/scripts/sync-project-board.mjs --dry-run  # say what would change
 *
 * Needs `gh` signed in with the `project` scope.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const lib = (f) => import(pathToFileURL(join(ROOT, "scripts", f)).href);

export const OWNER = "omars-lab";
export const NUMBER = 2;
export const REPO_URL = "https://github.com/omars-lab/hifth/blob/main/docs/";

/** The columns, left to right. Names are what the board shows. */
export const COLUMNS = [
  { name: "Waiting on Omar", color: "PURPLE", description: "Only the owner can move this: a choice, an account step, or a check by hand." },
  { name: "Next up", color: "ORANGE", description: "Marked next in the backlog: the next thing to build." },
  { name: "To do", color: "BLUE", description: "Open, and the agent's to pick up." },
  { name: "Blocked", color: "RED", description: "Waits on another item first." },
  { name: "Done", color: "GREEN", description: "Answered or fixed; kept so the board shows what moved." },
];

export const KINDS = [
  { name: "Defect", color: "RED", description: "Something is wrong." },
  { name: "Question", color: "YELLOW", description: "Something not yet decided or known." },
  { name: "Risk", color: "ORANGE", description: "Something that could go wrong." },
  { name: "Check by hand", color: "PURPLE", description: "Only a person, a phone or a printed mus'haf can check it." },
];

const KIND_OF = { defect: "Defect", question: "Question", risk: "Risk" };

/** Which column an open backlog item belongs in. */
export function columnFor(issue) {
  if (issue.status === "blocked" || (issue.blockedBy ?? []).length) return "Blocked";
  if (issue.owner === "user") return "Waiting on Omar";
  if (issue.next === true) return "Next up";
  return "To do";
}

/** One card's worth of words, from a backlog item and its [title, href]. */
export function cardForIssue(issue, [title, href]) {
  const lines = [];
  if (issue.note) lines.push(issue.note.trim(), "");
  if (issue.text) lines.push(issue.text.trim(), "");
  if ((issue.blockedBy ?? []).length) lines.push(`Waits on: ${issue.blockedBy.join(", ")}`, "");
  lines.push(`Where it lives: ${REPO_URL}${href}`, "", `Backlog id: \`${issue.id}\``);
  return {
    id: issue.id,
    title: title && title !== "?" ? title : issue.id,
    body: lines.join("\n").slice(0, 60000),
    column: columnFor(issue),
    kind: KIND_OF[issue.severity] ?? "Question",
  };
}

/** One card for a check only a person can do. */
export function cardForCheck(check) {
  const lines = [];
  if (check.why) lines.push(check.why.trim(), "");
  if (check.needs.length) lines.push("You need:", ...check.needs.map((n) => `- ${n}`), "");
  if (check.steps.length) lines.push("Steps:", ...check.steps.map((s, k) => `${k + 1}. ${s}`), "");
  lines.push(`Where it lives: ${REPO_URL}validation/ledger.json`, "", `Backlog id: \`${check.id}\``);
  return {
    id: check.id,
    title: check.title,
    body: lines.join("\n").slice(0, 60000),
    column: "Waiting on Omar",
    kind: "Check by hand",
  };
}

/** The backlog id written at the foot of a card's text, if any. */
export function idInBody(body) {
  return /Backlog id: `([^`]+)`\s*$/.exec(body ?? "")?.[1];
}

/**
 * What a run has to do: cards to add, cards to change, cards to move to Done.
 * `existing` is what the board holds now, keyed by backlog id.
 */
export function plan(cards, existing) {
  const want = new Map(cards.map((c) => [c.id, c]));
  const add = [];
  const change = [];
  for (const c of cards) {
    const e = existing.get(c.id);
    if (!e) add.push(c);
    else if (e.title !== c.title || e.body !== c.body || e.column !== c.column || e.kind !== c.kind || e.labelled === false)
      change.push({ ...c, item: e.item, draft: e.draft, textChanged: e.title !== c.title || e.body !== c.body, unlabelled: e.labelled === false });
  }
  const done = [...existing.values()].filter((e) => !want.has(e.id) && e.column !== "Done");
  return { add, change, done };
}

// ---------------------------------------------------------------- GitHub side

// GitHub answers a large batch with 502 now and then, or cuts the reply off
// part-way (gh then says "unexpected end of JSON input"). One wait and a retry
// is usually enough for either. Anything else is a real failure.
export function worthRetrying(stderr) {
  return /HTTP 50[234]|unexpected end of JSON input/.test(String(stderr));
}

function gql(query, vars = {}) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [k, v] of Object.entries(vars)) args.push(typeof v === "number" ? "-F" : "-f", `${k}=${v}`);
  let raw;
  for (let attempt = 1; ; attempt++) {
    try {
      raw = execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] });
      break;
    } catch (e) {
      if (attempt >= 3 || !worthRetrying(`${e.stderr}${e.message}`)) throw e;
      console.log(`ev=retry attempt=${attempt} msg="GitHub server error, trying again"`);
      execFileSync("sleep", [String(5 * attempt)]);
    }
  }
  const out = JSON.parse(raw);
  if (out.errors) throw new Error(JSON.stringify(out.errors));
  return out.data;
}

const q = (s) => JSON.stringify(s);
const opts = (list) => `[${list.map((o) => `{name:${q(o.name)},color:${o.color},description:${q(o.description)}}`).join(",")}]`;

function project() {
  const d = gql(
    `query($o:String!,$n:Int!){user(login:$o){projectV2(number:$n){id fields(first:50){nodes{
      ... on ProjectV2FieldCommon{id name dataType}
      ... on ProjectV2SingleSelectField{options{id name}}}}}}}`,
    { o: OWNER, n: NUMBER },
  );
  return d.user.projectV2;
}

/** Make sure the board has its columns, a Kind field and a Backlog id field. */
function ensureFields(p, dry) {
  const byName = new Map(p.fields.nodes.map((f) => [f.name, f]));
  const same = (f, list) => f?.options?.map((o) => o.name).join("|") === list.map((o) => o.name).join("|");
  const status = byName.get("Status");
  if (!same(status, COLUMNS)) {
    console.log("ev=fields msg=\"setting the board's columns\"");
    if (!dry) gql(`mutation{updateProjectV2Field(input:{fieldId:${q(status.id)},singleSelectOptions:${opts(COLUMNS)}}){clientMutationId}}`);
  }
  const kind = byName.get("Kind");
  if (!kind) {
    console.log("ev=fields msg=\"adding the Kind field\"");
    if (!dry) gql(`mutation{createProjectV2Field(input:{projectId:${q(p.id)},dataType:SINGLE_SELECT,name:"Kind",singleSelectOptions:${opts(KINDS)}}){clientMutationId}}`);
  } else if (!same(kind, KINDS)) {
    if (!dry) gql(`mutation{updateProjectV2Field(input:{fieldId:${q(kind.id)},singleSelectOptions:${opts(KINDS)}}){clientMutationId}}`);
  }
  if (!byName.get("Backlog id")) {
    console.log("ev=fields msg=\"adding the Backlog id field\"");
    if (!dry) gql(`mutation{createProjectV2Field(input:{projectId:${q(p.id)},dataType:TEXT,name:"Backlog id"}){clientMutationId}}`);
  }
  return dry ? p : project();
}

function boardItems(projectId) {
  const items = new Map();
  let after = null;
  for (;;) {
    const d = gql(
      `query($p:ID!${after ? ",$a:String!" : ""}){node(id:$p){... on ProjectV2{items(first:100${after ? ",after:$a" : ""}){
        pageInfo{hasNextPage endCursor}
        nodes{id content{... on DraftIssue{id title body}}
          fieldValues(first:20){nodes{
            ... on ProjectV2ItemFieldTextValue{text field{... on ProjectV2FieldCommon{name}}}
            ... on ProjectV2ItemFieldSingleSelectValue{name field{... on ProjectV2FieldCommon{name}}}}}}}}}}`,
      after ? { p: projectId, a: after } : { p: projectId },
    );
    const page = d.node.items;
    for (const n of page.nodes) {
      const v = Object.fromEntries(
        n.fieldValues.nodes.filter((f) => f.field).map((f) => [f.field.name, f.text ?? f.name]),
      );
      // The field is the key; the id written at the foot of the card's text is the
      // fallback, so a run cut off between adding a card and labelling it finds the
      // card again instead of adding a second one.
      const id = v["Backlog id"] || idInBody(n.content?.body);
      if (!id || !n.content?.id) continue;
      items.set(id, { id, item: n.id, draft: n.content.id, title: n.content.title, body: n.content.body, column: v.Status, kind: v.Kind, labelled: Boolean(v["Backlog id"]) });
    }
    if (!page.pageInfo.hasNextPage) return items;
    after = page.pageInfo.endCursor;
  }
}

/** Run mutations in batches, joined by aliases, so 100 cards are a handful of calls. */
function inBatches(parts, size = 25) {
  const results = [];
  for (let k = 0; k < parts.length; k += size) {
    const chunk = parts.slice(k, k + size);
    const d = gql(`mutation{${chunk.map((m, j) => `m${j}:${m}`).join("\n")}}`);
    chunk.forEach((_, j) => results.push(d[`m${j}`]));
  }
  return results;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const { payload } = await lib("tasks.mjs");
  const { readIssues, linker } = await lib("issues.mjs");
  const { readLedger } = await lib("validation-ledger.mjs");

  const ledgerById = new Map((readLedger().checks ?? []).map((c) => [c.id, c]));
  const link = linker(ledgerById);
  const byId = new Map(readIssues().map((i) => [i.id, i]));
  const p = payload();
  const cards = [
    ...p.issues.map((i) => cardForIssue(i, link(byId.get(i.id) ?? i))),
    ...p.checks.map(cardForCheck),
  ];

  let proj = ensureFields(project(), dry);
  const field = (name) => proj.fields.nodes.find((f) => f.name === name);
  const option = (name, value) => field(name)?.options?.find((o) => o.name === value)?.id;
  const existing = boardItems(proj.id);
  const { add, change, done } = plan(cards, existing);
  console.log(`ev=plan cards=${cards.length} on_board=${existing.size} add=${add.length} change=${change.length} done=${done.length}`);
  if (dry) {
    for (const c of add) console.log(`ev=would_add id=${c.id} column=${q(c.column)}`);
    for (const c of change) console.log(`ev=would_change id=${c.id} column=${q(c.column)}`);
    for (const c of done) console.log(`ev=would_finish id=${c.id}`);
    return;
  }

  const added = inBatches(
    add.map((c) => `addProjectV2DraftIssue(input:{projectId:${q(proj.id)},title:${q(c.title)},body:${q(c.body)}}){projectItem{id}}`),
    10,
  );
  add.forEach((c, k) => (c.item = added[k].projectItem.id));

  const set = (item, name, value) =>
    `updateProjectV2ItemFieldValue(input:{projectId:${q(proj.id)},itemId:${q(item)},fieldId:${q(field(name).id)},value:${value}}){clientMutationId}`;
  const sel = (name, v) => `{singleSelectOptionId:${q(option(name, v))}}`;

  const fields = [];
  for (const c of add) fields.push(set(c.item, "Backlog id", `{text:${q(c.id)}}`), set(c.item, "Status", sel("Status", c.column)), set(c.item, "Kind", sel("Kind", c.kind)));
  for (const c of change) {
    if (c.unlabelled) fields.push(set(c.item, "Backlog id", `{text:${q(c.id)}}`));
    fields.push(set(c.item, "Status", sel("Status", c.column)), set(c.item, "Kind", sel("Kind", c.kind)));
  }
  for (const e of done) fields.push(set(e.item, "Status", sel("Status", "Done")));
  inBatches(fields, 12);
  inBatches(
    change.filter((c) => c.textChanged).map((c) => `updateProjectV2DraftIssue(input:{draftIssueId:${q(c.draft)},title:${q(c.title)},body:${q(c.body)}}){draftIssue{id}}`),
    10,
  );
  console.log(`ev=synced added=${add.length} changed=${change.length} finished=${done.length} board=https://github.com/users/${OWNER}/projects/${NUMBER}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`ev=error msg=${q(String(e.message ?? e).slice(0, 500))}`);
    process.exit(1);
  });
}
