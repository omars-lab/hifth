/**
 * A surah's recitation kept on the reader's own device (docs/PLAN.md, item 101).
 *
 * The recitation streams from Quran.com's recording server, so with no
 * connection a verse's Play only says "offline", and on a poor one the first
 * verse takes over a second to start. The reader can keep a surah: every verse's
 * file is fetched once and held on the device, and a kept verse then plays from
 * its copy. Nothing is carried in what the app ships; the device holds what the
 * reader asked it to, the way a browser holds what it has played.
 *
 * ## Why not the juz packs (packs.ts)
 *
 * A pack's fetch carries a header of the app's own, so the offline worker knows
 * not to file it twice. On a file from another site that header makes the
 * browser ask the site first, and this server does not allow it (its answer
 * lists the headers it accepts), so nothing would be saved. A kept surah is
 * fetched with a plain request, into a cache of its own.
 *
 * ## The claim in local storage, the bytes in Cache Storage
 *
 * The audio player has to know at once, inside the press, whether a verse is
 * kept, so the claim is read without waiting: a small record per surah in local
 * storage. The bytes sit in Cache Storage. A storage sweep can take either, and
 * keeping them apart is what lets the info panel say "3 of 7 still here" rather
 * than show a surah as kept that is not.
 *
 * Nothing here throws at the caller: a browser with nowhere to keep files keeps
 * nothing, and says so by returning null.
 */

import { useEffect, useState } from "react";
import { AYAH_COUNTS } from "@hifth/core";
import { verseAudioUrl, type KeptRecitation } from "./audio";
import { requestPersistentStorage } from "./storage";
import { savedKeepWhen } from "./keep-when";

/** Where kept recitations live. Never shared with the page caches. */
export const KEEP_CACHE = "hifth-recitation-v1";

const CLAIM_KEY = "hifth.recitation.kept.v1";

/** Which verses of each surah have played to their end, while that counts. */
const HEARD_KEY = "hifth.recitation.heard.v1";

/** How many files are fetched at once while keeping a surah. */
const CONCURRENCY = 3;

/** What the device says it keeps of one surah. */
export interface KeptSurah {
  readonly surah: number;
  /** How many verse files the surah has. */
  readonly total: number;
  /** Bytes held, as measured while saving them. */
  readonly bytes: number;
  readonly keptAt: number;
}

/** Whether the files are all there, some, or none. */
export type KeptHealth = "whole" | "torn" | "gone";

export interface KeptStatus extends KeptSurah {
  readonly health: KeptHealth;
  readonly present: number;
}

export interface KeepProgress {
  readonly surah: number;
  readonly done: number;
  readonly total: number;
  readonly bytes: number;
}

export interface KeepOptions {
  readonly onProgress?: (p: KeepProgress) => void;
  /** Stopping lets go of everything this keep saved, and claims nothing. */
  readonly signal?: AbortSignal;
}

/** Whether this browser can keep files at all. */
export function keepSupported(): boolean {
  return typeof caches !== "undefined" && caches !== null;
}

/** Every verse file of one surah, in order. */
export function surahAudioUrls(surah: number): string[] {
  const n = AYAH_COUNTS[surah - 1] ?? 0;
  return Array.from({ length: n }, (_, i) => verseAudioUrl(`quran/x/${surah}:${i + 1}`)!);
}

function readClaims(): Record<string, KeptSurah> {
  try {
    const raw = localStorage.getItem(CLAIM_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, KeptSurah>) : {};
  } catch {
    return {};
  }
}

function writeClaims(claims: Record<string, KeptSurah>): void {
  try {
    localStorage.setItem(CLAIM_KEY, JSON.stringify(claims));
  } catch {
    // A device that will not hold the claim holds nothing the player relies on.
  }
  notify();
}

/** Every surah the device claims to keep, in the book's order. */
export function keptSurahs(): KeptSurah[] {
  return Object.values(readClaims())
    .filter((k) => typeof k?.surah === "number")
    .sort((a, b) => a.surah - b.surah);
}

