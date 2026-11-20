import { describe, expect, it } from "vitest";
import { EDITIONS } from "@hifth/core";
import { EDITION_COPY } from "../editions";
import startAr from "./ar.json";
import startEn from "./en.json";

// Every word a reader can see: the start-up words and every pack that loads
// later (a folder of its own here; messages-compile.mjs, `packNames`). A pack
// is held to the same rules, found by looking, so a new one cannot slip past.
const PACKS = import.meta.glob<Record<string, string>>("./*/*.json", { eager: true, import: "default" });
const inPacks = (locale: "en" | "ar") =>
  Object.entries(PACKS)
    .filter(([path]) => path.endsWith(`/${locale}.json`))
    .map(([, words]) => words);
const ar: Record<string, string> = Object.assign({}, startAr, ...inPacks("ar"));
const en: Record<string, string> = Object.assign({}, startEn, ...inPacks("en"));

it("finds the account section's words, which load on their own", () => {
  expect(Object.keys(en)).toContain("accountTitle");
  expect(Object.keys(ar)).toContain("accountTitle");
});

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

    // The owner, 2026-10-13: a hafiz should know which mistake to pick, so the
    // app names each by what went wrong (the harakat, the whole word, another
    // verse it went into). "Slip" was the design's word, and it had come to
    // mean two different things on two buttons. The records may still say it.
    it(`${locale}: never call a mistake a slip`, () => {
      const slip = locale === "en" ? /\bslip/i : /التباس|التبست/;
      const offending = Object.entries(catalog as Record<string, string>)
        .filter(([, text]) => slip.test(text))
        .map(([key, text]) => `${key}: ${text}`);
      expect(offending).toEqual([]);
    });

    it(`${locale}: carry none of our own plumbing words`, () => {
      const offending = Object.entries(catalog as Record<string, string>)
        .filter(([, text]) => PLUMBING[locale].test(text))
        .map(([key, text]) => `${key}: ${text}`);
      expect(offending).toEqual([]);
    });

    // The owner, 2026-11-16: a long dash "is a tell that AI was involved". A
    // comma, a colon or a full stop says the same thing.
    it(`${locale}: never use a long dash`, () => {
      const offending = Object.entries(catalog as Record<string, string>)
        .filter(([, text]) => /[–—]/.test(text))
        .map(([key, text]) => `${key}: ${text}`);
      expect(offending).toEqual([]);
    });

    // Walking the store build as Apple's reviewer would, 2026-11-17: three
    // settings opened "A rough build to try". Apple turns down an app that
    // carries temporary content or calls itself a demo (its rules 2.1 and 2.2),
    // and the app is the same build a reader gets. "New." says what is true.
    // The same walk: the tajweed button said "beta" and its key said "in beta".
    // The honest part stays (no hafiz has checked it yet); the word goes.
    it(`${locale}: never call a part of the app a rough build or a beta`, () => {
      const rough = locale === "en" ? /\b(rough build|beta)\b/i : /نسخة أولية|تجريبي/;
      const offending = Object.entries(catalog as Record<string, string>)
        .filter(([, text]) => rough.test(text))
        .map(([key, text]) => `${key}: ${text}`);
      expect(offending).toEqual([]);
    });

    // The reason an edition cannot be opened yet is read in the editions list.
    it(`${locale}: the editions list never uses a long dash`, () => {
      const lines =
        locale === "ar"
          ? EDITIONS.flatMap((e) => [e.label, e.riwayah, e.reason ?? ""])
          : Object.values(EDITION_COPY.en).flatMap((e) => Object.values(e) as string[]);
      expect(lines.filter((text) => /[–—]/.test(text))).toEqual([]);
    });
  }
});
