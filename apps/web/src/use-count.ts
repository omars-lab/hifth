/**
 * The two ways the app says a feature was used (docs/design/feature-usage.md).
 * Each counts the moment something opens or changes, never while it stays open,
 * so a list left up all afternoon is one use, not a thousand.
 */

import { useEffect, useRef } from "react";
import type { UseFeature } from "./usage";
import { countUse } from "./usage-store";

/** One use each time `feature` turns on, or changes to another feature. */
export function useCountUse(feature: UseFeature | null): void {
  const last = useRef<UseFeature | null>(null);
  useEffect(() => {
    if (feature !== null && feature !== last.current) void countUse(feature);
    last.current = feature;
  }, [feature]);
}

/*
 * Whether the reader has pressed, tapped or typed anything yet. The page the app
 * opens on arrives a moment after it starts, when the address is read; that is
 * where the reader already was, not a page they turned to, and counting it made
 * every visit one turn too many.
 */
let touched = false;
if (typeof window !== "undefined") {
  const mark = () => {
    touched = true;
    window.removeEventListener("pointerdown", mark, true);
    window.removeEventListener("keydown", mark, true);
  };
  window.addEventListener("pointerdown", mark, true);
  window.addEventListener("keydown", mark, true);
}

/**
 * One use of `feature` each time `value` changes, once the reader has touched the
 * app. Before that, a change is the app arriving where it was asked to open.
 */
export function useCountChange(feature: UseFeature, value: unknown): void {
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current && touched) void countUse(feature);
    last.current = value;
  }, [feature, value]);
}
