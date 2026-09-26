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
import { parseAyahKey } from "@hifth/core";

/** Who is reciting, for the credit line — the app never guesses this from a URL. */
export const RECITER = "Mohamed Siddiq al-Minshawi";
export const RECITER_SOURCE = "Quran.com audio CDN";

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

/** What the play control is doing right now. */
export type AudioPhase = "idle" | "loading" | "playing" | "error";

export interface VerseAudio {
  /** The phase for `key` — always `idle` for any key that is not the one playing. */
  phaseFor(key: string | null): AudioPhase;
  /** Start `key` (stopping whatever was playing), or pause it if it already is. */
  toggle(key: string): void;
  /** Stop and reset — called when the selection moves off the playing verse. */
  stop(): void;
}

/**
 * One <audio> element for the whole app, driven by whichever verse is selected.
 *
 * A single element (not one per verse) means a new tap always interrupts the
 * last — a hafiz checking verse after verse never ends up with two reciters at
 * once. The hook owns the element's lifecycle and mirrors its real events
 * (`playing`, `pause`, `ended`, `error`, `waiting`) into a phase the trigger can
 * render, rather than trusting `play()` to have succeeded. `onError` lets the
 * caller announce a CDN failure through the app's live region.
 */
export function useVerseAudio(onError?: (key: string) => void): VerseAudio {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const keyRef = useRef<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<AudioPhase>("idle");

  // The element's `error` listener is added once, so it must not close over a
  // stale `onError`; keep the latest in a ref the listener reads at fire time.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Lazily build the element the first time it is needed, on the client only.
  const element = useCallback((): HTMLAudioElement => {
    let el = elRef.current;
    if (!el) {
      el = new Audio();
      el.preload = "none";
      el.addEventListener("playing", () => setPhase("playing"));
      el.addEventListener("waiting", () => setPhase("loading"));
      el.addEventListener("pause", () => setPhase((p) => (p === "error" ? p : "idle")));
      el.addEventListener("ended", () => setPhase("idle"));
      el.addEventListener("error", () => {
        setPhase("error");
        const k = keyRef.current;
        if (k) onErrorRef.current?.(k);
      });
      elRef.current = el;
    }
    return el;
  }, []);

  const stop = useCallback(() => {
    const el = elRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    keyRef.current = null;
    setKey(null);
    setPhase("idle");
  }, []);

  const toggle = useCallback(
    (next: string) => {
      const url = verseAudioUrl(next);
      if (!url) return;
      const el = element();
      // A second tap on the verse already playing pauses it.
      if (keyRef.current === next && !el.paused) {
        el.pause();
        return;
      }
      // A tap on the paused-but-loaded same verse resumes without reloading.
      if (keyRef.current === next && el.paused && el.src) {
        setPhase("loading");
        el.play().catch(() => {
          setPhase("error");
          onErrorRef.current?.(next);
        });
        return;
      }
      // Otherwise it is a new verse: point the element at its file and start.
      keyRef.current = next;
      setKey(next);
      setPhase("loading");
      el.src = url;
      el.currentTime = 0;
      el.play().catch(() => {
        setPhase("error");
        onErrorRef.current?.(next);
      });
    },
    [element],
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
    };
  }, []);

  const phaseFor = useCallback(
    (k: string | null): AudioPhase => (k !== null && k === key ? phase : "idle"),
    [key, phase],
  );

  return { phaseFor, toggle, stop };
}
