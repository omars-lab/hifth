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

function drawer(
  entry: CommentaryNote,
  more: { back?: boolean; side?: "left" | "right"; roads?: Edge[] } = {},
) {
  render(
    <LangProvider>
      <CommentarySheet
        entry={entry}
        onClose={() => {}}
        roads={more.roads ?? [road]}
        onHop={() => {}}
        back={more.back ? { label: "2:1", onBack: () => {} } : null}
        side={more.side ?? null}
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

  it("on a facing page it starts at its title, with no bar to drag", () => {
    // The phone sheet's grab bar was drawn there too, though nothing on a
    // facing page drags or grows: it promised a handle that did nothing.
    const sheet = drawer(note("en"), { side: "left" });
    // The title row is held at the top in its own band; nothing comes before it there.
    expect(sheet.firstElementChild?.firstElementChild?.tagName).toBe("HEADER");
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

describe("a range the note cites, in the related verses", () => {
  beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, "en"));

  // A note citing "vv. 30–34" used to give one card per verse, and the list's few
  // places filled before the note's other references were reached.
  it("is one card that names the whole range, and hops to its first verse", () => {
    const range: Edge = { ...road, to: "quran/hafs-kfqc/2:30", through: "quran/hafs-kfqc/2:34" };
    drawer(note("en"), { roads: [range, road] });
    expect(screen.getByRole("button", { name: /2:30–2:34/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /2:5\b/ })).toBeTruthy();
  });
});

describe("words the book sets in italics", () => {
  beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, "en"));

  // The extractor wraps each slanted run in a pair of private-use marks.
  const slant = (s: string) => `${s}`;

  it("draws a marked run in italics, and the marks themselves not at all", () => {
    const body = drawer(note(undefined, { paragraphs: [`The word ${slant("qarya")} means a town.`] }));
    const em = body.querySelectorAll("em");
    expect([...em].map((e) => e.textContent)).toEqual(["qarya"]);
    expect(body.textContent).toContain("The word qarya means a town.");
    expect(body.textContent).not.toMatch(/[]/);
  });

  it("keeps a run that touches a cited verse in italics, and the verse a link", () => {
    const body = drawer(note(undefined, { paragraphs: [`As in ${slant("the well")} (3:7).`] }));
    expect([...body.querySelectorAll("em")].map((e) => e.textContent)).toEqual(["the well"]);
    expect(screen.getByRole("button", { name: /3:7/ })).toBeTruthy();
    expect(body.textContent).toContain("As in the well (3:7).");
  });

  it("lets a long slanted run wrap like any other words", () => {
    const body = drawer(note(undefined, { paragraphs: [`See ${slant("the long road past the old mill")}, then go on.`] }));
    const em = body.querySelector("em")!;
    expect(em.textContent).toBe("the long road past the old mill");
    expect(em.closest("[class*=together]")).toBeNull();
  });
});
