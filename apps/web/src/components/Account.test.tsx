import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { stringsFor } from "../i18n";
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

const AR = stringsFor("ar");
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

  it("still says the account is deleted when sign-in is then no longer offered", async () => {
    const fake = signedIn({ "delete-account": { value: "deleted-left" } }, { value: "off" });
    render(<Account ask={fake.ask} />);
    await press(AR.accountDelete);
    await press(AR.accountDeleteYes);
    expect((await screen.findByRole("status")).textContent).toBe(AR.accountDeletedLeft);
    expect(screen.queryByRole("button", { name: AR.accountSignIn })).toBeNull();
  });
});
