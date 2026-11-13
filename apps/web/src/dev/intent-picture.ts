/**
 * Which dev-server address shows the "what each commit was for" picture.
 *
 * `make intent` draws that picture into `.intent/picture/index.html`, a folder that ignores
 * itself. Opened as a file:// page it has no place on the local hub, so the dev server
 * (port 7122, `apply: "serve"` in vite.config.ts) hands it over at /intent/. A production
 * build never runs that route. Only the one page answers: every other path, encoded dots
 * included, falls through, so nothing else in the repo can be read through it.
 */
export type IntentPictureRoute = "page" | "add-slash" | null;

export function intentPictureRoute(url: string): IntentPictureRoute {
  const path = url.split("?")[0]?.split("#")[0] ?? "";
  if (path === "/intent") return "add-slash";
  if (path === "/intent/" || path === "/intent/index.html") return "page";
  return null;
}
