/**
 * Per-verse recitation — the ▶ that lets a hafiz *hear* the ayah they landed on.
 *
 * We ship no audio. Each ayah's file lives on Quran.com's public audio CDN
 * (`verses.quran.com`), served with `Access-Control-Allow-Origin: *` and byte
 * ranges, so a plain <audio> element streams it straight from the hosted site
 * with no proxy and nothing held in the tree. The URL is deterministic — surah
 * and ayah, each padded to three digits — so there is no API round-trip at play
 * time. Reciter: Mohamed Siddiq al-Minshawi (Murattal). Attribution lives in
 * SOURCES.md; the CDN itself is open access (see the QUL licensing note).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fromAbsoluteAyah, parseAyahKey, toAbsoluteAyah } from "@hifth/core";
import type { RunAhead } from "./run-ahead";

/** Who is reciting, for the credit line — the app never guesses this from a URL. */
export const RECITER = "Mohamed Siddiq al-Minshawi";
export const RECITER_SOURCE = "Quran.com audio CDN";

/** How many verses of a run are asked for ahead of the one sounding (docs/PLAN.md, item 64). */
const RUN_AHEAD_VERSES = 3;

/**
 * The public URL of one ayah's recitation, or null when the key is not a bare
 * ayah (a word or range has no single file). Pure and deterministic.
 */
export function verseAudioUrl(key: string): string | null {
  const parsed = parseAyahKey(key);
  if (!parsed) return null;
  const surah = String(parsed.surah).padStart(3, "0");
  const ayah = String(parsed.ayah).padStart(3, "0");
  return `https://verses.quran.com/Minshawi/Murattal/mp3/${surah}${ayah}.mp3`;
}

/**
 * Every verse from one key to another, both ends kept, in reading order
 * whichever came first — the run "Play to" recites. Empty when either key is
 * not a whole verse.
 */
export function versesBetween(a: string, b: string): string[] {
  const pa = parseAyahKey(a);
  const pb = parseAyahKey(b);
  if (!pa || !pb) return [];
  const prefix = a.slice(0, a.lastIndexOf("/") + 1);
  let from = toAbsoluteAyah(pa.surah, pa.ayah);
  let to = toAbsoluteAyah(pb.surah, pb.ayah);
  if (to < from) [from, to] = [to, from];
  const out: string[] = [];
  for (let n = from; n <= to; n++) {
    const { surah, ayah } = fromAbsoluteAyah(n);
    out.push(`${prefix}${surah}:${ayah}`);
  }
  return out;
}

/** What the play control is doing right now. */
export type AudioPhase = "idle" | "loading" | "playing" | "error";

export interface VerseAudio {
  /** The phase for `key` — always `idle` for any key that is not the one playing. */
  phaseFor(key: string | null): AudioPhase;
  /** Start `key` (stopping whatever was playing), or pause it if it already is. */
  toggle(key: string): void;
  /** Stop and reset — called when the selection moves off the playing verse. */
  stop(): void;
  /** Recite a run of verses one after another ("Play to"). */
  playRun(keys: readonly string[]): void;
  /**
   * The verse a "Play to" run is reciting, while the run lasts; null otherwise.
   * The run moves on without moving the selection (which would open each
   * verse's note in turn), so the play control follows this instead.
   */
  runKey: string | null;
  /**
   * Which run this is, counted from one, while it lasts; null otherwise. A run
   * started straight after another keeps `runKey` set throughout, so this is how
   * the page tells a new run from the next verse of the same one.
   */
  runNo: number | null;
}

/**
 * One <audio> element for the whole app, driven by whichever verse is selected.
 *
 * A single element (not one per verse) means a new tap always interrupts the
 * last — a hafiz checking verse after verse never ends up with two reciters at
 * once. The hook owns the element's lifecycle and mirrors its real events
 * (`playing`, `pause`, `ended`, `error`, `waiting`) into a phase the trigger can
 * render, rather than trusting `play()` to have succeeded. `onError` lets the
 * caller announce a CDN failure through the app's live region. `onRunEnd` hears
 * a run reach its last verse's end by itself (not one stopped or cut short),
 * with that verse and the run's number. `ahead` is how a run makes its next
 * verse ready while one sounds (run-ahead.ts); it changes nothing outside a run.
 */
