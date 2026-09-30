/**
 * The link builder: say what the Mac and iPad app will do with a link, and
 * compose one from a filled-in form.
 *
 * The app's shell (`native/Hifth/Route/`) is the one that actually reads a
 * `hifth://` link; this is a copy of its rules in JavaScript so the contract
 * page can show a person the answer before they send anything. The copy is
 * held to the shell by the examples in `docs/design/app-url-scheme.openapi.json`:
 * the Swift tests run each through the real parser, and `link-builder.test.ts`
 * runs each through this one, so a difference shows up on a named link.
 *
 * This file imports nothing on purpose. The page renderer inlines its compiled
 * form (`packages/core/dist/link-builder.js`) into the contract page, which
 * stays one self-contained file the site can serve as it is.
 */

export interface LinkEdition {
  id: string;
  shipped: boolean;
  reason?: string;
}

/** The names a link may use, as the contract lists them. */
export interface LinkLists {
  editions: LinkEdition[];
  defaultEdition: string;
  tools: string[];
  panels: string[];
  views: string[];
}

export type LinkOutcome =
  | { kind: "open"; hash: string }
  | { kind: "current" }
  | { kind: "refused" }
  | { kind: "error"; code: string; message: string };

/** What a person types into the builder. Empty strings count as not given. */
export interface LinkForm {
  place: "page" | "verse" | "surah" | "route";
  page?: string;
  verse?: string;
  words?: string;
  surah?: string;
  route?: string;
  edition?: string;
  mode?: string;
  open?: string;
  view?: string;
  xSuccess?: string;
  xError?: string;
}

export interface ComposedLinks {
  /** The x-callback-url request, exactly as the form's keys spell it. */
  request: string;
  /** The plain `hifth://` link, when the request would open something. */
  plain: string;
  /** The same place on the public site, when the request would open something. */
  site: string;
  outcome: LinkOutcome;
}

/* ── the lists, read from the contract ─────────────────────────────────── */

interface SpecLike {
  paths?: Record<string, { get?: { parameters?: { name?: string; schema?: Record<string, unknown> }[] } }>;
  components?: { schemas?: { Edition?: { "x-editions"?: LinkEdition[] } } };
}

/** The builder's lists from the OpenAPI file: editions, default, and the three name lists. */
export function listsFromSpec(spec: SpecLike): LinkLists {
  const params = spec.paths?.["/x-callback-url/open"]?.get?.parameters ?? [];
  const schemaOf = (name: string) => params.find((p) => p.name === name)?.schema ?? {};
  const enumOf = (name: string) => (schemaOf(name)["enum"] as string[] | undefined) ?? [];
  const editions = (spec.components?.schemas?.Edition?.["x-editions"] ?? []).map((e) => {
    const out: LinkEdition = { id: e.id, shipped: e.shipped };
    if (e.reason) out.reason = e.reason;
    return out;
  });
  return {
    editions,
    defaultEdition: (schemaOf("edition")["default"] as string | undefined) ?? editions[0]?.id ?? "",
    tools: enumOf("tool"),
    panels: enumOf("open"),
    views: enumOf("view"),
  };
}

/* ── Route: the shape check (mirrors Route.swift) ──────────────────────── */

const SCHEME = "hifth";
const CALLBACK_HOST = "x-callback-url";
const SURAH_COUNT = 114;
const POSITIVE = /^[1-9][0-9]*$/;
const QUERY = /^[A-Za-z0-9\-_.~%:,=&+]*$/;

const isAyahRef = (s: string): boolean => {
  const parts = s.split(":");
  return parts.length === 2 && POSITIVE.test(parts[0] ?? "") && POSITIVE.test(parts[1] ?? "");
};

const isTarget = (s: string): boolean => {
  if (s.startsWith("p")) return POSITIVE.test(s.slice(1));
  const ends = s.split("-");
  if (ends.length < 1 || ends.length > 2 || !isAyahRef(ends[0] ?? "")) return false;
  if (ends.length === 2) return isAyahRef(ends[1] ?? "") || POSITIVE.test(ends[1] ?? "");
  return true;
};

const shippedIds = (lists: LinkLists): string[] => lists.editions.filter((e) => e.shipped).map((e) => e.id);

/** Why this edition cannot open, naming what can; `null` when it is shipped. */
export function editionProblem(id: string, lists: LinkLists): string | null {
  const shipped = "the app ships " + shippedIds(lists).join(", ");
  const edition = lists.editions.find((e) => e.id === id);
  if (!edition) return `no mus'haf named "${id}"; ${shipped}`;
  if (edition.shipped) return null;
  const why = edition.reason ? ` (${edition.reason})` : "";
  return `${id} is not in the app yet${why}; ${shipped}`;
}

