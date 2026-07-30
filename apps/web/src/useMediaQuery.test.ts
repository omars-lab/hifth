import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { DESKTOP_QUERY, useMediaQuery } from "./useMediaQuery";

/**
 * A controllable `matchMedia`. jsdom does not implement one, which is itself the
 * case the hook's `typeof` guards are for — so the no-stub case is tested first,
 * before anything is installed.
 */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: "",
    addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => listeners.add(l),
    removeEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => listeners.delete(l),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn((media: string) => {
      mql.media = media;
      return mql;
    }),
  );
  return {
    mql,
    listeners,
    /** Simulate the window crossing the breakpoint. */
    set(next: boolean) {
      mql.matches = next;
      for (const l of listeners) l({ matches: next } as MediaQueryListEvent);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DESKTOP_QUERY", () => {
  it("gates on height as well as width", () => {
    // Pinned deliberately. A mus'haf leaf is portrait, so a leaf's width comes
    // from the height the chrome leaves, not from the window's width — a
    // width-only query would put a spread in a 1024×700 window and hand each
    // leaf less page than a 320px phone gives. The arithmetic is in
    // docs/design/desktop.md §3; this test is here so that dropping the second
    // axis cannot be a silent edit.
    expect(DESKTOP_QUERY).toBe("(min-width: 1024px) and (min-height: 720px)");
  });

  it("is the same string DesktopChrome's media query is written with", () => {
    // The CSS cannot import it — a custom property is not allowed in a media
    // query — so the literal is duplicated and this reads the duplicate back.
    // The two drifting apart means the header's extra controls appear at a width
    // where the spread does not, or the reverse.
    // Read off disk rather than imported: a CSS module import hands back the
    // hashed class names, not the source, and the media query is exactly the
    // part that does not survive that transform. Resolved from `process.cwd()`
    // because vitest rewrites `import.meta.url` to an http URL.
    const css = readFileSync(resolve(process.cwd(), "src/components/DesktopChrome.module.css"), "utf8");
    expect(css).toContain(`@media ${DESKTOP_QUERY}`);
  });
});

describe("useMediaQuery", () => {
  it("answers false when the platform has no matchMedia", () => {
    // jsdom without a stub, an SSR pass, an old engine. False renders the phone
    // layout: one page, one mount, no extra bytes. Guessing the other way hands
    // a second ~170 KB SVG to a device on a feature-detection miss, which is the
    // one outcome the hook exists to prevent.
    expect(typeof window.matchMedia).not.toBe("function");
    const { result } = renderHook(() => useMediaQuery(DESKTOP_QUERY));
    expect(result.current).toBe(false);
  });

  it("reports a matching window on the first render, not a tick later", () => {
    // Read in the useState initialiser rather than an effect. Otherwise a desktop
    // window mounts the phone layout, then reflows into the spread — and the
    // reflow costs a second PageStage mount for a page that was going to be
    // mounted anyway.
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery(DESKTOP_QUERY));
    expect(result.current).toBe(true);
  });

  it("follows the window across the breakpoint in both directions", () => {
    const mm = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery(DESKTOP_QUERY));
    expect(result.current).toBe(false);
    act(() => mm.set(true));
    expect(result.current).toBe(true);
    act(() => mm.set(false));
    expect(result.current).toBe(false);
  });

  it("unsubscribes on unmount", () => {
    // The listener closes over a setState. Left attached, a resize after unmount
    // updates a dead component — React only warns about that in some versions,
    // so the leak is worth asserting rather than watching for.
    const mm = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery(DESKTOP_QUERY));
    expect(mm.listeners.size).toBe(1);
    unmount();
    expect(mm.listeners.size).toBe(0);
  });
});
