import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { dropBookmark, toBookmarkFile } from "@hifth/core";
import { loadAccountWords } from "../account-words";
import { clearFaults, recentFaults } from "../fault-log";
import { Account } from "./Account";

/*
 * Sign-in step 16: the account section in the info panel. The reader decides
 * who sees their data, so the sentence saying what leaves the device and who
 * sees it is on the screen whenever the sign-in button is, deleting the account
 * is offered wherever signing in is, and an invite code a tester types is
 * handed to the app and kept nowhere on the page.
 *
 * The app is played by a stand-in that answers from a script. Every code here
 * is made up.
 */

// The section's own word pack (account-words.ts), fetched here as the section fetches it.
const AR = await loadAccountWords("ar");
const CODE = "MADE-UP-CODE-7421";

type Reply = { value: unknown } | { error: string } | { hold: true };
type Asked = { name: string; text: string | undefined };

function app(replies: Record<string, Reply | Reply[]>) {
  const asked: Asked[] = [];
  const held: Array<(v: unknown) => void> = [];
  const queues = new Map(Object.entries(replies).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]));
  const ask = (name: string, { text }: { waitMs?: number; text?: string } = {}): Promise<unknown> => {
    asked.push({ name, text });
    const queue = queues.get(name) ?? [];
    const reply = queue.length > 1 ? queue.shift() : queue[0];
    if (!reply) return Promise.reject(new Error("not-in-app"));
    if ("hold" in reply) return new Promise((resolve) => held.push(resolve));
    return "value" in reply ? Promise.resolve(reply.value) : Promise.reject(new Error(reply.error));
  };
  return { ask, asked, names: () => asked.map((a) => a.name), release: (v: unknown) => held.shift()?.(v) };
}

const button = (name: string) => screen.findByRole("button", { name });
const press = async (name: string) => fireEvent.click(await button(name));

/** Everywhere on the page a typed code could have been left behind. */
function whereACodeCouldStay(): string {
  const boxes = Array.from(document.querySelectorAll("input, textarea")).map((b) => (b as HTMLInputElement).value);
  return JSON.stringify([
    document.body.innerHTML,
    boxes,
    { ...localStorage },
    { ...sessionStorage },
    recentFaults(),
    location.href,
  ]);
}

afterEach(() => {
  clearFaults();
  localStorage.clear();
  sessionStorage.clear();
});

