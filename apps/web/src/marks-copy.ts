import { mergeMarkFiles, parseBookmarkFile, type BookmarkFile } from "@hifth/core";
import { askApp } from "./ask-app";

/*
 * The button "Keep a copy of my marks on hifth.app" (sign-in step 21c,
 * docs/design/sign-in.md, "your marks follow you"), with no drawing.
 *
 * The app is only the go-between: it carries the marks file to hifth.app and
 * back with the reader's session, and answers "off" while the copy is not
 * offered. The page does the thinking. Keeping a copy is:
 *
 *   1. fetch the copy hifth.app holds, and its number (0 when there is none);
 *   2. put it together with this device's marks;
 *   3. send the result, saying which copy it was built on;
 *   4. if another device kept a newer copy in the meantime, go back to 1;
 *   5. hand the result back, for the page to load here as well.
 *
 * So no device's marks are ever written over by another's, and every device
 * that presses the button ends with all of them. Nothing here throws or keeps
 * what it carries.
 */

type Ask = typeof askApp;

/** What the account section says about the copy. "off": nothing at all. "unknown": no line, the button still works. */
export type CopyState = { kind: "off" } | { kind: "none" } | { kind: "kept"; savedAt: number } | { kind: "unknown" };

/** "busy": another device kept a copy three times while this one tried; try again. */
export type KeepOutcome =
  | { kind: "kept"; savedAt: number; marks: string }
  | { kind: "off" | "signed-out" | "offline" | "too-big" | "busy" | "failed" };

export type DropOutcome = "dropped" | "signed-out" | "offline" | "failed";

/** A whole marks file can take a while on a slow connection. */
const COPY_MS = 60_000;
/** Each newer copy that beats this one means one more fetch and merge. */
const TRIES = 3;

const why = (e: unknown): string => (e instanceof Error ? e.message : "");

/** The app's words for "there is no copy to offer here", as one. */
function offWord(reason: string): boolean {
  return reason === "off" || reason === "sign-in-off" || reason === "not-in-app";
}

type Held = { marks: BookmarkFile; number: number; savedAt: number };

/** hifth.app's reply to a fetch, or null when it is not one. */
function readHeld(value: unknown): Held | null {
  if (typeof value !== "string") return null;
  let reply: unknown;
  try {
    reply = JSON.parse(value);
  } catch {
    return null;
  }
  if (!reply || typeof reply !== "object") return null;
  const { marks, number, savedAt } = reply as Record<string, unknown>;
  if (!Number.isInteger(number) || (number as number) < 1 || typeof savedAt !== "number") return null;
  const file = parseBookmarkFile(JSON.stringify(marks));
  return file ? { marks: file, number: number as number, savedAt } : null;
}

/** When hifth.app says it kept the copy. A garbled reply still means it was kept. */
function savedAtOf(reply: unknown): number | null {
  if (typeof reply !== "string") return null;
  try {
    const savedAt = (JSON.parse(reply) as { savedAt?: unknown } | null)?.savedAt;
    return typeof savedAt === "number" ? savedAt : null;
  } catch {
    return null;
  }
}

type Fetched = { held: Held | null } | { failed: Exclude<KeepOutcome["kind"], "kept"> };

async function fetchHeld(ask: Ask): Promise<Fetched> {
  try {
    const held = readHeld(await ask("marks-fetch", { waitMs: COPY_MS }));
    return held ? { held } : { failed: "failed" };
  } catch (e) {
    const reason = why(e);
    if (reason === "no-copy") return { held: null };
    if (offWord(reason)) return { failed: "off" };
    if (reason === "signed-out" || reason === "offline") return { failed: reason };
    return { failed: "failed" };
  }
}

export async function copyState(ask: Ask = askApp): Promise<CopyState> {
  try {
    const held = readHeld(await ask("marks-fetch", { waitMs: COPY_MS }));
    return held ? { kind: "kept", savedAt: held.savedAt } : { kind: "unknown" };
  } catch (e) {
    const reason = why(e);
    if (reason === "no-copy") return { kind: "none" };
    // Signed out: the section offers sign-in instead, and says nothing of a copy.
    if (offWord(reason) || reason === "signed-out") return { kind: "off" };
    return { kind: "unknown" };
  }
}

/** `local` is this device's marks file, as the page writes it for "Save my marks". */
export async function keepCopy(local: string, ask: Ask = askApp, now: () => number = Date.now): Promise<KeepOutcome> {
  const mine = parseBookmarkFile(local);
  if (!mine) return { kind: "failed" };
  for (let tries = 0; tries < TRIES; tries++) {
    const fetched = await fetchHeld(ask);
    if ("failed" in fetched) return { kind: fetched.failed };
    const { held } = fetched;
    const both = held ? mergeMarkFiles(mine, held.marks, now()) : mine;
    const text = JSON.stringify(both);
    try {
      const reply = await ask("marks-keep", {
        waitMs: COPY_MS,
        text: JSON.stringify({ marks: both, after: held?.number ?? 0 }),
      });
      return { kind: "kept", savedAt: savedAtOf(reply) ?? now(), marks: text };
    } catch (e) {
      const reason = why(e);
      if (reason === "newer-copy") continue;
      if (offWord(reason)) return { kind: "off" };
      if (reason === "signed-out" || reason === "offline" || reason === "too-big") return { kind: reason };
      return { kind: "failed" };
    }
  }
  return { kind: "busy" };
}

/** Takes the copy off hifth.app. The account and this device's marks stay. */
export async function dropCopy(ask: Ask = askApp): Promise<DropOutcome> {
  try {
    return (await ask("marks-drop", { waitMs: COPY_MS })) === "dropped" ? "dropped" : "failed";
  } catch (e) {
    const reason = why(e);
    return reason === "signed-out" || reason === "offline" ? reason : "failed";
  }
}
