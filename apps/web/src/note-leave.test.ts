import { afterEach, describe, expect, it, vi } from "vitest";
import { NOTE_LEAVE_KEY, acrossTheFoot, leaveBehind, rememberNoteLeave, savedNoteLeave } from "./note-leave";

describe("how the note leaves the screen, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("slides away when nobody chose, and keeps the choice made", () => {
    expect(savedNoteLeave()).toBe("slide");
    for (const choice of ["at-once", "slide"] as const) {
      rememberNoteLeave(choice);
      expect(localStorage.getItem(NOTE_LEAVE_KEY)).toBe(choice);
      expect(savedNoteLeave()).toBe(choice);
    }
  });

  it("a value it does not know falls back to sliding away", () => {
    localStorage.setItem(NOTE_LEAVE_KEY, "nonsense");
    expect(savedNoteLeave()).toBe("slide");
  });
});

describe("which note slides away", () => {
  it("is one lying across the screen's foot, wall to wall, not a card in a corner", () => {
    // Made-up widths: an upright tablet's note and a phone's, then a laptop's card.
    expect(acrossTheFoot(1008, 1024)).toBe(true);
    expect(acrossTheFoot(390, 390)).toBe(true);
    expect(acrossTheFoot(380, 1440)).toBe(false);
    expect(acrossTheFoot(0, 1024)).toBe(false);
  });
});

describe("the copy of the note left behind to slide away", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  // A made-up note: a dialog with a labelled button and an element with an id.
  const note = (): { parent: HTMLElement; node: HTMLElement } => {
    const parent = document.createElement("div");
    const node = document.createElement("div");
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-label", "A note");
    node.setAttribute("aria-modal", "false");
    node.tabIndex = -1;
    node.innerHTML = '<button type="button" aria-label="Close">x</button><p id="card-1">Lorem ipsum</p>';
    parent.append(node);
    document.body.append(parent);
    return { parent, node };
  };

  it("stands where the note stood, hidden from screen readers and out of reach", () => {
    const { parent, node } = note();
    let finish: (() => void) | null = null;
    const animate = vi.fn(() => {
      const run = { onfinish: null as null | (() => void), cancel: vi.fn() };
      finish = () => run.onfinish?.();
      return run as unknown as Animation;
    });
    Object.defineProperty(HTMLElement.prototype, "animate", { value: animate, configurable: true });
    node.remove();
    const copy = leaveBehind(node, parent, 460)!;
    expect(copy).not.toBeNull();
    expect(copy.parentElement).toBe(parent);
    expect(copy.getAttribute("aria-hidden")).toBe("true");
    expect(copy.hasAttribute("inert")).toBe(true);
    expect(copy.hasAttribute("data-note-leaving")).toBe(true);
    // Nothing in it answers as the note any more: no dialog, no name, no ids.
    expect(copy.hasAttribute("role")).toBe(false);
    expect(copy.hasAttribute("aria-label")).toBe(false);
    expect(copy.querySelector("[id]")).toBeNull();
    expect(copy.hasAttribute("tabindex")).toBe(false);
    // One layer under every drawer, so a list that takes the note's place
    // rises over it, and still over the page's own bars.
    expect(copy.style.zIndex).toBe("calc(var(--z-sheet) - 1)");
    // It slides down over the time it was given, and is gone at the end.
    expect(animate).toHaveBeenCalledTimes(1);
    const [frames, timing] = animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
    expect(frames.at(-1)!.transform).toBe("translateY(100%)");
    expect(timing.duration).toBe(460);
    finish!();
    expect(copy.isConnected).toBe(false);
  });

  it("leaves nothing behind with no time to slide in, or a browser that cannot", () => {
    const { parent, node } = note();
    node.remove();
    Object.defineProperty(HTMLElement.prototype, "animate", { value: vi.fn(), configurable: true });
    expect(leaveBehind(node, parent, 0)).toBeNull();
    Object.defineProperty(HTMLElement.prototype, "animate", { value: undefined, configurable: true });
    expect(leaveBehind(node, parent, 460)).toBeNull();
    expect(parent.children).toHaveLength(0);
  });

  it("leaves nothing behind when the place it stood is gone", () => {
    const { parent, node } = note();
    Object.defineProperty(HTMLElement.prototype, "animate", { value: vi.fn(), configurable: true });
    parent.remove();
    expect(leaveBehind(node, parent, 460)).toBeNull();
  });
});
