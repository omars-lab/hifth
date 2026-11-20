import { describe, expect, it } from "vitest";
import ar from "./messages/ar.gen";
import en from "./messages/en.gen";
import { accountWordsFor, loadAccountWords } from "./account-words";

/*
 * Sign-in ⑳ (docs/design/sign-in.md): only the store apps show the account
 * section, and only once a reader opens the info panel, so its words are not
 * packed with the words every reader downloads when the app opens. They are a
 * pack of their own, fetched when the section is drawn.
 */

describe("the account section's words", () => {
  it.each([
    ["en", en],
    ["ar", ar],
  ] as const)("%s: are not among the words loaded at start-up", (_lang, catalog) => {
    const account = Object.keys(catalog).filter((k) => k.startsWith("account"));
    expect(account).toEqual([]);
  });

  it.each(["en", "ar"] as const)("%s: load on their own, once", async (lang) => {
    const first = await loadAccountWords(lang);
    expect(first.accountTitle.length).toBeGreaterThan(0);
    expect(await loadAccountWords(lang)).toBe(first);
    expect(accountWordsFor(lang)).toBe(first);
  });

  it("say the day a copy was kept in the reader's language", async () => {
    const at = Date.UTC(2026, 10, 18, 12);
    const [enWords, arWords] = await Promise.all([loadAccountWords("en"), loadAccountWords("ar")]);
    expect(enWords.accountCopyKept(at)).toMatch(/2026/);
    expect(arWords.accountCopyKept(at)).toMatch(/٢٠٢٦/);
  });
});
