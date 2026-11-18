import { afterEach, describe, expect, it, vi } from "vitest";
import {
  askApp,
  exposeToShell,
  isNative,
  nativeShare,
  postReady,
  postRoute,
  shareBase,
  type NativeMessage,
} from "./native-bridge";

/**
 * The bridge is the one place the web app learns it is inside the Mac or iPad
 * shell. The shell injects `window.__HIFTH_NATIVE__` at document start and
 * listens on one WebKit message handler named `hifth`; everything the page
 * needs to know about the shell comes through that pair, so these tests pin
 * the pair's shape rather than any Swift.
 */

type Handler = { postMessage: (m: unknown) => void };
type Shelled = Window & {
  __HIFTH_NATIVE__?: unknown;
  webkit?: { messageHandlers?: Record<string, Handler> };
};

const w = window as Shelled;

function inShell(
  publicBase = "https://blog.bytesofpurpose.com/hifth/",
): NativeMessage[] {
  const sent: NativeMessage[] = [];
  w.__HIFTH_NATIVE__ = { platform: "ios", publicBase };
  w.webkit = {
    messageHandlers: {
      hifth: { postMessage: (m) => sent.push(m as NativeMessage) },
    },
  };
  return sent;
}

afterEach(() => {
  delete w.__HIFTH_NATIVE__;
  delete w.webkit;
  vi.restoreAllMocks();
});

describe("isNative", () => {
  it("is false in a browser", () => {
    expect(isNative()).toBe(false);
  });
  it("is true once the shell has injected its marker", () => {
    inShell();
    expect(isNative()).toBe(true);
  });
  it("ignores a marker with the wrong shape", () => {
    w.__HIFTH_NATIVE__ = { platform: "ios" }; // no publicBase
    expect(isNative()).toBe(false);
  });
});

describe("shareBase", () => {
  it("is this page's own address in a browser", () => {
    expect(shareBase()).toBe(window.location.origin + window.location.pathname);
  });
  it("is the public site inside the shell, never the shell's private origin", () => {
    inShell("https://blog.bytesofpurpose.com/hifth/");
    expect(shareBase()).toBe("https://blog.bytesofpurpose.com/hifth/");
    expect(shareBase()).not.toContain(window.location.origin);
  });
  it("always ends in a slash so a hash can be appended directly", () => {
    inShell("https://blog.bytesofpurpose.com/hifth");
    expect(shareBase()).toBe("https://blog.bytesofpurpose.com/hifth/");
  });
});

describe("nativeShare", () => {
  it("does nothing in a browser and says so", () => {
    expect(nativeShare({ url: "x", title: "t", text: "b" })).toBe(false);
  });
  it("hands the payload to the shell", () => {
    const sent = inShell();
    expect(nativeShare({ url: "https://x/#/a", title: "t", text: "b" })).toBe(
      true,
    );
    expect(sent).toEqual([
      { type: "share", url: "https://x/#/a", title: "t", text: "b" },
    ]);
  });
  it("is false, not a throw, when the shell has no handler installed", () => {
    w.__HIFTH_NATIVE__ = { platform: "macos", publicBase: "https://x/" };
    expect(nativeShare({ url: "u", title: "t", text: "b" })).toBe(false);
  });
});

describe("ready and route", () => {
  it("post nothing outside the shell", () => {
    const spy = vi.fn();
    w.webkit = { messageHandlers: { hifth: { postMessage: spy } } };
    postReady();
    postRoute("#/hafs-kfqc/2:255");
    expect(spy).not.toHaveBeenCalled();
  });
  it("tell the shell when the app can take a route, and every route it shows", () => {
    const sent = inShell();
    postReady();
    postRoute("#/hafs-kfqc/2:255");
    postRoute("#/hafs-kfqc/p45");
    expect(sent).toEqual([
      { type: "ready" },
      { type: "route", hash: "#/hafs-kfqc/2:255" },
      { type: "route", hash: "#/hafs-kfqc/p45" },
    ]);
  });
});

/**
 * The page asking the app a question and waiting for the answer (sign-in step
 * 7). The page posts `{type:"ask", id, name}`; the app answers later by
 * calling `window.__HIFTH_ANSWER__(id, answer)` from Swift. The id is what
 * ties an answer to its question, so these tests send answers out of order,
 * twice, and for questions nobody asked.
 */
