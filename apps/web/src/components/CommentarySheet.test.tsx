import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import type { Edge, TafsirSource } from "@hifth/core";
import { LANG_STORAGE_KEY } from "../lang";
import { LangProvider } from "../i18n";
import type { CommentaryNote } from "../tafsir/commentary";
import { CommentarySheet } from "./CommentarySheet";

/*
 * The one commentary drawer, in both of the app's languages and with sources in
 * either script. Two different directions meet in it: its own words (close,
 * the headings, "related verses") follow the app's language, and a source's
 * words follow the source's. Before this, the whole drawer was pinned left to
 * right and spoke only English, which was right only while the one source on
 * screen was The Study Quran and the app was in English.
 */

const source = (lang?: string): TafsirSource => ({
  id: "test",
  label: lang === "ar" ? "تفسير" : "A Commentary",
  license: "test",
  edition: "hafs-kfqc",
  ...(lang ? { lang } : {}),
});

const note = (lang?: string, extra: Partial<CommentaryNote> = {}): CommentaryNote => ({
  source: source(lang),
  ayahKey: "quran/hafs-kfqc/2:2",
  translation: "a translation",
  paragraphs: ["a paragraph"],
  intro: null,
  ...extra,
});

const road: Edge = {
  type: "tafsir-ref",
  to: "quran/hafs-kfqc/2:5",
  page: 2,
  dir: { dSurah: 0, dPage: 0 },
};

function drawer(entry: CommentaryNote, more: { back?: boolean } = {}) {
  render(
    <LangProvider>
      <CommentarySheet
        entry={entry}
        onClose={() => {}}
        roads={[road]}
        onHop={() => {}}
        back={more.back ? { label: "2:1", onBack: () => {} } : null}
      />
    </LangProvider>,
  );
  return screen.getByRole("dialog");
}

describe("the commentary drawer in Arabic", () => {
  beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, "ar"));

  it("says its own words in Arabic, and does not force them left to right", () => {
    const sheet = drawer(note("en", { intro: { title: "Intro", paragraphs: ["p"] } }), { back: true });
    expect(sheet.getAttribute("aria-label")).not.toMatch(/Commentary on/);
    expect(sheet.hasAttribute("dir")).toBe(false);
    for (const english of ["Show all of the note", "Surah introduction", "Commentary", "Related verses"]) {
      expect(screen.queryByLabelText(english), english).toBeNull();
    }
    expect(screen.queryByText(/Back to/)).toBeNull();
    expect(screen.queryByText(/connects this verse/)).toBeNull();
  });

  it("still reads an English source left to right inside it", () => {
    drawer(note("en"));
    const para = screen.getByText("a paragraph").closest("[dir]");
    expect(para?.getAttribute("dir")).toBe("ltr");
    expect(para?.getAttribute("lang")).toBe("en");
  });
});

describe("the commentary drawer in English", () => {
  beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, "en"));

  it("reads an Arabic source right to left", () => {
    drawer(note("ar"));
    for (const words of ["a paragraph", "a translation"]) {
      const block = screen.getByText(words).closest("[dir]");
      expect(block?.getAttribute("dir"), words).toBe("rtl");
      expect(block?.getAttribute("lang"), words).toBe("ar");
    }
    expect(screen.getByRole("heading", { name: "تفسير" }).closest("[dir]")?.getAttribute("dir")).toBe("rtl");
  });

  it("lets the browser judge a source that never said its language", () => {
    drawer(note(undefined));
    const para = screen.getByText("a paragraph").closest("[dir]");
    expect(para?.getAttribute("dir")).toBe("auto");
    expect(para?.hasAttribute("lang")).toBe(false);
  });

  it("keeps its own words in English", () => {
    const sheet = drawer(note("ar"), { back: true });
    expect(sheet.getAttribute("aria-label")).toMatch(/^Commentary on /);
    expect(screen.getByRole("button", { name: "Show all of the note" })).toBeTruthy();
    expect(screen.getByText(/Back to 2:1/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Related verses" })).toBeTruthy();
  });
});
