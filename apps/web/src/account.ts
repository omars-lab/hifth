import { askApp } from "./ask-app";

/*
 * The account section's questions to the app (sign-in step 16,
 * docs/design/sign-in.md), with no drawing: each one turns the app's answer,
 * a failure included, into the one thing the section should show.
 *
 * Nothing here throws, and nothing here keeps or logs what it is handed. The
 * invite code a tester types passes through `signIn` to the app and is not
 * held, stored or put in an error: the app's failures are short names it picks
 * itself ("offline", "too-many"), never words the reader typed.
 */

type Ask = typeof askApp;

/** "off": this build shows no account section at all. */
export type AccountState = "off" | "signed-out" | "signed-in";

/**
 * What a sign-in try ends in. "nothing": the reader closed Apple's panel, so
 * the section says nothing. "invite": show the box for an invite code.
 * "invite-refused": a typed code was not taken.
 */
export type SignInOutcome = "signed-in" | "nothing" | "invite" | "invite-refused" | "too-many" | "offline" | "failed";

/** "cut": Apple dropped its side too. "left": the reader removes Hifth in Apple's settings. */
export type DeleteOutcome = "deleted-cut" | "deleted-left" | "signed-out" | "offline" | "failed";

/** A question the app answers by itself, with no person in the way. */
const QUICK_MS = 15_000;
/** Signing in waits on a person at Apple's panel, then on hifth.app. */
const SIGN_IN_MS = 5 * 60_000;
/** Deleting waits on hifth.app, which waits on Apple. */
const DELETE_MS = 60_000;

const why = (e: unknown): string => (e instanceof Error ? e.message : "");

export async function accountState(ask: Ask = askApp): Promise<AccountState> {
  try {
    const answer = await ask("account", { waitMs: QUICK_MS });
    return answer === "signed-in" || answer === "signed-out" ? answer : "off";
  } catch {
    return "off";
  }
}

export async function signIn(code?: string, ask: Ask = askApp): Promise<SignInOutcome> {
  const typed = code?.trim() ?? "";
  try {
    const answer = await ask("sign-in", typed === "" ? { waitMs: SIGN_IN_MS } : { waitMs: SIGN_IN_MS, text: typed });
    return answer === "signed-in" ? "signed-in" : "failed";
  } catch (e) {
    switch (why(e)) {
      case "cancelled":
        return "nothing";
      case "invite-needed":
        return typed === "" ? "invite" : "invite-refused";
      case "too-many":
        return "too-many";
      case "offline":
        return "offline";
      case "busy":
        // Another sign-in is already on its way; say what the app now holds.
        return (await accountState(ask)) === "signed-in" ? "signed-in" : "nothing";
      case "no-answer":
        return (await accountState(ask)) === "signed-in" ? "signed-in" : "failed";
      default:
        return "failed";
    }
  }
}

/** `true` once this device is signed out. */
export async function signOut(ask: Ask = askApp): Promise<boolean> {
  try {
    return (await ask("sign-out", { waitMs: QUICK_MS })) === "signed-out";
  } catch {
    return false;
  }
}

export async function deleteAccount(ask: Ask = askApp): Promise<DeleteOutcome> {
  try {
    const answer = await ask("delete-account", { waitMs: DELETE_MS });
    return answer === "deleted-cut" || answer === "deleted-left" ? answer : "failed";
  } catch (e) {
    const reason = why(e);
    if (reason === "signed-out" || reason === "offline") return reason;
    // The wait ran out. The app may still have finished, so say only what it
    // now holds: signed out (sign in again to be sure), or still signed in.
    if (reason === "no-answer" && (await accountState(ask)) === "signed-out") return "signed-out";
    return "failed";
  }
}

/** Whether this device keeps an invite code. Never the code. */
export async function inviteKept(ask: Ask = askApp): Promise<boolean> {
  try {
    return (await ask("invite-kept", { waitMs: QUICK_MS })) === "yes";
  } catch {
    return false;
  }
}

/** `true` once the app has forgotten the code. */
export async function forgetInvite(ask: Ask = askApp): Promise<boolean> {
  try {
    return (await ask("forget-invite", { waitMs: QUICK_MS })) === "forgotten";
  } catch {
    return false;
  }
}
