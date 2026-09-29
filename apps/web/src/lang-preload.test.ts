import { afterEach, describe, expect, it, vi } from "vitest";
import { LANG_STORAGE_KEY, detectLang } from "./lang";
import { preloadScript } from "./lang-preload";
import { LOCALE_IDS } from "./messages/locales.gen";

/*
 * index.html's first script guesses the reader's language so its file can
 * download alongside the app's code. It is a copy of `detectLang` written for a
 * page where none of the app exists yet, so the two are held to the same answer
 * here, case by case. A wrong guess would not show the wrong language (the app
 * decides for itself), but it would quietly cost every such reader a round trip.
 */

const FILES = Object.fromEntries(LOCALE_IDS.map((id) => [id, [`./assets/${id}.js`]]));

/** What the script asked for, as the language whose file it named. */
function guessed(): string | null {
  document.head.querySelectorAll("link[rel='modulepreload']").forEach((l) => l.remove());
  new Function(preloadScript(FILES))();
  const links = [...document.head.querySelectorAll<HTMLLinkElement>("link[rel='modulepreload']")];
  expect(links).toHaveLength(1);
  const first = links[0]?.getAttribute("href") ?? "";
  return /\.\/assets\/(\w+)\.js/.exec(first)?.[1] ?? null;
}

function device(languages: readonly string[]): void {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
  vi.spyOn(navigator, "language", "get").mockReturnValue(languages[0] ?? "");
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("the language guessed before the app loads", () => {
  const cases: Array<[string, () => void]> = [
    ["an English phone", () => device(["en-US"])],
    ["an Arabic phone", () => device(["ar-EG"])],
    ["a phone in a language we do not have", () => device(["fr-FR"])],
    ["a French phone that also reads English", () => device(["fr-FR", "en-GB"])],
    ["no device language at all", () => device([])],
    ["a stored choice over the device", () => (device(["en-US"]), localStorage.setItem(LANG_STORAGE_KEY, "ar"))],
    ["a stored value we do not know", () => (device(["ar"]), localStorage.setItem(LANG_STORAGE_KEY, "xx"))],
    ["a link's ?lang= over a stored choice", () => {
      device(["ar"]);
      localStorage.setItem(LANG_STORAGE_KEY, "ar");
      window.history.replaceState(null, "", "/?lang=en");
    }],
    ["an unknown ?lang=", () => (device(["en-US"]), window.history.replaceState(null, "", "/?lang=zz"))],
  ];

  for (const [name, arrange] of cases) {
    it(`matches the app for ${name}`, () => {
      arrange();
      expect(guessed()).toBe(detectLang());
    });
  }
});
