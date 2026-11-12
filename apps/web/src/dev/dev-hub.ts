/**
 * Which dev-server address shows the features page (docs/design/feature-links.md).
 *
 * `make feature-links` writes the page and its pictures into `.dev-hub/`, a folder git
 * ignores. The dev server (port 7122, `apply: "serve"` in vite.config.ts) hands them over
 * at /dev-hub/, so the page opens from the local hub, and its relative links reach the app
 * on the same server. A production build never runs this route. It answers the page and
 * pictures named in lower-case words only: every other path, dots and encoded dots
 * included, falls through, so nothing else in the repo can be read through it.
 */
export type DevHubRoute = { kind: "file"; file: string } | { kind: "add-slash" } | null;

export function devHubRoute(url: string): DevHubRoute {
  const path = url.split("?")[0]?.split("#")[0] ?? "";
  if (path === "/dev-hub") return { kind: "add-slash" };
  if (path === "/dev-hub/" || path === "/dev-hub/index.html") return { kind: "file", file: "index.html" };
  const shot = /^\/dev-hub\/shots\/([a-z0-9]+(?:-[a-z0-9]+)*)\.png$/.exec(path);
  if (shot) return { kind: "file", file: `shots/${shot[1]}.png` };
  return null;
}
