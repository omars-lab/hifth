import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/preact";
import type { Edge, RailChip } from "@hifth/core";
import { HopPopover } from "./HopPopover";
import { PASSAGE_ROWS_KEY } from "../passage-rows";

const edge = (surah: number, ayah: number, extra: Partial<Edge> = {}): Edge => ({
  type: "mutashabih",
  to: `quran/hafs-kfqc/${surah}:${ayah}`,
  page: 7,
  dir: { dSurah: 0, dPage: 0, sameJuz: true },
  ...extra,
});

const chip = (edges: Edge[]): RailChip => ({
  direction: "loop",
  glyph: "≈↻",
  count: edges.length,
  edges,
});

const noop = () => {};

/** Arabic-Indic digits to the Latin ones, so a label reads the same in either locale. */
const latin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));

describe("HopPopover", () => {
  it("renders nothing when no chip is open", () => {
    const { container } = render(
      <HopPopover chip={null} fromKey={null} canHop={() => true} onHop={noop} onClose={noop} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("a vendored target gets the in-app hop button, not an outbound link", () => {
    const onHop = vi.fn();
    render(
      <HopPopover
        chip={chip([edge(2, 3)])}
        fromKey="quran/hafs-kfqc/2:2"
        canHop={() => true}
        onHop={onHop}
        onClose={noop}
      />,
    );
    // The hop control is a button; there is no outbound link.
    expect(screen.getAllByRole("button", { name: /٢:٣|2:3/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("an un-vendored target links out to the outside library with the verse's ordinal, not its text", () => {
    render(
      <HopPopover
        chip={chip([edge(2, 3)])}
        fromKey="quran/hafs-kfqc/2:2"
        canHop={() => false}
        onHop={noop}
        onClose={noop}
      />,
    );
    const link = screen.getByRole("link");
    // 2:3 is the 10th ayah of the mus'haf (surah 1 has 7, 2:1..2:3 = 8,9,10).
    expect(link).toHaveAttribute("href", "https://qul.tarteel.ai/cms/verses/10");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    // Ships a URL, not bytes: no Arabic scripture in the href.
    expect(link.getAttribute("href")).not.toMatch(/[؀-ۿ]/);
  });

  // Some look-alikes match in more than one place, so no particular words are
  // named and there is nothing to lay side by side. Their row offered to open
  // anyway, its arrow turned, and nothing came: it read as broken.
  it("a row opens to a comparison only when the pair names the words they share", () => {
    render(
      <HopPopover
        chip={chip([
          edge(2, 3, { span: { from: [1, 4] }, toSpan: { from: [2, 5] } }),
          edge(2, 4),
        ])}
        fromKey="quran/hafs-kfqc/2:2"
        canHop={() => true}
        onHop={noop}
        onClose={noop}
      />,
    );
    const [withWords, without] = screen
      .getAllByRole("listitem")
      .map((li) => li.querySelector("button")!);
    expect(withWords).toHaveAttribute("aria-expanded", "false");
    expect(without).not.toHaveAttribute("aria-expanded");
    expect(without!.textContent).not.toContain("⌄");
  });

  // The outside look-alike list pairs whole passages: two verses here with two
  // verses there. Every verse of the first passage links to the start of the
  // second, so a row named only by that first verse gave no reason it was
  // listed — no note, nothing to compare. It names the whole passage.
  it("a look-alike that is a whole passage is named as the passage", () => {
    render(
      <HopPopover
        chip={chip([edge(2, 3, { through: "quran/hafs-kfqc/2:5" })])}
        fromKey="quran/hafs-kfqc/2:2"
        canHop={() => true}
        onHop={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole("listitem").textContent).toMatch(/2:3–2:5|٢:٣–٢:٥/);
  });

  // A passage row is measured against the verse inside it that matches best,
  // and the closed row says which, so a reader knows where to look before
  // opening it (lookalike-rows ⑤).
  it("a passage row names the verse inside it that matches best", () => {
    render(
      <HopPopover
        chip={chip([
          edge(2, 3, { through: "quran/hafs-kfqc/2:5", like: { to: "quran/hafs-kfqc/2:4", page: 7 } }),
          edge(2, 9, { through: "quran/hafs-kfqc/2:11" }),
        ])}
        fromKey="quran/hafs-kfqc/2:2"
        canHop={() => true}
        onHop={noop}
        onClose={noop}
      />,
    );
    const [named, first] = screen.getAllByRole("listitem");
    expect(latin(named!.textContent!)).toMatch(/2:4/);
    // Matched best by its first verse, the row already says where to look.
    expect(latin(first!.textContent!)).not.toMatch(/2:9[^–]/);
  });

  // About four hundred pairs share no stretch of words in one place only, so
  // nothing can be marked or compared; the row says which, rather than showing
  // a bare verse name. The outside list's "the next verse tells them apart"
  // mark is said too.
  it("a look-alike with no marked words says why it is there", () => {
    render(
      <HopPopover
        chip={chip([edge(2, 3, { match: "loose" }), edge(2, 4, { match: "repeat", ctx: true }), edge(2, 5)])}
        fromKey="quran/hafs-kfqc/2:2"
        canHop={() => true}
        onHop={noop}
        onClose={noop}
      />,
    );
    const [loose, repeat, plain] = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(loose).toMatch(/not word for word|لا كلمةً بكلمة/);
    expect(repeat).toMatch(/more than once|تتكرر/);
    expect(repeat).toMatch(/next verse|الآية التالية/);
    expect(plain).not.toMatch(/word for word|كلمةً بكلمة|more than once|تتكرر/);
  });

  // Those rows can still be opened to lay the two verses side by side; a row
  // that gives no reason at all has nothing to open.
  it("a look-alike with a reason opens a comparison even with no marked words", () => {
    render(
      <HopPopover
        chip={chip([edge(2, 3, { match: "loose" }), edge(2, 4, { match: "repeat" }), edge(2, 5)])}
        fromKey="quran/hafs-kfqc/2:2"
        canHop={() => true}
        onHop={noop}
        onClose={noop}
      />,
    );
    const opens = screen
      .getAllByRole("listitem")
      .map((li) => li.querySelector("[aria-expanded]") !== null);
    expect(opens).toEqual([true, true, false]);
  });

  // A passage listed beside a verse inside it (item 47): the reader picks, in
  // the info panel, whether both rows show, the verse sits under the passage,
  // or the passage row is left out. Made-up refs.
  it("lays out a passage and a verse inside it the way the reader chose", () => {
    const rows = (way: string) => {
      localStorage.setItem(PASSAGE_ROWS_KEY, way);
      const { unmount } = render(
        <HopPopover
          chip={chip([edge(2, 4), edge(2, 3, { through: "quran/hafs-kfqc/2:5" }), edge(2, 9)])}
          fromKey="quran/hafs-kfqc/2:2"
          canHop={() => true}
          onHop={noop}
          onClose={noop}
        />,
      );
      const seen = screen
        .getAllByRole("listitem")
        .map((li) => `${latin(li.textContent ?? "").match(/2:\d+(–2:\d+)?/)?.[0]}${li.hasAttribute("data-inside") ? " in" : ""}`);
      unmount();
      return seen;
    };
    expect(rows("both")).toEqual(["2:4", "2:3–2:5", "2:9"]);
    expect(rows("group")).toEqual(["2:3–2:5", "2:4 in", "2:9"]);
    expect(rows("drop")).toEqual(["2:4", "2:9"]);
    localStorage.removeItem(PASSAGE_ROWS_KEY);
  });
});
