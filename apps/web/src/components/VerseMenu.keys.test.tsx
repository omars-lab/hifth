import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { VerseMenu, type VerseMenuItem } from "./VerseMenu";

const around = { left: 100, right: 300, top: 300, bottom: 340, width: 200, height: 40, x: 100, y: 300 } as DOMRect;
const lines = (first: string): VerseMenuItem[] => [
  { id: "note", caption: first, onPick: () => {} },
  { id: "listen", caption: "Listen", onPick: () => {} },
  { id: "roots", caption: "Roots", onPick: () => {} },
];
const menu = (items: VerseMenuItem[]) => (
  <VerseMenu name="More for a verse" around={around} items={items} onClose={() => {}} />
);
const item = (name: string) => screen.getByRole("menuitem", { name });

// A menu opened from a verse's number fills in as the verse's note arrives, and
// its top line can change its words when it does. Focus follows the top line
// until the reader moves; once they have pressed a key to walk the menu, a line
// arriving must not pull them back to the top. In Safari's engine the pitch test
// pressed Down, then the book's name arrived, and the keyboard was back on line one.
describe("VerseMenu keys", () => {
  it("starts on the top line, and follows it while the reader has not moved", () => {
    const { rerender } = render(menu(lines("Note")));
    expect(item("Note")).toHaveFocus();
    rerender(menu(lines("Note · a book")));
    expect(item("Note · a book")).toHaveFocus();
  });

  it("keeps the line the reader walked to when the top line changes after", () => {
    const { rerender } = render(menu(lines("Note")));
    fireEvent.keyDown(item("Note"), { key: "ArrowDown" });
    expect(item("Listen")).toHaveFocus();
    rerender(menu(lines("Note · a book")));
    expect(item("Listen")).toHaveFocus();
  });

  // The second half of the same Safari run: a line whose words change was a new
  // button, so the one under the keyboard was thrown away and focus fell to the
  // page until the menu put it back; a key pressed in between went nowhere.
  it("keeps the same button when a line's words change, so focus never drops", () => {
    const { rerender } = render(menu(lines("Note")));
    const before = item("Note");
    rerender(menu(lines("Note · a book")));
    expect(item("Note · a book")).toBe(before);
  });
});

// A line that does something the reader watches happen (saving a surah's
// recitation says how far it has got) leaves the menu open, so the words that
// change are in front of the reader who pressed it. Every other line closes it.
describe("VerseMenu lines that stay open", () => {
  it("closes on a plain line, and stays open on one that says to", () => {
    const closed = vi.fn();
    const picked = vi.fn();
    const items: VerseMenuItem[] = [
      { id: "keep", caption: "Keep", onPick: picked, stay: true },
      { id: "copy", caption: "Copy", onPick: () => {} },
    ];
    render(<VerseMenu name="More for a surah" around={around} items={items} onClose={closed} />);
    fireEvent.click(item("Keep"));
    expect(picked).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();
    fireEvent.click(item("Copy"));
    expect(closed).toHaveBeenCalledTimes(1);
  });
});

// A menu laid out as a row ran off the side of a phone once the surah's menu
// gained a long line: Play, its first line, was past the screen's edge and
// could not be pressed. A row that will not fit the window stands as a column,
// and is measured again when its words change, since a line that counts gets
// longer as it goes.
describe("VerseMenu wider than the window", () => {
  // jsdom lays nothing out, so the row's width is given: the menu's own, while
  // it is a row; the override lives on HTMLElement and is deleted after.
  const rowOf = (width: () => number): (() => void) => {
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return this.getAttribute("role") === "menu" && !this.hasAttribute("data-stacked") ? width() : 0;
      },
    });
    return () => {
      delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    };
  };
  const items = (keep: string): VerseMenuItem[] => [
    { id: "play", caption: "Play", onPick: () => {} },
    { id: "keep", caption: keep, onPick: () => {}, stay: true },
  ];

  it("stays a row while it fits", () => {
    const undo = rowOf(() => window.innerWidth - 40);
    try {
      render(<VerseMenu name="More for a surah" around={around} items={items("Keep")} onClose={() => {}} />);
      expect(screen.getByRole("menu")).not.toHaveAttribute("data-stacked");
    } finally {
      undo();
    }
  });

  it("stands as a column when the row is wider than the window", () => {
    const undo = rowOf(() => window.innerWidth + 200);
    try {
      render(<VerseMenu name="More for a surah" around={around} items={items("Keep")} onClose={() => {}} />);
      expect(screen.getByRole("menu")).toHaveAttribute("data-stacked");
    } finally {
      undo();
    }
  });

  it("stands as a column once a line's words grow past the window", () => {
    let width = window.innerWidth - 40;
    const undo = rowOf(() => width);
    try {
      const { rerender } = render(<VerseMenu name="More for a surah" around={around} items={items("Keep")} onClose={() => {}} />);
      expect(screen.getByRole("menu")).not.toHaveAttribute("data-stacked");
      width = window.innerWidth + 200;
      rerender(<VerseMenu name="More for a surah" around={around} items={items("Saving — 12 of 286 · Stop")} onClose={() => {}} />);
      expect(screen.getByRole("menu")).toHaveAttribute("data-stacked");
    } finally {
      undo();
    }
  });
});
