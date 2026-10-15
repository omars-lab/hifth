import { useEffect, useState } from "react";

/**
 * When a surah's recitation is kept on the device, and where the reader's
 * choice is kept (docs/PLAN.md, item 102).
 *
 *   asked  only when the reader presses "Keep its recitation" in the menu on
 *          the surah's name. The default.
 *   heard  that, and also by itself once every verse of the surah has played to
 *          its end on this device, in one sitting or many, counted from when
 *          this was chosen. A verse stopped before its end does not count.
 *
 * Its own module, free of CSS, like the setting for the next verses of a run.
 */
export type KeepWhen = "asked" | "heard";

/** In settings order. */
export const KEEP_WHENS: readonly KeepWhen[] = ["asked", "heard"];

/** Versioned: a way that later changes what it does gets a new key. */
export const KEEP_WHEN_KEY = "hifth.recitation.keep-when.v1";

function isKeepWhen(value: unknown): value is KeepWhen {
  return value === "asked" || value === "heard";
}

/** The way this device chose, or only when asked when it never chose. */
export function savedKeepWhen(): KeepWhen {
  try {
    const stored = localStorage.getItem(KEEP_WHEN_KEY);
    return isKeepWhen(stored) ? stored : "asked";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "asked";
  }
}

const heard = new Set<(choice: KeepWhen) => void>();

export function rememberKeepWhen(choice: KeepWhen): void {
  try {
    localStorage.setItem(KEEP_WHEN_KEY, choice);
  } catch {
    /* nothing to do — see savedKeepWhen */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useKeepWhen(): KeepWhen {
  const [choice, setChoice] = useState<KeepWhen>(savedKeepWhen);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