/** The surah and verse a verse file belongs to, read off its address. */
function verseOfUrl(url: string): [number, number] | null {
  const m = /\/(\d{3})(\d{3})\.mp3$/.exec(url);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function surahOfUrl(url: string): number | null {
  return verseOfUrl(url)?.[0] ?? null;
}

function readHeard(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(HEARD_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number[]>) : {};
  } catch {
    return {};
  }
}

function writeHeard(heard: Record<string, number[]>): void {
  try {
    localStorage.setItem(HEARD_KEY, JSON.stringify(heard));
  } catch {
    // Not remembered, so not kept by itself; the button still keeps it.
  }
}

/**
 * A verse's file played to its end (docs/PLAN.md, item 102). With the setting
 * for keeping a surah once heard through on, the verse is counted, and the one
 * that completes its surah keeps it, after any keep already under way. The
 * count starts again once the surah is kept, so a surah the reader then removes
 * stays removed until they hear it all again. Resolves to what it kept, if any.
 */
export async function heardVerse(url: string): Promise<KeptSurah | null> {
  if (savedKeepWhen() !== "heard" || !keepSupported()) return null;
  const verse = verseOfUrl(url);
  if (!verse) return null;
  const [surah, ayah] = verse;
  const total = AYAH_COUNTS[surah - 1] ?? 0;
  if (ayah < 1 || ayah > total || readClaims()[String(surah)] !== undefined) return null;
  const heard = readHeard();
  const verses = new Set(heard[String(surah)] ?? []);
  verses.add(ayah);
  if (verses.size < total) {
    writeHeard({ ...heard, [String(surah)]: [...verses].sort((a, b) => a - b) });
    return null;
  }
  delete heard[String(surah)];
  writeHeard(heard);
  // The reader's own keep goes first: starting another would stop it.
  while (underway) await underway;
  if (readClaims()[String(surah)] !== undefined) return null;
  return startKeeping(surah);
}

/**
 * Whether this verse file's surah is claimed, answered at once. The player asks
 * inside a press; the copy itself comes from `keptCopy`.
 */
export function isKeptUrl(url: string): boolean {
  const s = surahOfUrl(url);
  return s !== null && readClaims()[String(s)] !== undefined;
}

