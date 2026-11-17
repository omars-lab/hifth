/**
 * The file on hifth.app that tells Apple which links open the iPad and iPhone app (launch item 9;
 * the owner said yes on 2026-11-17).
 *
 * Apple fetches /.well-known/apple-app-site-association from the site, through its own servers,
 * and hands a matching link to the app instead of Safari. The file names the app by the team's
 * id and the app's own id. The team's id is read at release time from this laptop's signing setup
 * (native/scripts/signing-team.sh), so it is never written into the repo, and nothing here ever
 * prints it: a problem says what is wrong, never what the id is.
 *
 * The addresses it claims are exactly the ones the app takes (Route.swift: the reader's paths, and
 * a link naming a mus'haf the app ships). A test holds the two lists together.
 */
import { TEAM_ID as TEAM, signingTeam } from "../../../../scripts/lib/signing-team.mjs";

/** Where the file sits in the release folder, and so on the site. */
export const APP_LINKS_FILE = ".well-known/apple-app-site-association";
/** The app's own id, the same in every build. */
export const APP_ID = "com.bytesofpurpose.hifth";
/** The reader's addresses on hifth.app (Route.readerPaths). */
export const READER_PATHS = ["/read", "/read/", "/read/index.html"];
/** The mus'hafs a link may name today (Route.editions, the shipped ones). */
export const SHIPPED_EDITIONS = ["hafs-kfqc"];

/** The one place pattern for a mus'haf: its id, a slash, and at least one more character. */
const placePattern = (edition) => `/${edition}/?*`;

/** The file's text for this team. Throws, without repeating it, when the id is not one. */
export function appSiteAssociation(team) {
  if (typeof team !== "string" || !TEAM.test(team)) {
    throw new Error("the signing team id is not ten capital letters and digits");
  }
  const components = READER_PATHS.flatMap((path) =>
    SHIPPED_EDITIONS.map((edition) => ({ "/": path, "#": placePattern(edition) })),
  );
  return `${JSON.stringify({ applinks: { details: [{ appIDs: [`${team}.${APP_ID}`], components }] } }, null, 2)}\n`;
}

const sameKeys = (object, keys) =>
  object && typeof object === "object" && !Array.isArray(object) &&
  JSON.stringify(Object.keys(object).sort()) === JSON.stringify([...keys].sort());

/**
 * What is wrong with the file's text, in plain words, or an empty list. `null` (a file that is
 * missing, or that was read as a picture) is a problem, never a pass. No message names the id.
 */
export function appLinksProblems(text) {
  if (typeof text !== "string") return ["the file that tells Apple which links open the app is missing or unreadable"];
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    return ["the file that tells Apple which links open the app is not JSON"];
  }
  if (!sameKeys(file, ["applinks"])) return ["the file must say only which links open the app, nothing else"];
  if (!sameKeys(file.applinks, ["details"]) || !Array.isArray(file.applinks.details)) {
    return ["the file's link list must be a single list of apps"];
  }
  if (file.applinks.details.length !== 1) return ["the file must name exactly one app"];
  const [detail] = file.applinks.details;
  if (!sameKeys(detail, ["appIDs", "components"])) {
    return ["the file's entry must name the app and its addresses, and nothing else"];
  }
  const problems = [];
  const ids = detail.appIDs;
  const idOk = Array.isArray(ids) && ids.length === 1 && typeof ids[0] === "string" &&
    ids[0].endsWith(`.${APP_ID}`) && TEAM.test(ids[0].slice(0, -APP_ID.length - 1));
  if (!idOk) problems.push("the file must name only the Hifth app, under a ten-character team id");
  const allowedPlaces = new Set(SHIPPED_EDITIONS.map(placePattern));
  const components = Array.isArray(detail.components) ? detail.components : [];
  if (components.length === 0) problems.push("the file names no addresses");
  for (const component of components) {
    const ok = sameKeys(component, ["/", "#"]) && READER_PATHS.includes(component["/"]) && allowedPlaces.has(component["#"]);
    if (!ok) {
      problems.push("the file claims an address the app does not take; only the reader with a mus'haf place named may open the app");
      break;
    }
  }
  return problems;
}

/** The team id this laptop signs with, or `null`; shared with the store build check. */
export { signingTeam };