const stripHash = (raw: string): string => {
  const route = raw.trim();
  return route.startsWith("#") ? route.slice(1) : route;
};

/** `/hafs-kfqc/2:255?w=3-7` (with or without `#`) → the hash, or `null` when off-grammar. */
export function routeHash(raw: string, lists: LinkLists): string | null {
  const route = stripHash(raw);
  if (!route.startsWith("/") || route.includes("#")) return null;
  const q = route.indexOf("?");
  const path = q < 0 ? route : route.slice(0, q);
  const query = q < 0 ? null : route.slice(q + 1);
  const segments = path.slice(1).split("/");
  if (segments.length !== 2) return null;
  if (!shippedIds(lists).includes(segments[0] ?? "") || !isTarget(segments[1] ?? "")) return null;
  if (query !== null && !QUERY.test(query)) return null;
  return "#" + route;
}

const editionSegment = (raw: string): string | null => {
  const route = stripHash(raw);
  if (!route.startsWith("/")) return null;
  const segment = route.slice(1).split("/", 1)[0] ?? "";
  if (!segment) return null;
  return segment.split("?", 1)[0] ?? null;
};

/* ── a URL, the way Foundation reads one ───────────────────────────────── */

interface Parts {
  scheme: string;
  host: string;
  path: string;
  query: string | null;
  fragment: string | null;
}

const percentDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Splits a `hifth://…` link into its parts by hand: the browser's URL parser
 *  re-encodes and normalises, and a prediction has to see the bytes the OS
 *  hands the shell. */
const parts = (raw: string): Parts | null => {
  const m = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(raw.trim());
  if (!m) return null;
  return {
    scheme: (m[1] ?? "").toLowerCase(),
    host: m[2] ?? "",
    path: m[3] ?? "",
    query: m[4] === undefined ? null : m[4].slice(1),
    fragment: m[5] === undefined ? null : m[5].slice(1),
  };
};

/** The query as Foundation's `queryItems`: split on `&`, then the first `=`,
 *  percent-decoded, `+` kept. The first of a repeated key wins. */
const queryItems = (query: string | null): { query: Map<string, string>; order: string[] } => {
  const out = new Map<string, string>();
  const order: string[] = [];
  if (query) {
    for (const item of query.split("&")) {
      const eq = item.indexOf("=");
      const name = percentDecode(eq < 0 ? item : item.slice(0, eq));
      const value = eq < 0 ? "" : percentDecode(item.slice(eq + 1));
      if (!out.has(name)) {
        out.set(name, value);
        order.push(name);
      }
    }
  }
  return { query: out, order };
};

/** A plain `hifth://` link in any of the shapes people paste (mirrors `Route.parse`). */
function plainRoute(p: Parts, lists: LinkLists): string | null {
  if (p.scheme !== SCHEME) return null;
  if (p.fragment !== null && p.fragment.startsWith("/")) return routeHash(p.fragment, lists);
  let route = p.path;
  if (p.host && p.host !== "open") route = "/" + p.host + route;
  if (p.query) route += "?" + p.query;
  return routeHash(route, lists);
}

/* ── XCallback: an `open` request (mirrors XCallback.route) ────────────── */

const OWN_KEYS = new Set(["route", "page", "verse", "surah", "words", "edition", "mode"]);
const ROUTE_VALUE_ALLOWED = /[A-Za-z0-9\-_.~:,+]/;

const encode = (s: string): string =>
  Array.from(s, (ch) => (ROUTE_VALUE_ALLOWED.test(ch) ? ch : encodeURIComponent(ch))).join("");

const bad = (message: string): LinkOutcome => ({ kind: "error", code: "bad-route", message });

