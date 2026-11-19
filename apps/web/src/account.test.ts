import { describe, expect, it } from "vitest";
import { accountState, deleteAccount, forgetInvite, inviteKept, signIn, signOut } from "./account";

/*
 * Sign-in step 16: what the account section shows for each answer the app can
 * give. The app is played by a stand-in that answers from a script and writes
 * down every question, so each case reads as "the app says this, the section
 * shows that". Every code here is made up.
 */

type Reply = { value: unknown } | { error: string };
type Asked = { name: string; text: string | undefined; waitMs: number | undefined };

function app(replies: Record<string, Reply | Reply[]>) {
  const asked: Asked[] = [];
  const queues = new Map(Object.entries(replies).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]));
  const ask = (name: string, { waitMs, text }: { waitMs?: number; text?: string } = {}): Promise<unknown> => {
    asked.push({ name, text, waitMs });
    const queue = queues.get(name) ?? [];
    const reply = queue.length > 1 ? queue.shift() : queue[0];
    if (!reply) return Promise.reject(new Error("not-in-app"));
    return "value" in reply ? Promise.resolve(reply.value) : Promise.reject(new Error(reply.error));
  };
  return { ask, asked };
}

describe("is there an account section at all?", () => {
  it.each([
    [{ value: "signed-in" }, "signed-in"],
    [{ value: "signed-out" }, "signed-out"],
    [{ value: "off" }, "off"],
    [{ value: "a-word-from-a-later-app" }, "off"],
    [{ error: "not-in-app" }, "off"],
    [{ error: "no-answer" }, "off"],
  ] as const)("the app says %j, the section is %s", async (reply, shown) => {
    expect(await accountState(app({ account: reply }).ask)).toBe(shown);
  });

  it("gives up on an app that never answers", async () => {
    const { ask, asked } = app({ account: { value: "off" } });
    await accountState(ask);
    expect(asked[0]?.waitMs).toBeGreaterThan(0);
  });
});

describe("signing in", () => {
  it("asks with no code first, and waits long enough for a person at Apple's panel", async () => {
    const { ask, asked } = app({ "sign-in": { value: "signed-in" } });
    expect(await signIn(undefined, ask)).toBe("signed-in");
    expect(asked).toHaveLength(1);
    expect(asked[0]?.text).toBeUndefined();
    expect(asked[0]?.waitMs).toBeGreaterThanOrEqual(120_000);
  });

  it("says nothing when the reader closes Apple's panel", async () => {
    expect(await signIn(undefined, app({ "sign-in": { error: "cancelled" } }).ask)).toBe("nothing");
  });

  it("asks for an invite code when one is needed, and says so when a typed one is not taken", async () => {
    const needs = app({ "sign-in": { error: "invite-needed" } });
    expect(await signIn(undefined, needs.ask)).toBe("invite");
    expect(await signIn("   ", needs.ask)).toBe("invite");
    expect(await signIn(" MADE-UP-CODE ", needs.ask)).toBe("invite-refused");
    expect(needs.asked.map((a) => a.text)).toEqual([undefined, undefined, "MADE-UP-CODE"]);
  });

  it.each([
    ["too-many", "too-many"],
    ["offline", "offline"],
    ["server-error", "failed"],
    ["bad-reply", "failed"],
    ["sign-in-off", "failed"],
    ["no-window", "failed"],
    ["not-available", "failed"],
    ["refused:made-up-reason", "failed"],
    ["a-word-from-a-later-app", "failed"],
    ["not-in-app", "failed"],
  ] as const)("the app says %s, the section shows %s", async (error, shown) => {
    expect(await signIn(undefined, app({ "sign-in": { error } }).ask)).toBe(shown);
  });

  it("an answer that is not 'signed-in' is not a sign-in", async () => {
    expect(await signIn(undefined, app({ "sign-in": { value: "yes" } }).ask)).toBe("failed");
  });

  it("when a sign-in is already on its way, or the wait runs out, it asks what the app now holds", async () => {
    const busyIn = app({ "sign-in": { error: "busy" }, account: { value: "signed-in" } });
    expect(await signIn(undefined, busyIn.ask)).toBe("signed-in");
    expect(busyIn.asked.map((a) => a.name)).toEqual(["sign-in", "account"]);
    expect(await signIn(undefined, app({ "sign-in": { error: "busy" }, account: { value: "signed-out" } }).ask)).toBe("nothing");
    expect(await signIn(undefined, app({ "sign-in": { error: "no-answer" }, account: { value: "signed-in" } }).ask)).toBe("signed-in");
    expect(await signIn(undefined, app({ "sign-in": { error: "no-answer" }, account: { value: "signed-out" } }).ask)).toBe("failed");
  });
});

describe("signing out", () => {
  it("is done when the app says so, and not otherwise", async () => {
    expect(await signOut(app({ "sign-out": { value: "signed-out" } }).ask)).toBe(true);
    expect(await signOut(app({ "sign-out": { error: "busy" } }).ask)).toBe(false);
    expect(await signOut(app({}).ask)).toBe(false);
  });
});

describe("deleting the account", () => {
  it.each([
    [{ value: "deleted-cut" }, "deleted-cut"],
    [{ value: "deleted-left" }, "deleted-left"],
    [{ value: "deleted" }, "failed"],
    [{ error: "signed-out" }, "signed-out"],
    [{ error: "offline" }, "offline"],
    [{ error: "server-error" }, "failed"],
    [{ error: "busy" }, "failed"],
  ] as const)("the app says %j, the section shows %s", async (reply, shown) => {
    expect(await deleteAccount(app({ "delete-account": reply }).ask)).toBe(shown);
  });

  it("when the wait runs out, it asks what the app now holds and never claims a deletion it did not hear", async () => {
    const gone = app({ "delete-account": { error: "no-answer" }, account: { value: "signed-out" } });
    expect(await deleteAccount(gone.ask)).toBe("signed-out");
    expect(gone.asked.map((a) => a.name)).toEqual(["delete-account", "account"]);
    expect(await deleteAccount(app({ "delete-account": { error: "no-answer" }, account: { value: "signed-in" } }).ask)).toBe("failed");
  });
});

describe("the kept invite code", () => {
  it("hears only yes or no", async () => {
    expect(await inviteKept(app({ "invite-kept": { value: "yes" } }).ask)).toBe(true);
    expect(await inviteKept(app({ "invite-kept": { value: "no" } }).ask)).toBe(false);
    expect(await inviteKept(app({ "invite-kept": { value: "MADE-UP-CODE" } }).ask)).toBe(false);
    expect(await inviteKept(app({}).ask)).toBe(false);
  });

  it("is forgotten when the app says so", async () => {
    expect(await forgetInvite(app({ "forget-invite": { value: "forgotten" } }).ask)).toBe(true);
    expect(await forgetInvite(app({ "forget-invite": { error: "busy" } }).ask)).toBe(false);
  });
});
