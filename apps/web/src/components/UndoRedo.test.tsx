import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/preact";
import { FullScreenContext, MarkUndoContext, UndoRedo, type MarkUndo } from "./UndoRedo";

const marks: MarkUndo = {
  canUndo: false,
  canRedo: false,
  onUndo: () => {},
  onRedo: () => {},
  erasing: false,
  onErase: () => {},
};

/**
 * On a desktop, full screen is an icon at the end of the tool bar, beside undo
 * and redo, not a word in the bottom line (owner's page comment of 2026-11-07,
 * "full screen button should also be moved to this bar and it should be turned
 * into icon"). App switches it on only where it wants it.
 */
describe("the full-screen button in the tool bar", () => {
  it("is there, as an icon with a name, when App offers full screen", () => {
    const goFull = vi.fn();
    const { container } = render(
      <MarkUndoContext.Provider value={marks}>
        <FullScreenContext.Provider value={{ full: false, toggle: goFull }}>
          <UndoRedo />
        </FullScreenContext.Provider>
      </MarkUndoContext.Provider>,
    );
    // Found by its key, F, since the tests run in the app's first language.
    const button = container.querySelector<HTMLButtonElement>('button[aria-keyshortcuts="F"]')!;
    expect(button, "no full-screen button").not.toBeNull();
    expect(button.getAttribute("aria-label"), "the icon has no name to be read out").toBeTruthy();
    expect(button.textContent, "it is a word, not an icon").toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
    fireEvent.click(button);
    expect(goFull).toHaveBeenCalledOnce();
  });

  // Full screen keeping the tools (full-screen-tools.ts): the same button is
  // then the way back, and says so.
  it("in full screen, is named for leaving it, and leaves", () => {
    const toggle = vi.fn();
    const named = (full: boolean) => {
      const { container, unmount } = render(
        <MarkUndoContext.Provider value={marks}>
          <FullScreenContext.Provider value={{ full, toggle }}>
            <UndoRedo />
          </FullScreenContext.Provider>
        </MarkUndoContext.Provider>,
      );
      const name = container.querySelector('button[aria-keyshortcuts="F"]')!.getAttribute("aria-label");
      unmount();
      return name;
    };
    expect(named(true), "the same name in and out of full screen").not.toBe(named(false));
    const { container } = render(
      <MarkUndoContext.Provider value={marks}>
        <FullScreenContext.Provider value={{ full: true, toggle }}>
          <UndoRedo />
        </FullScreenContext.Provider>
      </MarkUndoContext.Provider>,
    );
    const button = container.querySelector<HTMLButtonElement>('button[aria-keyshortcuts="F"]')!;
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("is not there when App does not offer it", () => {
    const { container } = render(
      <MarkUndoContext.Provider value={marks}>
        <UndoRedo />
      </MarkUndoContext.Provider>,
    );
    expect(container.querySelector('button[aria-keyshortcuts="F"]')).toBeNull();
  });
});
