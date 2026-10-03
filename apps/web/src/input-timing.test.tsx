import { afterEach, describe, expect, it } from "vitest";
import { useEffect, useRef, useState } from "react";
import { cleanup, render } from "@testing-library/preact";
import { installInputTiming } from "./input-timing";

/**
 * A sheet that takes the keyboard the moment it opens, the way the jumper does:
 * `/` opens it, and its own effect moves focus into its field.
 */
function Sheet() {
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/") setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);
  return open ? <input ref={field} aria-label="Go to" /> : null;
}

/** Let the promise queue run dry, without letting a frame or a timer pass. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

afterEach(cleanup);

describe("what follows a tap or a key", () => {
  it("is done before the next key arrives, so a sheet already has focus", async () => {
    installInputTiming(window);
    render(<Sheet />);
    await settle();
    // The browser's own key event, not the testing helper's: the helper would
    // finish the follow-up work itself and hide the gap this is about.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    await settle();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Go to");
  });
});

describe("what follows anything else", () => {
  it("still waits for the next frame, so the page paints first", async () => {
    installInputTiming(window);
    function Later() {
      const [shown, setShown] = useState(false);
      const field = useRef<HTMLInputElement>(null);
      useEffect(() => {
        const id = setTimeout(() => setShown(true), 0);
        return () => clearTimeout(id);
      }, []);
      useEffect(() => {
        if (shown) field.current?.focus();
      }, [shown]);
      return shown ? <input ref={field} aria-label="Later" /> : null;
    }
    render(<Later />);
    await new Promise((r) => setTimeout(r, 1));
    await settle();
    // Drawn, but its after-drawing work is still waiting for the frame.
    expect(document.querySelector("[aria-label='Later']")).not.toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).not.toBe("Later");
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Later");
  });
});