/** A kept verse's file, if the device still holds it. */
export async function keptCopy(url: string): Promise<Blob | undefined> {
  if (!keepSupported()) return undefined;
  try {
    const cache = await caches.open(KEEP_CACHE);
    const res = await cache.match(url);
    if (!res) return undefined;
    const blob = await res.blob();
    return blob.size > 0 ? blob : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch every verse file of a surah that the device does not already hold, and
 * claim the surah. A file that will not come leaves the surah claimed but short,
 * so the info panel can say so and offer to try again; a stop claims nothing.
 */
export async function keepSurah(surah: number, options: KeepOptions = {}): Promise<KeptSurah | null> {
  if (!keepSupported()) return null;
  const { onProgress, signal } = options;
  const urls = surahAudioUrls(surah);
  if (urls.length === 0) return null;
  const saved: string[] = [];
  let cache: Cache;
  try {
    cache = await caches.open(KEEP_CACHE);
  } catch {
    return null;
  }
  let bytes = 0;
  let done = 0;
  const queue = [...urls];
  const worker = async (): Promise<void> => {
    for (;;) {
      if (signal?.aborted) return;
      const url = queue.shift();
      if (url === undefined) return;
      try {
        const held = await cache.match(url);
        const heldSize = held ? (await held.blob()).size : 0;
        if (heldSize > 0) {
          bytes += heldSize;
        } else {
          const res = await fetch(url, signal ? { signal } : undefined);
          if (res.ok) {
            // Sized into a local first: `bytes += await …` would read `bytes`
            // before the wait, and three workers would add to the same stale sum.
            const size = (await res.clone().blob()).size;
            if (size > 0) {
              await cache.put(url, res);
              saved.push(url);
              bytes += size;
            }
          }
        }
      } catch {
        // One file that will not come does not abandon the rest.
      }
      done += 1;
      if (!signal?.aborted) onProgress?.({ surah, done, total: urls.length, bytes });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  if (signal?.aborted) {
    for (const url of saved) await cache.delete(url).catch(() => false);
    return null;
  }
  const kept: KeptSurah = { surah, total: urls.length, bytes, keptAt: Date.now() };
  writeClaims({ ...readClaims(), [String(surah)]: kept });
  // Keeping a surah is a plain sign the reader means to listen offline, which a
  // browser weighs when it decides whether to promise the files will stay.
  void requestPersistentStorage();
  return kept;
}

/** Let go of a surah: its claim first, so the player stops reaching for it, then its files. */
export async function forgetSurah(surah: number): Promise<void> {
  const claims = readClaims();
  delete claims[String(surah)];
  writeClaims(claims);
  const heard = readHeard();
  if (heard[String(surah)] !== undefined) {
    delete heard[String(surah)];
    writeHeard(heard);
  }
  if (!keepSupported()) return;
  try {
    const cache = await caches.open(KEEP_CACHE);
    for (const url of surahAudioUrls(surah)) await cache.delete(url);
  } catch {
    // The claim is gone, so nothing will play from what is left.
  }
}

/** How much of a kept surah the device still holds. */
export async function checkKept(kept: KeptSurah): Promise<KeptStatus> {
  if (!keepSupported()) return { ...kept, health: "gone", present: 0 };
  try {
    const cache = await caches.open(KEEP_CACHE);
    let present = 0;
    for (const url of surahAudioUrls(kept.surah)) {
      const res = await cache.match(url);
      if (res && (await res.blob()).size > 0) present += 1;
    }
    const health: KeptHealth = present === 0 ? "gone" : present === kept.total ? "whole" : "torn";
    return { ...kept, health, present };
  } catch {
    return { ...kept, health: "gone", present: 0 };
  }
}

// The one keep in progress, shared by the surah's menu and the info panel.

let saving: KeepProgress | null = null;
let stopper: AbortController | null = null;
/** The keep in progress, for one that must wait its turn. */
let underway: Promise<KeptSurah | null> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  version += 1;
  for (const l of listeners) l();
}

/** Hear any change to what is kept or being kept. */
export function subscribeKept(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A number that changes whenever what is kept, or being kept, does. */
export function keptVersion(): number {
  return version;
}

/** The surah being kept right now, and how far it has got; null when none is. */
export function keepInProgress(): KeepProgress | null {
  return saving;
}

/**
 * Start keeping a surah, stopping any other keep first. Resolves once it has
 * finished, been stopped, or failed.
 */
export async function startKeeping(surah: number): Promise<KeptSurah | null> {
  stopper?.abort();
  const stop = new AbortController();
  stopper = stop;
  saving = { surah, done: 0, total: surahAudioUrls(surah).length, bytes: 0 };
  notify();
  const keeping = keepSurah(surah, {
    signal: stop.signal,
    onProgress: (p) => {
      if (stopper !== stop) return;
      saving = p;
      notify();
    },
  });
  underway = keeping;
  const kept = await keeping;
  if (underway === keeping) underway = null;
  if (stopper === stop) {
    stopper = null;
    saving = null;
    notify();
  }
  return kept;
}

/** Re-render whenever what is kept, or being kept, changes. */
export function useKeptChanges(): number {
  const [, setTick] = useState(0);
  useEffect(() => subscribeKept(() => setTick((n) => n + 1)), []);
  return version;
}

/** What the player reads kept verses from. */
export const DEVICE_RECITATION: KeptRecitation = {
  has: isKeptUrl,
  copy: keptCopy,
  heard: (url) => void heardVerse(url),
};

/** Stop the keep in progress; what it saved is let go. */
export function stopKeeping(): void {
  stopper?.abort();
  stopper = null;
  saving = null;
  notify();
}
