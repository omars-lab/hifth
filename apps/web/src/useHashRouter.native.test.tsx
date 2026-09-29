import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { AppState } from "@hifth/core";
import { useHashRouter } from "./useHashRouter";

/**
 * The shell has no address bar, so the hash router tells it two things: when
 * the app is ready to take a route, and every route it then shows. Those two
 * messages are what the shell's route label, window title, screenshots and
 * native tests all hang off, so they are pinned here at the hook.
 */

type Shelled = Window & {
  __HIFTH_NATIVE__?: unknown;
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (m: unknown) => void }>;
  };
};
const w = window as Shelled;

afterEach(() => {
  delete w.__HIFTH_NATIVE__;
  delete w.webkit;
  window.history.replaceState(null, "", "#");
});

describe("useHashRouter in the native shell", () => {
  it("posts ready on the ready edge, then every route it writes", () => {
    const sent: unknown[] = [];
    w.__HIFTH_NATIVE__ = { platform: "ios", publicBase: "https://x/" };
    w.webkit = {
      messageHandlers: { hifth: { postMessage: (m) => sent.push(m) } },
    };

    const a: AppState = {
      edition: "hafs-kfqc",
      select: { surah: 2, ayah: 255 },
    };
    const b: AppState = { edition: "hafs-kfqc", select: null, page: 45 };
    const { rerender } = renderHook(
      ({ state, ready }: { state: AppState | null; ready: boolean }) =>
        useHashRouter(state, () => {}, ready),
      { initialProps: { state: null as AppState | null, ready: false } },
    );
    expect(sent).toEqual([]);

    rerender({ state: a, ready: true });
    rerender({ state: b, ready: true });

    expect(sent).toEqual([
      { type: "ready" },
      { type: "route", hash: "#/hafs-kfqc/2:255" },
      { type: "route", hash: "#/hafs-kfqc/p45" },
    ]);
  });
});