export function useVerseAudio(
  onError?: (key: string) => void,
  onRunEnd?: (key: string, run: number) => void,
  ahead: RunAhead = "off",
): VerseAudio {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const keyRef = useRef<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<AudioPhase>("idle");
  const [inRun, setInRunState] = useState(false);
  const [runNo, setRunNo] = useState(0);
  // Mirrors of the two above for the `ended` listener, which is added once.
  const inRunRef = useRef(false);
  const runNoRef = useRef(0);
  const setInRun = useCallback((on: boolean) => {
    inRunRef.current = on;
    setInRunState(on);
  }, []);
  // The verses still to come in a "Play to" run, in order.
  const queueRef = useRef<string[]>([]);

  // The element's `error` listener is added once, so it must not close over a
  // stale `onError`; keep the latest in a ref the listener reads at fire time.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;
  const aheadRef = useRef(ahead);
  aheadRef.current = ahead;

  // The run's coming verses, asked for while one sounds, by verse: `cancel`
  // while the request is on its way, `copy` once it has come and is kept.
  const readyRef = useRef(new Map<string, { cancel: AbortController | null; copy: string | null }>());

  // Let go of whatever was made ready for any verse but `keep` and those still to come.
  const forget = useCallback((keep?: string): void => {
    const coming = new Set(queueRef.current);
    for (const [k, r] of readyRef.current) {
      if (k === keep || coming.has(k)) continue;
      r.cancel?.abort();
      if (r.copy) URL.revokeObjectURL(r.copy);
      readyRef.current.delete(k);
    }
  }, []);

  // While a run's verse sounds, ask for the files of the verses after it, up
  // to RUN_AHEAD_VERSES ahead and one after another, so they do not share a
  // slow line: a short verse can end before a long one's file is in.
  const askAhead = useCallback(function ask(): void {
    const way = aheadRef.current;
    if (way === "off" || !inRunRef.current || typeof fetch !== "function") return;
    const ready = readyRef.current;
    for (const r of ready.values()) if (r.cancel) return;
    const next = queueRef.current.slice(0, RUN_AHEAD_VERSES).find((k) => !ready.has(k));
    const url = next && verseAudioUrl(next);
    if (!next || !url) return;
    const entry = { cancel: new AbortController() as AbortController | null, copy: null as string | null };
    ready.set(next, entry);
    fetch(url, { signal: entry.cancel!.signal })
      .then((r) => (r.ok ? r.blob() : null))
      .then((bytes) => {
        if (ready.get(next) !== entry) return;
        entry.cancel = null;
        // An empty answer is no file; the verse then plays from the network.
        if (way === "hold" && bytes && bytes.size > 0) entry.copy = URL.createObjectURL(bytes);
        ask();
      })
      .catch(() => {
        // Asked for again when the next verse sounds, not straight away.
        if (ready.get(next) === entry) ready.delete(next);
      });
  }, []);

  // Point the element at one verse's file and start it. Only refs and state
  // setters, so it never changes and the listeners below may keep it.
  const start = useCallback((el: HTMLAudioElement, next: string): void => {
    const url = verseAudioUrl(next);
    if (!url) return;
    keyRef.current = next;
    setKey(next);
    setPhase("loading");
    // The copy made ready while an earlier verse sounded, if it came in time;
    // its request still on its way is dropped, and the verse plays from the
    // network. Requests for the verses after it carry on.
    const ready = readyRef.current.get(next);
    if (ready?.cancel) {
      ready.cancel.abort();
      readyRef.current.delete(next);
    }
    forget(next);
    el.src = readyRef.current.get(next)?.copy ?? url;
    el.currentTime = 0;
    el.play().catch(() => {
      setPhase("error");
      onErrorRef.current?.(next);
    });
  }, [forget]);

  // Lazily build the element the first time it is needed, on the client only.
  const element = useCallback((): HTMLAudioElement => {
    let el = elRef.current;
    if (!el) {
      el = new Audio();
      el.preload = "none";
      el.addEventListener("playing", () => {
        setPhase("playing");
        askAhead();
      });
      el.addEventListener("waiting", () => setPhase("loading"));
      el.addEventListener("pause", () => setPhase((p) => (p === "error" ? p : "idle")));
      el.addEventListener("ended", () => {
        const next = queueRef.current.shift();
        if (next) start(elRef.current!, next);
        else {
          const ran = inRunRef.current;
          setPhase("idle");
          setInRun(false);
          const k = keyRef.current;
          if (ran && k) onRunEndRef.current?.(k, runNoRef.current);
        }
      });
      el.addEventListener("error", () => {
        setPhase("error");
        const k = keyRef.current;
        if (k) onErrorRef.current?.(k);
      });
      elRef.current = el;
    }
    return el;
  }, [start, setInRun, askAhead]);

  const stop = useCallback(() => {
    queueRef.current = [];
    setInRun(false);
    forget();
    const el = elRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    keyRef.current = null;
    setKey(null);
    setPhase("idle");
  }, [setInRun, forget]);

  const toggle = useCallback(
    (next: string) => {
      const url = verseAudioUrl(next);
      if (!url) return;
      const el = element();
      // A tap on another verse ends a run that was playing. A tap on the verse
      // the run is on pauses, resumes or retries it, and the run carries on.
      if (keyRef.current !== next) {
        queueRef.current = [];
        setInRun(false);
      }
      // A player whose file never loaded will not fetch it again on play(),
      // and may still say it is not paused, so a second tap on that verse
      // once the connection is back would pause or resume nothing and the
      // verse would stay silent. It starts over instead, below.
      const same = keyRef.current === next && !el.error;
      // A second tap on the verse already playing pauses it.
      if (same && !el.paused) {
        el.pause();
        return;
      }
      // A tap on the paused-but-loaded same verse resumes without reloading.
      if (same && el.paused && el.src) {
        setPhase("loading");
        el.play().catch(() => {
          setPhase("error");
          onErrorRef.current?.(next);
        });
        return;
      }
      // Otherwise it is a new verse: point the element at its file and start.
      start(el, next);
    },
    [element, start, setInRun],
  );

  const playRun = useCallback(
    (keys: readonly string[]) => {
      const run = keys.filter((k) => verseAudioUrl(k) !== null);
      const first = run.shift();
      if (!first) return;
      queueRef.current = run;
      setInRun(true);
      runNoRef.current += 1;
      setRunNo(runNoRef.current);
      start(element(), first);
    },
    [element, start, setInRun],
  );

  // Tear the element down when the app unmounts, so no audio outlives the page.
  useEffect(() => {
    return () => {
      const el = elRef.current;
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
      queueRef.current = [];
      forget();
    };
  }, [forget]);

  const phaseFor = useCallback(
    (k: string | null): AudioPhase => (k !== null && k === key ? phase : "idle"),
    [key, phase],
  );

  return { phaseFor, toggle, stop, playRun, runKey: inRun ? key : null, runNo: inRun ? runNo : null };
}
