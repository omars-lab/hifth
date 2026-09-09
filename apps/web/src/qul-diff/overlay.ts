/*
 * The in-app dev toggle: the store's page laid over the print, in the running app.
 *
 * Reached only through `main.tsx`, behind `import.meta.env.VITE_QUL_OVERLAY` — a
 * build-time constant, so in every normal build the branch reads `if (undefined)`
 * and the bundler drops this module whole. `make dev-qul` is the one road in.
 * The words it draws come from a gitignored fixture and a gitignored font file,
 * both served by a dev-server-only route, so there is nothing here for a build
 * to carry even if it wanted to; `gate:bundle-notext` reads dist/ and says so.
 *
 * WHY AN OVERLAY AND NOT A SWAP. The page stage's print is an inline SVG that
 * owns the ayah shapes, the highlighter and the marks. Replacing it would turn
 * those off; laying the store's drawing over it, inside the same host, keeps
 * every one of them working while a developer flips print / store / both, and
 * puts the store's words at the print's exact geometry, since the two share a
 * box and a viewBox. See `storePage.ts` for how the lines are placed.
 *
 * WHY IT WATCHES THE DOM. The stage mounts and evicts page hosts itself, by hand,
 * outside React; a host is stamped `data-page` as it is built. This module is
 * told nothing — it watches for hosts and dresses each one once. Three lines in
 * the app were touched for it: the stamp, the flag, and the env type.
 */
import {
  buildStorePageSvg,
  calibrateFontSize,
  fontReady,
  lineGeometry,
  loadFixture,
  loadWordBoxes,
  parseViewBox,
} from "./storePage";

type Mode = "print" | "store" | "both";
const MODES: Mode[] = ["print", "store", "both"];
const KEY = "hifth:qul-overlay";
const ATTR = "data-qul-mode";
const OVERLAY_CLASS = "qul-overlay";
/** the store's ink over the print — a blue the print never uses */
const BOTH_INK = "#1d4ed8";
/** the store's ink when it stands alone */
const STORE_INK = "#1b1815";

function readMode(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.includes(v as Mode) ? (v as Mode) : "both";
  } catch {
    return "both";
  }
}

function writeMode(m: Mode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* a private window; the pill still works for the visit */
  }
}

const CSS = `
[${ATTR}] .${OVERLAY_CLASS} { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
[${ATTR}="print"] .${OVERLAY_CLASS} { display: none; }
[${ATTR}="both"] .${OVERLAY_CLASS} { opacity: 0.72; }
[${ATTR}="store"] [data-page] > svg[role="group"] { opacity: 0; }
.qul-pill { position: fixed; left: 12px; bottom: 12px; z-index: 9999; display: inline-flex; align-items: center; gap: 2px;
  padding: 3px; border-radius: 999px; background: #1b1815; color: #f4ede0; font: 12px/1 ui-sans-serif, system-ui, sans-serif;
  box-shadow: 0 2px 10px rgba(0,0,0,.25); }
.qul-pill b { padding: 0 8px 0 10px; font-weight: 600; opacity: .7; letter-spacing: .3px; }
.qul-pill button { font: inherit; border: 0; border-radius: 999px; padding: 6px 10px; background: transparent; color: inherit; cursor: pointer; }
.qul-pill button[aria-pressed="true"] { background: ${BOTH_INK}; color: #fff; }
.qul-pill span { padding: 0 10px 0 6px; opacity: .6; max-width: 26ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

/** Dress one page host: fetch its fixture and boxes, draw the store's page inside it. */
async function dress(host: HTMLElement, note: (s: string) => void): Promise<void> {
  const page = Number(host.dataset.page);
  const print = host.querySelector<SVGSVGElement>('svg[role="group"]');
  if (!Number.isFinite(page) || !print) return;
  if (host.querySelector(`.${OVERLAY_CLASS}`)) return;
  host.dataset.qulDressed = "pending";
  try {
    const [fixture, boxes] = await Promise.all([loadFixture(page), loadWordBoxes(page, import.meta.env.BASE_URL)]);
    if (!fixture) {
      host.dataset.qulDressed = "no-fixture";
      note(`page ${page}: no fixture — pull it with qul-page-fixture.mjs --page ${page}`);
      return;
    }
    const viewBox = parseViewBox(print.getAttribute("viewBox"));
    if (!viewBox) return;
    await fontReady(page);
    const geom = lineGeometry(fixture, boxes, viewBox);
    const draw = (fill: string) => buildStorePageSvg(fixture, geom, { page, fill, bands: true, className: OVERLAY_CLASS });
    // Two drawings, one per ink, so a mode flip is CSS and never a rebuild.
    const both = draw(BOTH_INK);
    both.dataset.ink = "both";
    const alone = draw(STORE_INK);
    alone.dataset.ink = "store";
    host.appendChild(both);
    host.appendChild(alone);
    // Measured in the document, face loaded: the one size at which a full line
    // fills the print's column (see `calibrateFontSize`). The `store`-only
    // drawing is display:none in the other modes, so it is measured while briefly
    // shown; the browser does not paint between the two writes.
    for (const s of [both, alone]) {
      const hidden = getComputedStyle(s).display === "none";
      if (hidden) s.style.display = "block";
      calibrateFontSize(s, geom);
      if (hidden) s.style.removeProperty("display");
    }
    host.dataset.qulDressed = "done";
    note(
      geom.rows === geom.ayahLines
        ? `page ${page}: ${geom.ayahLines} lines paired`
        : `page ${page}: ${geom.rows} print rows vs ${geom.ayahLines} store lines — placed by fit`,
    );
  } catch (e) {
    host.dataset.qulDressed = "error";
    note(`page ${page}: ${String(e)}`);
  }
}

/** Mount the pill and start watching for page hosts. Idempotent. */
export function mountQulOverlay(): void {
  if (document.querySelector(".qul-pill")) return;
  const style = document.createElement("style");
  style.id = "qul-overlay-style";
  style.textContent =
    CSS +
    `[${ATTR}="both"] .${OVERLAY_CLASS}[data-ink="store"] { display: none; }` +
    `[${ATTR}="store"] .${OVERLAY_CLASS}[data-ink="both"] { display: none; }`;
  document.head.appendChild(style);

  const root = document.documentElement;
  const apply = (m: Mode) => {
    root.setAttribute(ATTR, m);
    writeMode(m);
    for (const b of pill.querySelectorAll("button")) {
      b.setAttribute("aria-pressed", b.dataset.mode === m ? "true" : "false");
    }
  };

  const pill = document.createElement("div");
  pill.className = "qul-pill";
  pill.setAttribute("role", "group");
  pill.setAttribute("aria-label", "store overlay");
  const title = document.createElement("b");
  title.textContent = "store";
  pill.appendChild(title);
  for (const m of MODES) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.mode = m;
    b.textContent = m;
    b.addEventListener("click", () => apply(m));
    pill.appendChild(b);
  }
  const status = document.createElement("span");
  pill.appendChild(status);
  document.body.appendChild(pill);
  apply(readMode());

  const note = (s: string) => {
    status.textContent = s;
    status.title = s;
  };

  const sweep = () => {
    for (const host of document.querySelectorAll<HTMLElement>("[data-page]:not([data-qul-dressed])")) {
      void dress(host, note);
    }
  };
  const obs = new MutationObserver(sweep);
  obs.observe(document.body, { childList: true, subtree: true });
  sweep();
}
