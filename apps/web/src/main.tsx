import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyFieldToDocument, fieldFromHash } from "./field";
import { LangProvider } from "./i18n";
import { applyLangToDocument, detectLang } from "./lang";
import { initPwa } from "./pwa";
import "./styles/global.css";
// Global for the same reason: it dresses `:root`, which React does not render.
import "./styles/field.css";
import "./styles/highlight.css";
// Global, not a CSS module: its selectors target elements inside the mushaf SVG
// document, which React never renders (same reason as highlight.css).
import "./styles/tajweed.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

/*
 * The document's language, before the first paint.
 *
 * `index.html` ships `lang="ar" dir="rtl"`, which is right for the default and
 * wrong for a reader whose phone is in English — and doing this inside a React
 * effect would flip the whole document one frame after it is on screen. So it
 * happens here, synchronously, and the provider below only has to keep it true.
 */
applyLangToDocument(detectLang());

// The desk, for the same reason and one frame earlier than React could manage:
// a link that opens on a dark field must not flash a light one first. `App`
// takes ownership from here and keeps it true across hash changes.
applyFieldToDocument(fieldFromHash(window.location.hash));

createRoot(root).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
);

initPwa();

/*
 * The on-device perf probe (`make phone-perf`), and nothing else, mounts here.
 *
 * `import.meta.env.VITE_PERF_PROBE` is substituted at build time, so in every
 * normal build this reads `if (undefined)` and Rollup drops both the branch and
 * the dynamic import behind it — the probe's bytes never enter the bundle, and
 * `gate:budget` confirms it. Build-time is the point: a URL parameter would let
 * anyone with a share link turn a measurement slab on over someone's mushaf.
 */
if (import.meta.env.VITE_PERF_PROBE) {
  void import("./perf/probe").then((m) => m.mountPerfProbe());
}
