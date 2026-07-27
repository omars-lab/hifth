import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OfflineNotice } from "./OfflineNotice";

/**
 * The banner's contract: exactly one message, chosen by what blocks offline
 * hardest, shown at most once per problem, and silent when there is nothing
 * true to say.
 */

const GB = 1024 * 1024 * 1024;

function stubStorage(sm: Partial<StorageManager> | null): void {
  Object.defineProperty(navigator, "storage", {
    value: sm ?? undefined,
    configurable: true,
    writable: true,
  });
}

function stubUserAgent(ua: string): void {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
}

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Mobile Safari/537.36";

afterEach(() => {
  stubStorage(null);
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("OfflineNotice", () => {
  it("says nothing when storage is persisted", async () => {
    stubUserAgent(ANDROID_UA);
    stubStorage({
      persisted: async () => true,
      estimate: async () => ({ usage: 0, quota: 40 * GB }),
    });
    const { container } = render(<OfflineNotice />);
    // Give the cold-start read a tick to land before asserting on silence.
    await waitFor(() => expect(navigator.storage).toBeDefined());
    expect(container.querySelector("[data-notice]")).toBeNull();
  });

  it("coaches iOS users to install — the only durable-offline path there", async () => {
    stubUserAgent(IPHONE_UA);
    stubStorage({
      persist: async () => false,
      persisted: async () => false,
      estimate: async () => ({ usage: 0, quota: 40 * GB }),
    });
    render(<OfflineNotice />);
    const notice = await screen.findByRole("status");
    expect(notice).toHaveAttribute("data-notice", "install-ios");
    expect(notice).toHaveTextContent(/إضافة إلى الشاشة الرئيسية/);
    // No button to press: iOS has no beforeinstallprompt, and pretending
    // otherwise would be a dead affordance.
    expect(screen.queryByRole("button", { name: "ثبّت" })).toBeNull();
  });

  it("warns about a capped quota ahead of everything else", async () => {
    stubUserAgent(ANDROID_UA);
    stubStorage({
      persisted: async () => false,
      estimate: async () => ({ usage: 1e6, quota: 300 * 1024 * 1024 }),
    });
    render(<OfflineNotice />);
    const notice = await screen.findByRole("status");
    expect(notice).toHaveAttribute("data-notice", "capped");
    expect(notice).toHaveTextContent(/عند إغلاق كل النوافذ/);
  });

  it("falls back to an honest best-effort warning with no install path", async () => {
    stubUserAgent(ANDROID_UA);
    stubStorage({
      persist: async () => false,
      persisted: async () => false,
      estimate: async () => ({ usage: 0, quota: 40 * GB }),
    });
    render(<OfflineNotice />);
    const notice = await screen.findByRole("status");
    expect(notice).toHaveAttribute("data-notice", "best-effort");
  });

  it("stays silent while held, and says the same thing once released", async () => {
    // Both this banner and the coach strip live *in* the layout above the
    // stage, which is right for each of them and wrong for the pair: stacked,
    // they took a third of a 412×839 phone's stage on exactly the visit where
    // a reader is deciding what this app is. App holds this one back until the
    // teaching is done. The hold is presentational — the read below still
    // happens, so nothing is re-derived when the strip lifts.
    stubUserAgent(ANDROID_UA);
    stubStorage({
      persist: async () => false,
      persisted: async () => false,
      estimate: async () => ({ usage: 0, quota: 40 * GB }),
    });
    const { container, rerender } = render(<OfflineNotice hold />);
    await waitFor(() => expect(navigator.storage).toBeDefined());
    expect(container.querySelector("[data-notice]")).toBeNull();

    rerender(<OfflineNotice hold={false} />);
    expect(await screen.findByRole("status")).toHaveAttribute("data-notice", "best-effort");
  });

  it("dismisses once and stays dismissed on the next visit", async () => {
    stubUserAgent(IPHONE_UA);
    stubStorage({
      persist: async () => false,
      persisted: async () => false,
      estimate: async () => ({ usage: 0, quota: 40 * GB }),
    });
    const first = render(<OfflineNotice />);
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "إخفاء التنبيه" }));
    expect(screen.queryByRole("status")).toBeNull();
    first.unmount();

    // A fresh mount is the next launch: the memory outlives the component.
    const { container } = render(<OfflineNotice />);
    await waitFor(() => expect(navigator.storage).toBeDefined());
    expect(container.querySelector("[data-notice]")).toBeNull();
  });
});
