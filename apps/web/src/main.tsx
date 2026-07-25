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
