import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QulDiff } from "./QulDiff";

/*
 * Dev-only diff view. See qul-diff.html and QulDiff.tsx. Its own tiny root; it does
 * not boot the app shell, the PWA, or the i18n provider — this is a workbench, not a
 * route a reader ever reaches.
 */
const el = document.getElementById("root");
if (!el) throw new Error("missing #root");
createRoot(el).render(
  <StrictMode>
    <QulDiff />
  </StrictMode>,
);
