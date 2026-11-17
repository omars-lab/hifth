#!/usr/bin/env node
// What readers write about Hifth in the App Store, and our answers to it (launch item 32).
//
//   pull                 fetch every review and any answer, into .store/reviews/ (git ignores it)
//   waiting              the reviews with no answer yet, and whether one is drafted
//   draft <id> --file F  save F's words as the drafted answer to review <id>
//   approve <id>         mark that draft as the owner's yes (only after the owner says yes in chat)
//   post <id>            send the approved draft to the store
//
// Reviewers' names and words stay in that folder: they never go into the repo, and no command
// here prints them. Claude reads the folder's files to draft. The key is the hifth-reviews one
// (ASC_REVIEWS_KEY_ID), loaded by the make target; nothing prints it or the ids.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appId, client, credentials } from "../../../../scripts/lib/app-store-connect.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
export const DATA_DIR = join(REPO, ".store", "reviews");
/** Apple's limit on one answer. */
export const MAX_ANSWER = 5970;

const sha = (text) => createHash("sha256").update(text).digest("hex");
const day = (now) => new Date(now).toISOString().slice(0, 10);

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

/** Apple's list of reviews, with their answers included, made into one plain record each. */
export function toReviews({ data, included }) {
  const answers = new Map(
    included.filter((x) => x.type === "customerReviewResponses").map((x) => [x.id, x.attributes ?? {}]),
  );
  return data
    .filter((r) => r?.type === "customerReviews")
    .map((r) => {
      const a = r.attributes ?? {};
      const answerId = r.relationships?.response?.data?.id;
      const answer = answerId ? answers.get(answerId) : undefined;
      return {
        id: r.id,
        stars: a.rating,
        title: a.title ?? "",
        body: a.body ?? "",
        reviewer: a.reviewerNickname ?? "",
        date: a.createdDate ?? "",
        territory: a.territory ?? "",
        answer: answer ? { body: answer.responseBody ?? "", state: answer.state ?? "", date: answer.lastModifiedDate ?? "" } : null,
      };
    })
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
}

/** The lines `pull` prints: counts only, never a reviewer's name or words. */
export function pullSummary(reviews, before) {
  const known = new Set(before.map((r) => r.id));
  const fresh = reviews.filter((r) => !known.has(r.id)).length;
  const open = reviews.filter((r) => !r.answer).length;
  const stars = [5, 4, 3, 2, 1].map((n) => `${n}: ${reviews.filter((r) => r.stars === n).length}`).join(", ");
  return [
    `${reviews.length} reviews in the store, ${fresh} new since the last pull, ${open} with no answer`,
    `by stars: ${stars}`,
  ];
}

export async function run(argv, { env = process.env, dir = DATA_DIR, now = Date.now(), fetch, readKey, out = console.log } = {}) {
  const [command, id, ...rest] = argv;
  const reviewsFile = join(dir, "reviews.json");
  const answersFile = join(dir, "answers.json");
  const reviews = () => readJson(reviewsFile, []);
  const answers = readJson(answersFile, {});
  const api = () => client(credentials(env, { idName: "ASC_REVIEWS_KEY_ID", readKey }), { fetch });
  const known = (reviewId) => {
    const review = reviews().find((r) => r.id === reviewId);
    if (!review) throw new Error(`no review ${reviewId} in the last pull; run pull first`);
    return review;
  };

  switch (command) {
    case "pull": {
      const store = api();
      const app = await appId(store);
      const list = await store.get(
        `/v1/apps/${app}/customerReviews?sort=-createdDate&limit=200&include=response`,
      );
      const now_ = toReviews(list);
      const lines = pullSummary(now_, reviews());
      writeJson(reviewsFile, now_);
      for (const line of lines) out(line);
      return 0;
    }
    case "waiting": {
      const open = reviews().filter((r) => !r.answer);
      if (!open.length) out("every review has an answer");
      for (const r of open) {
        const a = answers[r.id];
        const state = !a ? "no draft" : a.posted ? "sent, waiting for Apple" : a.approved ? "approved, not sent" : "drafted, waiting for the owner's yes";
        out(`${r.id}  ${r.stars} stars  ${r.date.slice(0, 10)}  ${r.territory}  ${state}`);
      }
      return 0;
    }
    case "draft": {
      known(id);
      const fileAt = rest.indexOf("--file");
      if (fileAt < 0 || !rest[fileAt + 1]) throw new Error("draft needs --file <path> holding the answer's words");
      const body = readFileSync(rest[fileAt + 1], "utf8").trim();
      if (!body) throw new Error("the answer is empty");
      if (body.length > MAX_ANSWER) throw new Error(`the answer is ${body.length} characters; Apple takes at most ${MAX_ANSWER}`);
      // A changed draft needs a new yes.
      answers[id] = { body, drafted: day(now), approved: null, posted: null };
      writeJson(answersFile, answers);
      out(`drafted an answer to ${id} (${body.length} characters); it waits for the owner's yes`);
      return 0;
    }
    case "approve": {
      known(id);
      const a = answers[id];
      if (!a) throw new Error(`no drafted answer to ${id}`);
      a.approved = { date: day(now), sha: sha(a.body) };
      writeJson(answersFile, answers);
      out(`the answer to ${id} is approved; post sends it`);
      return 0;
    }
    case "post": {
      const review = known(id);
      const a = answers[id];
      if (!a) throw new Error(`no drafted answer to ${id}`);
      if (!a.approved) throw new Error(`the answer to ${id} has no yes from the owner; approve it only after they say yes`);
      if (a.approved.sha !== sha(a.body)) throw new Error(`the answer to ${id} changed after the owner's yes; ask again`);
      if (a.posted) throw new Error(`the answer to ${id} was already sent on ${a.posted.date}`);
      if (review.answer) throw new Error(`review ${id} already has an answer in the store`);
      await api().post("/v1/customerReviewResponses", {
        data: {
          type: "customerReviewResponses",
          attributes: { responseBody: a.body },
          relationships: { review: { data: { type: "customerReviews", id } } },
        },
      });
      a.posted = { date: day(now) };
      writeJson(answersFile, answers);
      out(`sent the answer to ${id}; Apple shows it once it has looked at it`);
      return 0;
    }
    default:
      out("usage: store-reviews.mjs pull | waiting | draft <id> --file <path> | approve <id> | post <id>");
      return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`store-reviews: ${err.message}`);
      process.exit(1);
    },
  );
}
