import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initPwa } from "./pwa";
import "./styles/global.css";
import "./styles/highlight.css";
// Global, not a CSS module: its selectors target elements inside the mushaf SVG
// document, which React never renders (same reason as highlight.css).
import "./styles/tajweed.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <StrictMode>
    <App />
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
