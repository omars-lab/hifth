/**
 * harakah-pick (open, docs/decisions/harakah-pick.md): a vowel-sign is smaller
 * than the fingertip that would land on it, so how does a reader say which one
 * they mean?
 *
 * Three interchangeable pickers, one per option on the decision page
 * (docs/design/harakah-pick-options.html), where each is mounted live on a real
 * verse so the owner chooses by doing it, not by reading about it:
 *
 *   A · Word, then sign — tap the word; its signs open as a tray of enlarged
 *       crops of the print, and you tap the one you mean.
 *   B · Press and loupe — press near the sign; a magnifier snaps to the
 *       nearest one, slide to change it, let go to take it.
 *   C · Word, then names — tap the word; its signs open as a row of their
 *       names, and you pick one by name.
 *
 * As in scrub-rate.ts, every function here is standalone — it reads only its
 * arguments — so the page builder inlines the very same compiled source and the
 * page runs what the unit test checks. The app's mistake tool mounts the
 * picker named by `HARAKAH_PICK_DEFAULT`: A, until the owner chooses. When one
 * is chosen the other two are deleted.
 *
 * A sign here is a position on the print and a name (fatha, kasra…), never the
 * verse's text.
 */

/** One sign on one verse: its number in the verse's list, its word, name and box (page units). */
export interface PickSign {
  readonly id: number;
  readonly w: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly mw: number;
  readonly mh: number;
}

/** One button the picker offers: the sign it takes and what the button says. */
export interface PickChoice {
  readonly id: number;
  readonly label: string;
}

/** What every picker offers the tool that mounts it. */
export interface HarakahPicker {
  readonly id: "A" | "B" | "C";
  readonly label: string;
  /** What begins a pick: a tap on the word, or a press held on the page. */
  readonly startsOn: "word" | "press";
  /** How each choice is shown: an enlarged crop of the print, its name, or a magnifier. */
  readonly shows: "ink" | "name" | "loupe";
  /** The buttons a tapped word opens into. A press picker opens none. */
  choices(signs: readonly PickSign[], word: number): PickChoice[];
  /** The sign a press at (x, y) snaps to, or null for a picker that does not snap. */
  snap(signs: readonly PickSign[], x: number, y: number): number | null;
}

/**
 * The signs on one word, in reading order: right to left by the middle of each
 * box, so the first button is the sign a reader meets first.
 */
export function signsOnWord(signs: readonly PickSign[], word: number): PickSign[] {
  return signs
    .filter((s) => s.w === word)
    .sort((a, b) => b.x + b.mw / 2 - (a.x + a.mw / 2));
}

/** A: one button per sign, labelled with its name under the enlarged ink. */
export function trayChoices(signs: readonly PickSign[], word: number): PickChoice[] {
  const on = signs.filter((s) => s.w === word).sort((a, b) => b.x + b.mw / 2 - (a.x + a.mw / 2));
  return on.map((s) => ({ id: s.id, label: s.name }));
}

/**
 * C: one button per sign, named and numbered in reading order ("2 · kasra"), so
 * two signs of the same name on one word can still be told apart.
 */
export function namedChoices(signs: readonly PickSign[], word: number): PickChoice[] {
  const on = signs.filter((s) => s.w === word).sort((a, b) => b.x + b.mw / 2 - (a.x + a.mw / 2));
  return on.map((s, i) => ({ id: s.id, label: `${i + 1} · ${s.name}` }));
}

/** B opens no buttons: the press itself is the pick. */
export function noChoices(_signs: readonly PickSign[], _word: number): PickChoice[] {
  return [];
}

/** B: the sign whose middle is nearest the press. Null when there are none. */
export function nearestSign(signs: readonly PickSign[], x: number, y: number): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const s of signs) {
    const dx = s.x + s.mw / 2 - x;
    const dy = s.y + s.mh / 2 - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = s.id;
    }
  }
  return best;
}

/** A and C do not snap: the word opens, and the reader picks from it. */
export function noSnap(_signs: readonly PickSign[], _x: number, _y: number): number | null {
  return null;
}

export const OptionA: HarakahPicker = {
  id: "A",
  label: "Word, then sign",
  startsOn: "word",
  shows: "ink",
  choices: trayChoices,
  snap: noSnap,
};

export const OptionB: HarakahPicker = {
  id: "B",
  label: "Press and loupe",
  startsOn: "press",
  shows: "loupe",
  choices: noChoices,
  snap: nearestSign,
};

export const OptionC: HarakahPicker = {
  id: "C",
  label: "Word, then names",
  startsOn: "word",
  shows: "name",
  choices: namedChoices,
  snap: noSnap,
};

export const HARAKAH_PICKERS: readonly HarakahPicker[] = [OptionA, OptionB, OptionC];

/**
 * The picker the app's mistake tool mounts while the decision is open. Nothing
 * reached finer than a word before the tool, so there is no "today" to keep;
 * A is the first option and the one the word-tap tool fits without a new
 * gesture. This is a default, not the decision.
 */
export const HARAKAH_PICK_DEFAULT: HarakahPicker = OptionA;
