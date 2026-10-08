import { describe, it, expect } from "vitest";
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
