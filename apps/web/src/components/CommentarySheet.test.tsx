import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import type { Edge, TafsirSource } from "@hifth/core";
import { LANG_STORAGE_KEY } from "../lang";
import { LangProvider } from "../i18n";
import type { CommentaryNote } from "../tafsir/commentary";
import { CommentarySheet, overLeaf } from "./CommentarySheet";

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
    expect(sheet.getAttribute("dir")).toBe("rtl");
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

  it("lays its own words out left to right, though it sits on a right-to-left page", () => {
    // The drawer is drawn inside the mus'haf's right-to-left stage, so without
    // its own direction the credit's last line read ".Shown privately, …" with
    // its full stop in front, and the header and the cards ran right to left.
    const sheet = drawer(note("en"), { back: true });
    expect(sheet.getAttribute("dir")).toBe("ltr");
  });

  it("keeps its own words in English", () => {
    const sheet = drawer(note("ar"), { back: true });
    expect(sheet.getAttribute("aria-label")).toMatch(/^Commentary on /);
    expect(screen.getByRole("button", { name: "Show all of the note" })).toBeTruthy();
    expect(screen.getByText(/Back to 2:1/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Related verses" })).toBeTruthy();
  });
});

describe("where the note lies on a spread", () => {
  // The open book on a 1440 by 900 window: the fold at 694, each page 354 wide.
  const book = { left: 340, right: 1048, top: 133, bottom: 726 };
  const screen = { width: 1440, height: 900 };

  it("covers the right page from the fold, top to foot, and is never narrower than it can be read in", () => {
    expect(overLeaf(book, "right", screen)).toEqual({ left: 698, width: 460, top: 133, height: 593 });
  });

  it("mirrors onto the left page", () => {
    expect(overLeaf(book, "left", screen)).toEqual({ left: 230, width: 460, top: 133, height: 593 });
  });

  it("runs to the page's outer edge when the page is wider than the least width", () => {
    const wide = { left: 160, right: 1280, top: 120, bottom: 860 };
    expect(overLeaf(wide, "right", screen)).toEqual({ left: 724, width: 556, top: 120, height: 740 });
  });

  it("stays inside the window when the book is magnified past it", () => {
    const big = { left: -200, right: 1640, top: -100, bottom: 1300 };
    expect(overLeaf(big, "right", screen)).toEqual({ left: 724, width: 704, top: 12, height: 876 });
    expect(overLeaf(big, "left", screen)).toEqual({ left: 12, width: 704, top: 12, height: 876 });
  });
});