describe("askApp", () => {
  type Answered = Window & {
    __HIFTH_ANSWER__?: (id: string, answer: unknown) => void;
  };
  const aw = window as Answered;
  const answer = (id: string, a: unknown) => aw.__HIFTH_ANSWER__?.(id, a);
  const asks = (sent: NativeMessage[]) =>
    sent.filter((m): m is Extract<NativeMessage, { type: "ask" }> => m.type === "ask");

  it("in a browser, posts nothing and says it is not in the app", async () => {
    const spy = vi.fn();
    w.webkit = { messageHandlers: { hifth: { postMessage: spy } } };
    await expect(askApp("ping")).rejects.toThrow("not-in-app");
    expect(spy).not.toHaveBeenCalled();
  });

  it("in the app, posts the question with an id and waits for that id's answer", async () => {
    const sent = inShell();
    const waiting = askApp("ping");
    const [ask] = asks(sent);
    expect(ask).toMatchObject({ type: "ask", name: "ping" });
    expect(typeof ask?.id).toBe("string");
    answer(ask!.id, { ok: true, value: "pong" });
    await expect(waiting).resolves.toBe("pong");
  });

  it("each answer reaches its own question, whatever order they come back in", async () => {
    const sent = inShell();
    const first = askApp("ping");
    const second = askApp("ping");
    const [a, b] = asks(sent);
    expect(a!.id).not.toBe(b!.id);
    answer(b!.id, { ok: true, value: "second" });
    answer(a!.id, { ok: true, value: "first" });
    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
  });

  it("an answer nobody is waiting for, or a second answer to the same question, is ignored", async () => {
    const sent = inShell();
    const waiting = askApp("ping");
    const [ask] = asks(sent);
    expect(() => answer("not-asked", { ok: true, value: "stray" })).not.toThrow();
    answer(ask!.id, { ok: true, value: "pong" });
    expect(() => answer(ask!.id, { ok: true, value: "again" })).not.toThrow();
    await expect(waiting).resolves.toBe("pong");
  });

  it("the app saying no rejects with its reason", async () => {
    const sent = inShell();
    const waiting = askApp("nothing-like-this");
    answer(asks(sent)[0]!.id, { ok: false, error: "unknown-question" });
    await expect(waiting).rejects.toThrow("unknown-question");
  });

  it("an answer of the wrong shape rejects rather than passing junk on", async () => {
    const sent = inShell();
    const waiting = askApp("ping");
    answer(asks(sent)[0]!.id, "pong");
    await expect(waiting).rejects.toThrow("bad-answer");
  });

  it("waits as long as it is told for each question, and gives up after that", async () => {
    vi.useFakeTimers();
    try {
      inShell();
      const waiting = askApp("ping", { waitMs: 1000 });
      const settled = expect(waiting).rejects.toThrow("no-answer");
      await vi.advanceTimersByTimeAsync(1000);
      await settled;
    } finally {
      vi.useRealTimers();
    }
  });

  it("the answer door is in place before the first question leaves, not tied to the page's own handlers", () => {
    inShell();
    let doorWhenPosted: unknown;
    w.webkit!.messageHandlers!.hifth = {
      postMessage: () => {
        doorWhenPosted = aw.__HIFTH_ANSWER__;
      },
    };
    void askApp("ping").catch(() => {});
    expect(typeof doorWhenPosted).toBe("function");
  });
});

/**
 * The one thing the shell asks of the page: turn it. The Mac's Page menu
 * (Next Page ⌘←, Previous Page ⌘→) has no keyboard event to send — the web
 * app ignores modified keys on purpose — so the page hands the shell a
 * function instead, and only inside the shell.
 */
describe("exposeToShell", () => {
  type Paged = Window & { __HIFTH_PAGE__?: { stepPage: (step: 1 | -1) => void } };
  const pw = window as Paged;
  afterEach(() => {
    delete pw.__HIFTH_PAGE__;
  });

  it("hands the page nothing outside the shell", () => {
    const stepPage = vi.fn();
    const away = exposeToShell({ stepPage, pencil: vi.fn() });
    expect(pw.__HIFTH_PAGE__).toBeUndefined();
    away();
  });

  it("in the shell, the page's turn is reachable by name, and taken away again", () => {
    inShell();
    const stepPage = vi.fn();
    const away = exposeToShell({ stepPage, pencil: vi.fn() });
    pw.__HIFTH_PAGE__?.stepPage(1);
    pw.__HIFTH_PAGE__?.stepPage(-1);
    expect(stepPage.mock.calls).toEqual([[1], [-1]]);
    away();
    expect(pw.__HIFTH_PAGE__).toBeUndefined();
  });

  it("a later exposure replaces the earlier one; the earlier teardown does not remove it", () => {
    inShell();
    const first = vi.fn();
    const second = vi.fn();
    const awayFirst = exposeToShell({ stepPage: first, pencil: vi.fn() });
    exposeToShell({ stepPage: second, pencil: vi.fn() });
    awayFirst();
    pw.__HIFTH_PAGE__?.stepPage(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(1);
  });

  it("in the shell, the pencil's gestures reach the page by name, as the app sends them", () => {
    inShell();
    const pencil = vi.fn();
    const away = exposeToShell({ stepPage: vi.fn(), pencil });
    (pw.__HIFTH_PAGE__ as unknown as { pencil: (e: unknown) => void }).pencil({ kind: "squeeze", pref: "palette", x: 1, y: 2 });
    expect(pencil).toHaveBeenCalledWith({ kind: "squeeze", pref: "palette", x: 1, y: 2 });
    away();
  });
});
