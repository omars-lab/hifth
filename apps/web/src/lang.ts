/**
 * Which language the chrome speaks, and which way it runs.
 *
 * Its own module, free of React and CSS, for the same reason `coach.ts` is: the
 * e2e tier seeds and reads this key, and a retyped string literal in a spec is a
 * silent drift waiting for the day the key is versioned. It is also imported by
 * `main.tsx` *before* React mounts, so the document's `lang`/`dir` are right on
 * the first paint rather than one frame late.
 *
 * ## What is chrome, and what is not
 *
 * The UI language moves the chrome and nothing else: sheet headers, buttons,
 * hints, announcements, jumper rows. It never moves
 *
 *   - the mus'haf itself, which is an image of a printed page;
 *   - verse text in the hop diff (`DiffView` pins `lang="ar" dir="rtl"`);
 *   - the licence credits in the colophon, which `gate:license-copy` binds
 *     verbatim to SOURCES.md — translating attribution would break the gate,
 *     and it should, because attribution is a legal string and not copy;
 *   - the direction anything about *scripture* is navigated in. Arrow-key
 *     paging, the hop rail, and the trail keep the mus'haf's right-to-left
 *     convention in both languages (Loop 1's record). A hafiz turning pages the
 *     wrong way round because their phone is set to English would be the app
 *     forgetting what it is.
 *
 * So `dir` here is the *chrome's* direction. The stage sets its own.
 */

/** The UI languages Hifth speaks. Arabic is the app's native tongue. */
export type Lang = "ar" | "en";

/** Versioned, like the coach key: a future third language is a new decision. */
export const LANG_STORAGE_KEY = "hifth.lang.v1";

/** Writing direction of the *chrome* for a language. */
export function dirOf(lang: Lang): "rtl" | "ltr" {
  return lang === "en" ? "ltr" : "rtl";
}

/** Whether a stored/queried value is a language we actually have. */
export function isLang(value: unknown): value is Lang {
  return value === "ar" || value === "en";
}

/**
 * The language to open in.
 *
 * A stored choice wins outright — it is the only signal that is a *decision*.
 * Failing that, the device's own language decides, so a reader whose phone is
 * in English is not asked to find a control they cannot read in order to read
 * the controls. Anything else (including a device set to a third language) gets
 * Arabic, because that is what this app is.
 */
export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Safari private mode throws on localStorage; fall through to the device.
  }
  const tags = typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of tags) {
    // Primary subtag only: "ar-EG" is Arabic, "en-GB" is English, and a
    // region we have never heard of must not change the answer.
    const primary = String(tag ?? "").toLowerCase().split("-")[0];
    if (primary === "ar") return "ar";
    if (primary === "en") return "en";
  }
  return "ar";
}

/** Remember the reader's choice. Silent when storage refuses (private mode). */
export function rememberLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* nothing to do — the session still switches, it just will not persist */
  }
}

/**
 * Put the language on the document.
 *
 * `lang` is the load-bearing half: it tells a screen reader which voice to read
 * the chrome in, and getting it wrong makes English announcements come out as
 * Arabic phonemes. `dir` follows it for the chrome; the stage and the diff pin
 * their own.
 */
export function applyLangToDocument(lang: Lang): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = dirOf(lang);
}
