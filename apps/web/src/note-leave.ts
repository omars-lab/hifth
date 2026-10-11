import { useEffect, useState } from "react";

/**
 * How the note across the page's foot leaves when it closes, and where the
 * reader's choice is kept (docs/PLAN.md, item 72).
 *
 * With the note up, the page may sit higher than the screen otherwise allows,
 * so a verse low on it shows above the note. Closing the note glides the page
 * back down over half a second (item 71), but the note itself went in one
 * frame, so for that half second the strip it had covered showed the bare desk
 * under the page. Both ways are built and kept here as a setting:
 *
 *   slide    a copy of the note stays where it stood and slides down off the
 *            screen over the same half second, as the page comes down after it
 *            (the default).
 *   at-once  the note goes at once, as it always did.
 *
 * Only the note across the foot: one beside the page has no page coming after it.
 * Its own module, free of CSS, as `zoom-anchor.ts` is.
 */
export type NoteLeave = "slide" | "at-once";

/** In settings order. */
export const NOTE_LEAVES: readonly NoteLeave[] = ["slide", "at-once"];

/** Versioned: a way that later changes what it does gets a new key. */
export const NOTE_LEAVE_KEY = "hifth.note.leave.v1";

function isNoteLeave(value: unknown): value is NoteLeave {
  return value === "slide" || value === "at-once";
}

/** The way this device chose, or sliding away when it never chose. */
export function savedNoteLeave(): NoteLeave {
  try {
    const stored = localStorage.getItem(NOTE_LEAVE_KEY);
    return isNoteLeave(stored) ? stored : "slide";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "slide";
  }
}

const heard = new Set<(choice: NoteLeave) => void>();

export function rememberNoteLeave(choice: NoteLeave): void {
  try {
    localStorage.setItem(NOTE_LEAVE_KEY, choice);
  } catch {
    /* nothing to do — see savedNoteLeave */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useNoteLeave(): NoteLeave {
  const [choice, setChoice] = useState<NoteLeave>(savedNoteLeave);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}

/**
 * Whether a note lies across the screen's foot, wall to wall, so the page comes
 * down after it when it closes. A card standing in a corner beside one page
 * (a laptop) is not: there the page moves sideways, and a copy sliding down
 * would end half off the screen before it went.
 */
export function acrossTheFoot(width: number, windowWidth: number): boolean {
  return width > 0 && width >= windowWidth * 0.8;
}

/**
 * How long the page's own glide takes, in ms: the same duration token, which
 * reduced motion sets to nothing, so then the note goes at once as the page does.
 */
export function leaveMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--dur-hop").trim();
  const ms = raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000;
  return Number.isFinite(ms) ? ms : 460;
}

/** The easing the page's own glide uses (`easeInOutCubic`), so the two move as one. */
const IN_STEP = "cubic-bezier(0.65, 0, 0.35, 1)";

/**
 * Put a copy of the note that was just taken away back where it stood, and
 * slide it down off the screen over `ms`, then drop it.
 *
 * The copy is a picture, not the note: nothing in it is a dialog, has a name or
 * an id, takes focus or answers a press, so a screen reader and the keyboard
 * are already past it. Returns null, and leaves nothing behind, with no time to
 * slide in (reduced motion sets the durations to nothing), a browser that
 * cannot animate, or nowhere left to stand.
 */
export function leaveBehind(node: HTMLElement, parent: Node | null, ms: number): HTMLElement | null {
  if (!(ms > 0) || !parent?.isConnected || typeof node.animate !== "function") return null;
  const copy = node.cloneNode(true) as HTMLElement;
  for (const name of ["role", "aria-label", "aria-modal", "tabindex", "id"]) copy.removeAttribute(name);
  for (const el of copy.querySelectorAll("[id]")) el.removeAttribute("id");
  copy.setAttribute("aria-hidden", "true");
  copy.setAttribute("inert", "");
  copy.setAttribute("data-note-leaving", "");
  // It is already where it rose to: its own rise must not play again.
  copy.style.animation = "none";
  copy.style.pointerEvents = "none";
  parent.appendChild(copy);
  copy.scrollTop = node.scrollTop;
  const run = copy.animate([{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], {
    duration: ms,
    easing: IN_STEP,
    fill: "forwards",
  });
  if (!run) {
    copy.remove();
    return null;
  }
  const drop = () => copy.remove();
  run.onfinish = drop;
  run.oncancel = drop;
  return copy;
}