function openRoute(query: Map<string, string>, order: string[], lists: LinkLists): LinkOutcome {
  const given = (key: string): string | null => {
    const v = query.get(key);
    return v ? v : null;
  };
  const raw = given("route");
  if (raw !== null) {
    const id = editionSegment(raw);
    const problem = id === null ? null : editionProblem(id, lists);
    if (problem) return bad(problem);
    const hash = routeHash(raw, lists);
    return hash ? { kind: "open", hash } : bad(`not a route: ${raw}`);
  }
  const page = given("page"), verse = given("verse"), surah = given("surah"), words = given("words");
  if (words !== null && verse === null) return bad("words need a verse: verse=2:255&words=3-7");
  const places = [page, verse, surah].filter((v) => v !== null);
  if (places.length === 0) {
    return {
      kind: "error",
      code: "missing-route",
      message: "open needs a page (page=45), a verse (verse=2:255), a surah (surah=2), or a route (route=/hafs-kfqc/2:255)",
    };
  }
  if (places.length > 1) return bad("give one of page, verse or surah, not two");
  if (given("mode") !== null && given("tool") !== null) return bad("mode and tool are the same thing; give one");
  const named: Record<string, string[]> = { tool: lists.tools, mode: lists.tools, open: lists.panels, view: lists.views };
  for (const key of order) {
    const allowed = named[key];
    if (!allowed) continue;
    const value = query.get(key) ?? "";
    if (!allowed.includes(value)) return bad(`${key}=${value} is not one of ${allowed.join(", ")}`);
  }
  let target: string;
  if (page !== null) {
    target = "p" + page;
  } else if (verse !== null) {
    target = verse;
  } else {
    const n = /^[+-]?\d+$/.test(surah ?? "") ? Number(surah) : NaN;
    if (!(n >= 1 && n <= SURAH_COUNT)) return bad(`surah must be 1 to ${SURAH_COUNT}: surah=${surah ?? ""}`);
    target = `${n}:1`;
  }
  const edition = given("edition") ?? lists.defaultEdition;
  const problem = editionProblem(edition, lists);
  if (problem) return bad(problem);
  let route = "/" + edition + "/" + target;
  const pairs: string[] = [];
  if (words !== null) pairs.push("w=" + encode(words));
  for (const key of order) {
    if ((!OWN_KEYS.has(key) && !key.startsWith("x-")) || key === "mode") {
      const name = key === "mode" ? "tool" : key;
      pairs.push(encode(name) + "=" + encode(query.get(key) ?? ""));
    }
  }
  if (surah !== null && given("open") === null) pairs.push("open=context");
  if (pairs.length) route += "?" + pairs.join("&");
  const hash = routeHash(route, lists);
  return hash ? { kind: "open", hash } : bad(`not a route: ${route}`);
}

/** What the shell does with this link: opens a place, answers with the
 *  current one, refuses it in silence (a plain link that is not a route), or
 *  answers an error with a code and a reason. */
export function predictLink(raw: string, lists: LinkLists): LinkOutcome {
  const p = parts(raw);
  if (!p) return { kind: "refused" };
  if (p.scheme === SCHEME && p.host.toLowerCase() === CALLBACK_HOST) {
    const { query, order } = queryItems(p.query);
    const action = p.path.replace(/^\/+|\/+$/g, "").toLowerCase();
    switch (action) {
      case "open":
        return openRoute(query, order, lists);
      case "current":
        return { kind: "current" };
      default:
        return { kind: "error", code: "unknown-action", message: `no action named "${action}"; try open or current` };
    }
  }
  const hash = plainRoute(p, lists);
  return hash ? { kind: "open", hash } : { kind: "refused" };
}

/** The outcome in the words the contract's examples use. */
export function describeOutcome(outcome: LinkOutcome): string {
  switch (outcome.kind) {
    case "open":
      return "open " + outcome.hash;
    case "current":
      return "current";
    case "refused":
      return "refused";
    case "error":
      return "error " + outcome.code;
  }
}

/* ── composing links from the form ─────────────────────────────────────── */

/** A value in the request's query: only what would break the split on `&` and
 *  `=`, or is not a URL character, is percent-encoded, so the request stays
 *  readable and looks like the examples. */
const encodeRequestValue = (s: string): string =>
  encodeURIComponent(s).replace(/%3A/gi, ":").replace(/%2F/gi, "/").replace(/%2C/gi, ",").replace(/%3F/gi, "?").replace(/%3D/gi, "=");

/** The three links a form makes, and what the app will do with the request. */
export function composeLinks(form: LinkForm, lists: LinkLists, site: string): ComposedLinks {
  const keys: [string, string | undefined][] = [
    [form.place, form[form.place]],
    ["words", form.place === "verse" ? form.words : undefined],
    ["edition", form.edition && form.edition !== lists.defaultEdition ? form.edition : undefined],
    ["mode", form.mode],
    ["open", form.open],
    ["view", form.view],
    ["x-success", form.xSuccess],
    ["x-error", form.xError],
  ];
  const pairs = keys.filter((kv): kv is [string, string] => Boolean(kv[1] && kv[1].trim())).map(
    ([k, v]) => `${k}=${encodeRequestValue(v.trim())}`,
  );
  const request = `hifth://${CALLBACK_HOST}/open` + (pairs.length ? "?" + pairs.join("&") : "");
  const outcome = predictLink(request, lists);
  const route = outcome.kind === "open" ? outcome.hash.slice(1) : "";
  return {
    request,
    plain: route ? `${SCHEME}://` + route : "",
    site: route ? site + "#" + route : "",
    outcome,
  };
}