describe("the account section, when sign-in is not offered", () => {
  it("draws nothing before the app answers", () => {
    const { container } = render(<Account ask={app({ account: { hold: true } }).ask} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([{ value: "off" }, { error: "not-in-app" }, { error: "no-answer" }] as const)(
    "draws nothing when the app says %j",
    async (reply) => {
      const fake = app({ account: reply });
      const { container } = render(<Account ask={fake.ask} />);
      await waitFor(() => expect(fake.names()).toContain("account"));
      await new Promise((r) => setTimeout(r, 0));
      expect(container).toBeEmptyDOMElement();
    },
  );
});

describe("the account section, signed out", () => {
  it("says what leaves the device and who sees it, right where the sign-in button is", async () => {
    render(<Account ask={app({ account: { value: "signed-out" }, "invite-kept": { value: "no" } }).ask} />);
    const signIn = await button(AR.accountSignIn);
    expect(screen.getByRole("heading", { name: AR.accountTitle })).toBeTruthy();
    expect(screen.getByText(AR.accountOptional)).toBeTruthy();
    const says = screen.getByText(AR.accountLeaves);
    expect(signIn.getAttribute("aria-describedby")).toBe(says.id);
    expect(says.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: AR.accountDelete })).toBeNull();
  });

  it("signs in, then shows what hifth.app keeps, with sign out and delete beside it", async () => {
    const fake = app({
      account: [{ value: "signed-out" }, { value: "signed-in" }],
      "invite-kept": { value: "no" },
      "sign-in": { value: "signed-in" },
    });
    render(<Account ask={fake.ask} />);
    await press(AR.accountSignIn);
    expect(await screen.findByText(AR.accountSignedIn)).toBeTruthy();
    expect(screen.getByText(AR.accountHeld)).toBeTruthy();
    expect(screen.getByRole("button", { name: AR.accountSignOut })).toBeTruthy();
    expect(screen.getByRole("button", { name: AR.accountDelete })).toBeTruthy();
    expect(screen.queryByRole("button", { name: AR.accountSignIn })).toBeNull();
    expect(fake.asked.find((a) => a.name === "sign-in")?.text).toBeUndefined();
  });

  it("says nothing when the reader closes Apple's panel", async () => {
    const fake = app({ account: { value: "signed-out" }, "invite-kept": { value: "no" }, "sign-in": { error: "cancelled" } });
    render(<Account ask={fake.ask} />);
    await press(AR.accountSignIn);
    await waitFor(() => expect(fake.names().filter((n) => n === "account")).toHaveLength(2));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([
    ["too-many", "accountTooMany"],
    ["offline", "accountOffline"],
    ["server-error", "accountFailed"],
  ] as const)("the app says %s: one plain line", async (error, key) => {
    render(<Account ask={app({ account: { value: "signed-out" }, "invite-kept": { value: "no" }, "sign-in": { error } }).ask} />);
    await press(AR.accountSignIn);
    expect((await screen.findByRole("status")).textContent).toBe(AR[key]);
    expect(screen.getByRole("button", { name: AR.accountSignIn })).toBeTruthy();
  });

  it("lets nothing be pressed while the app is being asked", async () => {
    const fake = app({ account: { value: "signed-out" }, "invite-kept": { value: "no" }, "sign-in": { hold: true } });
    render(<Account ask={fake.ask} />);
    await press(AR.accountSignIn);
    const signIn = (await button(AR.accountSignIn)) as HTMLButtonElement;
    await waitFor(() => expect(signIn.disabled).toBe(true));
    fireEvent.click(signIn);
    expect(fake.names().filter((n) => n === "sign-in")).toHaveLength(1);
  });
});

describe("the invite code a tester types", () => {
  const needs = (after: Reply) =>
    app({
      account: { value: "signed-out" },
      "invite-kept": { value: "no" },
      "sign-in": [{ error: "invite-needed" }, after],
    });

  async function typeAndSend(fake: ReturnType<typeof app>): Promise<void> {
    render(<Account ask={fake.ask} />);
    await press(AR.accountSignIn);
    const box = (await screen.findByRole("textbox", { name: AR.accountInviteLabel })) as HTMLInputElement;
    expect(screen.getByText(AR.accountInviteHelp)).toBeTruthy();
    expect(box.getAttribute("autocomplete")).toBe("off");
    expect(box.getAttribute("autocorrect")).toBe("off");
    expect(box.getAttribute("autocapitalize")).toBe("off");
    expect(box.getAttribute("spellcheck")).toBe("false");
    fireEvent.input(box, { target: { value: CODE } });
    await press(AR.accountSignIn);
    await waitFor(() => expect(fake.asked.filter((a) => a.name === "sign-in")).toHaveLength(2));
  }

  it("is asked for only when the app says a code is needed, and goes to the app", async () => {
    const fake = needs({ value: "signed-in" });
    await typeAndSend(fake);
    expect(fake.asked.filter((a) => a.name === "sign-in").map((a) => a.text)).toEqual([undefined, CODE]);
  });

  it.each([
    ["taken", { value: "signed-in" }],
    ["refused", { error: "invite-needed" }],
    ["never answered", { error: "no-answer" }],
    ["failed", { error: "server-error" }],
  ] as const)("stays nowhere on the page once sent (%s)", async (_what, after) => {
    const fake = needs(after);
    await typeAndSend(fake);
    await waitFor(() => expect(fake.names().filter((n) => n === "account").length).toBeGreaterThanOrEqual(3));
    expect(whereACodeCouldStay()).not.toContain(CODE);
  });

  it("says so when the code is not accepted, and keeps the box for another try", async () => {
    await typeAndSend(needs({ error: "invite-needed" }));
    expect((await screen.findByRole("status")).textContent).toBe(AR.accountInviteRefused);
    expect((screen.getByRole("textbox", { name: AR.accountInviteLabel }) as HTMLInputElement).value).toBe("");
  });

  it("can be forgotten, from a line that says the device keeps it", async () => {
    const fake = app({
      account: { value: "signed-out" },
      "invite-kept": [{ value: "yes" }, { value: "no" }],
      "forget-invite": { value: "forgotten" },
    });
    render(<Account ask={fake.ask} />);
    expect(await screen.findByText(AR.accountInviteKept)).toBeTruthy();
    await press(AR.accountForgetInvite);
    await waitFor(() => expect(screen.queryByText(AR.accountInviteKept)).toBeNull());
    expect(fake.names()).toContain("forget-invite");
    expect(screen.queryByRole("button", { name: AR.accountForgetInvite })).toBeNull();
  });
});

describe("the account section, signed in", () => {
  const signedIn = (more: Record<string, Reply | Reply[]>, then: Reply = { value: "signed-out" }) =>
    app({ account: [{ value: "signed-in" }, then], "invite-kept": { value: "no" }, ...more });

  it("signs out on this device", async () => {
    const fake = signedIn({ "sign-out": { value: "signed-out" } });
    render(<Account ask={fake.ask} />);
    await press(AR.accountSignOut);
    expect(await button(AR.accountSignIn)).toBeTruthy();
    expect(screen.queryByText(AR.accountSignedIn)).toBeNull();
  });

  it("says so when signing out did not work", async () => {
    render(<Account ask={signedIn({ "sign-out": { error: "busy" } }, { value: "signed-in" }).ask} />);
    await press(AR.accountSignOut);
    expect((await screen.findByRole("status")).textContent).toBe(AR.accountSignOutFailed);
  });

  it("asks before deleting, says what is deleted and what is not, and can be backed out of", async () => {
    const fake = signedIn({ "delete-account": { value: "deleted-cut" } });
    render(<Account ask={fake.ask} />);
    await press(AR.accountDelete);
    expect(await screen.findByText(AR.accountDeleteAsk)).toBeTruthy();
    expect(fake.names()).not.toContain("delete-account");
    await press(AR.accountDeleteNo);
    await waitFor(() => expect(screen.queryByText(AR.accountDeleteAsk)).toBeNull());
    expect(fake.names()).not.toContain("delete-account");
    expect(screen.getByRole("button", { name: AR.accountDelete })).toBeTruthy();
  });

  it.each([
    [{ value: "deleted-cut" }, "accountDeletedCut", { value: "signed-out" }],
    [{ value: "deleted-left" }, "accountDeletedLeft", { value: "signed-out" }],
    [{ error: "signed-out" }, "accountDeleteSignedOut", { value: "signed-out" }],
    [{ error: "offline" }, "accountDeleteOffline", { value: "signed-in" }],
    [{ error: "server-error" }, "accountDeleteFailed", { value: "signed-in" }],
  ] as const)("the app answers %j to the delete: the section says so", async (reply, key, then) => {
    const fake = signedIn({ "delete-account": reply }, then);
    render(<Account ask={fake.ask} />);
    await press(AR.accountDelete);
    await press(AR.accountDeleteYes);
    expect((await screen.findByRole("status")).textContent).toBe(AR[key]);
    expect(fake.names().filter((n) => n === "delete-account")).toHaveLength(1);
    expect(screen.queryByText(AR.accountDeleteAsk)).toBeNull();
  });

  it("says it keeps none of the reader's marks when no copy is offered", async () => {
    render(<Account ask={signedIn({}, { value: "signed-in" }).ask} marks={marksHere()} />);
    expect(await screen.findByText(AR.accountHeldNoMarks)).toBeTruthy();
    expect(screen.queryByRole("button", { name: AR.accountCopyKeep })).toBeNull();
  });

  it("still says the account is deleted when sign-in is then no longer offered", async () => {
    const fake = signedIn({ "delete-account": { value: "deleted-left" } }, { value: "off" });
    render(<Account ask={fake.ask} />);
    await press(AR.accountDelete);
    await press(AR.accountDeleteYes);
    expect((await screen.findByRole("status")).textContent).toBe(AR.accountDeletedLeft);
    expect(screen.queryByRole("button", { name: AR.accountSignIn })).toBeNull();
  });
});

/** This device's marks, played by a made-up file; `loaded` is every text the section handed back. */
function marksHere() {
  const loaded: string[] = [];
  const file = JSON.stringify(
    toBookmarkFile(dropBookmark([], { key: "quran/hafs-kfqc/2:255", page: 42, name: "made-up" }, 1_000), 1_500),
  );
  return { file: () => file, load: (text: string) => void loaded.push(text), loaded };
}

describe("the copy of the reader's marks on hifth.app (sign-in step 21c)", () => {
  const there = toBookmarkFile(dropBookmark([], { key: "quran/hafs-kfqc/3:1", page: 50, name: "there" }, 2_000), 2_500);
  const held = (savedAt: number) => ({ value: JSON.stringify({ marks: there, number: 2, savedAt }) });
  const copyApp = (more: Record<string, Reply | Reply[]>) =>
    app({ account: { value: "signed-in" }, "invite-kept": { value: "no" }, ...more });

  it("says what keeping a copy sends and who could read it, right where the button is", async () => {
    render(<Account ask={copyApp({ "marks-fetch": { error: "no-copy" } }).ask} marks={marksHere()} />);
    const keep = await button(AR.accountCopyKeep);
    const says = screen.getByText(AR.accountCopyLeaves);
    expect(keep.getAttribute("aria-describedby")).toBe(says.id);
    expect(says.compareDocumentPosition(keep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(AR.accountHeldNoMarks)).toBeTruthy();
    expect(screen.queryByRole("button", { name: AR.accountCopyDrop })).toBeNull();
  });

  it("names the day the copy was last kept, and offers to delete it", async () => {
    render(<Account ask={copyApp({ "marks-fetch": held(Date.UTC(2026, 10, 18, 12)) }).ask} marks={marksHere()} />);
    expect(await screen.findByText(AR.accountCopyKept(Date.UTC(2026, 10, 18, 12)))).toBeTruthy();
    expect(screen.queryByText(AR.accountHeldNoMarks)).toBeNull();
    expect(screen.getByRole("button", { name: AR.accountCopyDrop })).toBeTruthy();
  });

  it("draws no copy button where the page has no marks to send", async () => {
    render(<Account ask={copyApp({ "marks-fetch": { error: "no-copy" } }).ask} />);
    expect(await screen.findByText(AR.accountSignedIn)).toBeTruthy();
    expect(screen.queryByRole("button", { name: AR.accountCopyKeep })).toBeNull();
  });

  it("keeps a copy, then loads what came back on this device and says so", async () => {
    const marks = marksHere();
    const fake = copyApp({
      "marks-fetch": [held(9_000), held(9_000), held(10_000)],
      "marks-keep": { value: JSON.stringify({ number: 3, savedAt: 10_000 }) },
    });
    render(<Account ask={fake.ask} marks={marks} />);
    await press(AR.accountCopyKeep);
    expect((await screen.findByRole("status")).textContent).toBe(AR.accountCopyDone);
    expect(marks.loaded).toHaveLength(1);
    const back = JSON.parse(marks.loaded[0]!) as { bookmarks: { name: string }[] };
    expect(back.bookmarks.map((b) => b.name).sort()).toEqual(["made-up", "there"]);
  });

  it.each([
    [{ error: "busy" }, "accountCopyBusy", "newer-copy"],
    [{ error: "too-big" }, "accountCopyTooBig", "too-big"],
    [{ error: "signed-out" }, "accountCopySignedOut", "signed-out"],
    [{ error: "offline" }, "accountOffline", "offline"],
    [{ error: "server-error" }, "accountCopyFailed", "server-error"],
  ] as const)("when keeping fails (%j), the section says so and loads nothing", async (_shown, key, error) => {
    const marks = marksHere();
    render(<Account ask={copyApp({ "marks-fetch": { error: "no-copy" }, "marks-keep": { error } }).ask} marks={marks} />);
    await press(AR.accountCopyKeep);
    expect((await screen.findByRole("status")).textContent).toBe(AR[key]);
    expect(marks.loaded).toEqual([]);
  });

  it("asks before deleting the copy, and can be backed out of", async () => {
    const fake = copyApp({ "marks-fetch": held(9_000), "marks-drop": { value: "dropped" } });
    render(<Account ask={fake.ask} marks={marksHere()} />);
    await press(AR.accountCopyDrop);
    expect(await screen.findByText(AR.accountCopyDropAsk)).toBeTruthy();
    await press(AR.accountCopyDropNo);
    await waitFor(() => expect(screen.queryByText(AR.accountCopyDropAsk)).toBeNull());
    expect(fake.names()).not.toContain("marks-drop");
  });

  it.each([
    [{ value: "dropped" }, "accountCopyDropped"],
    [{ error: "signed-out" }, "accountCopyDropSignedOut"],
    [{ error: "offline" }, "accountDeleteOffline"],
    [{ error: "server-error" }, "accountCopyDropFailed"],
  ] as const)("the app answers %j to deleting the copy: the section says so", async (reply, key) => {
    const fake = copyApp({ "marks-fetch": [held(9_000), { error: "no-copy" }], "marks-drop": reply });
    render(<Account ask={fake.ask} marks={marksHere()} />);
    await press(AR.accountCopyDrop);
    await press(AR.accountCopyDropYes);
    expect((await screen.findByRole("status")).textContent).toBe(AR[key]);
    expect(fake.names().filter((n) => n === "marks-drop")).toHaveLength(1);
  });

  it("keeps the marks it carries nowhere on the page", async () => {
    const marks = marksHere();
    render(
      <Account
        ask={copyApp({ "marks-fetch": { error: "no-copy" }, "marks-keep": { value: JSON.stringify({ number: 1, savedAt: 1 }) } }).ask}
        marks={marks}
      />,
    );
    await press(AR.accountCopyKeep);
    await screen.findByRole("status");
    expect(whereACodeCouldStay()).not.toContain("made-up");
  });
});
