import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AppState } from "@hifth/core";
import { ShareSheet } from "./ShareSheet";

/**
 * Inside the Mac / iPad shell the page's own address is a private scheme
 * nobody else can open, and the page is not a secure context, so neither
 * `navigator.share` nor the clipboard exist. The share button must therefore
 * build the link from the public site and hand it to the shell's own sheet.
 * Outside the shell nothing here changes.
 */

type Shelled = Window & {
  __HIFTH_NATIVE__?: unknown;
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (m: unknown) => void }>;
  };
};
const w = window as Shelled;

const STATE: AppState = {
  edition: "hafs-kfqc",
  select: { surah: 2, ayah: 255 },
};

afterEach(() => {
  delete w.__HIFTH_NATIVE__;
  delete w.webkit;
  vi.restoreAllMocks();
});

describe("ShareSheet in the native shell", () => {
  it("shares the public site's link through the shell, not the private origin", async () => {
    const sent: unknown[] = [];
    w.__HIFTH_NATIVE__ = {
      platform: "ios",
      publicBase: "https://blog.bytesofpurpose.com/hifth/",
    };
    w.webkit = {
      messageHandlers: { hifth: { postMessage: (m) => sent.push(m) } },
    };
    // No Web Share and no clipboard — exactly what a custom-scheme origin has.
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });

    render(<ShareSheet state={STATE} hasTrail={false} />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      type: "share",
      url: "https://blog.bytesofpurpose.com/hifth/#/hafs-kfqc/2:255",
    });
    // And never a "copy failed" complaint: the shell took it.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("still uses the page's own address in a browser", async () => {
    const share = vi.fn(async (_data: ShareData) => {});
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });

    render(<ShareSheet state={STATE} hasTrail={false} />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const data = share.mock.calls[0]?.[0] as ShareData | undefined;
    expect(data?.url).toBe(
      window.location.origin + window.location.pathname + "#/hafs-kfqc/2:255",
    );
  });
});
