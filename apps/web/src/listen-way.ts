/**
 * How each verse is played: how many times in a row, and how fast. Set from
 * the play options that open under Listen in the verse drawer (decision
 * selection-drawer, open question ③), and kept on this device.
 *
 * A hafiz repeats a verse to fix it in memory and slows it to hear each
 * letter, so both are offered; the defaults are the app as it was: once, as
 * recited.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `drawer-tools.ts` keeps.
 */
import { ONCE_AS_RECITED, type ListenWay } from "./audio";

/** Times each verse plays, in the order offered. Infinity: until stopped. */
export const REPEATS: readonly number[] = [1, 3, 5, Infinity];

/** Rates offered: slower, as recited, faster. */
export const SPEEDS: readonly number[] = [0.75, 1, 1.25];

/** Versioned: an option that later changes what it does gets a new key. */
export const LISTEN_WAY_KEY = "hifth.listen.way.v1";

/** The way this device chose, or once as recited when it never chose. */
export function savedListenWay(): ListenWay {
  try {
    const raw = localStorage.getItem(LISTEN_WAY_KEY);
    if (!raw) return ONCE_AS_RECITED;
    const kept = JSON.parse(raw) as { repeat?: unknown; speed?: unknown };
    // JSON has no Infinity: "until I stop" is kept as null.
    const repeat = kept.repeat === null ? Infinity : kept.repeat;
    return {
      repeat: REPEATS.includes(repeat as number) ? (repeat as number) : ONCE_AS_RECITED.repeat,
      speed: SPEEDS.includes(kept.speed as number) ? (kept.speed as number) : ONCE_AS_RECITED.speed,
    };
  } catch {
    // Safari private mode throws on localStorage, and a broken value throws on
    // parse: either way the default.
    return ONCE_AS_RECITED;
  }
}

export function rememberListenWay(way: ListenWay): void {
  try {
    localStorage.setItem(LISTEN_WAY_KEY, JSON.stringify(way));
  } catch {
    /* nothing to do — see savedListenWay */
  }
}
