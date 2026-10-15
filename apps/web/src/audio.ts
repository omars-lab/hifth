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

/** A verse's file asked for before it plays (see `useVerseAudio`). */
interface Ready {
  cancel: AbortController | null;
  copy: string | null;
}

/**
 * Where the files of surahs kept on the device are found (recitation-keep.ts,
 * docs/PLAN.md item 101). `has` answers at once, inside a press; `copy` reads
 * the file itself.
 */
export interface KeptRecitation {
  has(url: string): boolean;
  copy(url: string): Promise<Blob | undefined>;
  /** A verse's file played to its end (docs/PLAN.md, item 102). */
  heard?(url: string): void;
}

/** Nothing kept: every verse streams. */
const NOTHING_KEPT: KeptRecitation = {
  has: () => false,
  copy: () => Promise.resolve(undefined),
};

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
   * Ask for one verse's file now, because a control that plays it has just
   * come into reach, so the press finds it in hand (docs/PLAN.md, item 65).
   * Nothing when the setting is off, during a run, or for the verse playing.
   */
  prepare(key: string): void;
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
  kept: KeptRecitation = NOTHING_KEPT,
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
  const keptRef = useRef(kept);
  keptRef.current = kept;
  // A kept verse is made ready from its copy whatever the setting says: the
  // reader kept the surah to hear it from the device.
  const isKept = useCallback((k: string): boolean => {
    const url = verseAudioUrl(k);
    return url !== null && keptRef.current.has(url);
  }, []);
  // The verse whose network file failed and is being played from its copy.
  const rescueRef = useRef<string | null>(null);

  // Verses asked for before they play, by verse: `cancel` while the request
  // is on its way, `copy` once it has come and is kept.
  const readyRef = useRef(new Map<string, Ready>());
  // The verse whose Play is in reach, asked for before it is pressed.
  const wantedRef = useRef<string | null>(null);

  // Let go of whatever was made ready for any verse but `keep`, those still to
  // come in a run, and the one whose Play is in reach.
  const forget = useCallback((keep?: string): void => {
    const coming = new Set(queueRef.current);
    for (const [k, r] of readyRef.current) {
      if (k === keep || k === wantedRef.current || coming.has(k)) continue;
      r.cancel?.abort();
      if (r.copy) URL.revokeObjectURL(r.copy);
      readyRef.current.delete(k);
    }
  }, []);

  // Ask for one verse's file, and keep it when the setting says so; `then`
  // runs once it has come and been kept. A kept verse is read from the device.
  const fetchAhead = useCallback((next: string, then?: () => void): void => {
    const way = aheadRef.current;
    const url = verseAudioUrl(next);
    if (!url) return;
    const fromDevice = keptRef.current.has(url);
    if (!fromDevice && (way === "off" || typeof fetch !== "function")) return;
    const ready = readyRef.current;
    const cancel = new AbortController();
    const entry: Ready = { cancel, copy: null };
    ready.set(next, entry);
    // Wrapped, so a fetch that throws at once fails like one that failed
    // later, and never out of the page's effect that asked for it.
    const bytesOf = fromDevice
      ? keptRef.current.copy(url).then((b) => b ?? null)
      : new Promise<Response>((r) => r(fetch(url, { signal: cancel.signal }))).then((r) =>
          r.ok ? r.blob() : null,
        );
    void bytesOf
      .then((bytes) => {
        if (ready.get(next) !== entry) return;
        entry.cancel = null;
        // An empty answer is no file; the verse then plays from the network.
        if ((fromDevice || way === "hold") && bytes && bytes.size > 0) {
          entry.copy = URL.createObjectURL(bytes);
        }
        then?.();
      })
      .catch(() => {
        // Asked for again when it is next in reach, not straight away.
        if (ready.get(next) === entry) ready.delete(next);
      });
  }, []);

  // While a run's verse sounds, ask for the files of the verses after it, up
  // to RUN_AHEAD_VERSES ahead and one after another, so they do not share a
  // slow line: a short verse can end before a long one's file is in.
  const askAhead = useCallback(function ask(): void {
    if (!inRunRef.current) return;
    const ready = readyRef.current;
    for (const r of ready.values()) if (r.cancel) return;
    const off = aheadRef.current === "off";
    const next = queueRef.current
      .slice(0, RUN_AHEAD_VERSES)
      .find((k) => !ready.has(k) && (!off || isKept(k)));
    if (next) fetchAhead(next, ask);
  }, [fetchAhead, isKept]);


  // A verse would not play. One kept on the device that failed from the
  // network (no connection, or pressed before its copy was read) plays from
  // its copy instead, and only a copy that fails too is said to have failed.
  // Both the element's `error` and `play()` refusing come here, so the second
  // of the two is ignored while the copy is being read.
  const failed = useCallback((el: HTMLAudioElement, k: string): void => {
    const url = verseAudioUrl(k);
    const onCopy = el.src.startsWith("blob:");
    if (rescueRef.current === k && !onCopy) return;
    if (url && !onCopy && keptRef.current.has(url)) {
      rescueRef.current = k;
      setPhase("loading");
      void keptRef.current.copy(url).then((bytes) => {
        if (keyRef.current !== k || rescueRef.current !== k) return;
        if (!bytes || bytes.size === 0) {
          rescueRef.current = null;
          setPhase("error");
          onErrorRef.current?.(k);
          return;
        }
        const copy = URL.createObjectURL(bytes);
        const before = readyRef.current.get(k)?.copy;
        if (before) URL.revokeObjectURL(before);
        readyRef.current.set(k, { cancel: null, copy });
        el.src = copy;
        el.currentTime = 0;
        el.play().catch(() => failed(el, k));
      });
      return;
    }
    setPhase("error");
    onErrorRef.current?.(k);
  }, []);

  // Point the element at one verse's file and start it. Only refs and state
  // setters, so it never changes and the listeners below may keep it.
  const start = useCallback((el: HTMLAudioElement, next: string): void => {
    const url = verseAudioUrl(next);
    if (!url) return;
    keyRef.current = next;
    setKey(next);
    setPhase("loading");
    wantedRef.current = null;
    rescueRef.current = null;
    // The copy made ready before the verse, if it came in time. A request
    // still on its way is dropped and the verse plays from the network: that
    // starts once a little of the file is in, where the copy needs all of it
    // (docs/issues/first-verse-wait-for-copy.md). Requests for the verses
    // after it carry on.
    const ready = readyRef.current.get(next);
    if (ready?.cancel) {
      ready.cancel.abort();
      readyRef.current.delete(next);
    }
    forget(next);
    el.src = readyRef.current.get(next)?.copy ?? url;
    el.currentTime = 0;
    el.play().catch(() => failed(el, next));
  }, [forget, failed]);

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
        const done = keyRef.current ? verseAudioUrl(keyRef.current) : null;
        if (done) keptRef.current.heard?.(done);
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
        const k = keyRef.current;
        if (k) failed(el!, k);
        else setPhase("error");
      });
      elRef.current = el;
    }
    return el;
  }, [start, setInRun, askAhead, failed]);

  const stop = useCallback(() => {
    queueRef.current = [];
    wantedRef.current = null;
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
        el.play().catch(() => failed(el, next));
        return;
      }
      // Otherwise it is a new verse: point the element at its file and start.
      start(el, next);
    },
    [element, start, setInRun, failed],
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

  const prepare = useCallback(
    (next: string) => {
      if (inRunRef.current || next === keyRef.current) return;
      if (aheadRef.current === "off" && !isKept(next)) return;
      if (wantedRef.current === next && readyRef.current.has(next)) return;
      wantedRef.current = next;
      forget(keyRef.current ?? undefined);
      if (!readyRef.current.has(next)) fetchAhead(next);
    },
    [forget, fetchAhead, isKept],
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
      wantedRef.current = null;
      forget();
    };
  }, [forget]);

  const phaseFor = useCallback(
    (k: string | null): AudioPhase => (k !== null && k === key ? phase : "idle"),
    [key, phase],
  );

  return { phaseFor, toggle, stop, playRun, prepare, runKey: inRun ? key : null, runNo: inRun ? runNo : null };
}
