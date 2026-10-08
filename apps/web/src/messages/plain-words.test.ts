import { describe, expect, it } from "vitest";
import ar from "./ar.json";
import en from "./en.json";

// Every string here is something a reader sees. Our own words for our own
// plumbing do not belong in it: a hafiz should never need to know what a
// "concordance table" or "letter ids" are to read a sentence on the screen.
// Found walking the pitch in the iPad app (2026-10-08): the tajweed key and the
// editions list each explained themselves in build-pipeline words.
const PLUMBING: Record<"en" | "ar", RegExp> = {
  en: /\b(concordance|salient|vendored|letter ids?|shards?|polygons?|corpus|corpora|manifest|in this build|data pack)\b/i,
  ar: /جدول (ال)?مقابلة|معرّفات|حزمة/,
};

describe("the words a reader sees", () => {
  for (const [locale, catalog] of [
    ["en", en],
    ["ar", ar],
  ] as const) {
    // The same words are read on a phone, an iPad and a Mac.
    it(`${locale}: never tell the reader they are holding a phone`, () => {
      const phone = locale === "en" ? /\bthis phone\b/i : /هذا الهاتف/;
      const offending = Object.entries(catalog as Record<string, string>)
        .filter(([, text]) => phone.test(text))
        .map(([key, text]) => `${key}: ${text}`);
      expect(offending).toEqual([]);
    });

    it(`${locale}: carry none of our own plumbing words`, () => {
      const offending = Object.entries(catalog as Record<string, string>)
        .filter(([, text]) => PLUMBING[locale].test(text))
        .map(([key, text]) => `${key}: ${text}`);
      expect(offending).toEqual([]);
    });
  }
});
