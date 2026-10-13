import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { KEEP_CACHE, isKeptUrl, keepSurah, keptSurahs, startKeeping, stopKeeping } from "../recitation-keep";
import { verseAudioUrl } from "../audio";
import { RecitationShelf } from "./RecitationShelf";

/*
 * The info panel's list of surahs whose recitation is kept on the device
 * (docs/PLAN.md, item 101), tested against the real module over a working
 * stand-in for Cache Storage, for the shelf's one duty: never show a surah as
 * kept when the device no longer holds its files. The test language is Arabic.
 */

class FakeCache {
  readonly entries = new Map<string, Response>();
  async put(url: string, res: Response): Promise<void> {
    this.entries.set(url, res);
  }
  async match(url: string): Promise<Response | undefined> {
    return this.entries.get(url)?.clone();
  }
  async delete(url: string): Promise<boolean> {
    return this.entries.delete(url);
  }
}
let store: FakeCache;
/** A made-up body, a tenth of a megabyte a verse. */
const BODY = "x".repeat(100_000);

beforeEach(() => {
  store = new FakeCache();
  localStorage.clear();
  vi.stubGlobal("caches", {
    open: async (name: string) => {
      if (name !== KEEP_CACHE) throw new Error(`unexpected cache ${name}`);
      return store;
    },
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(BODY, { status: 200 })));
});
afterEach(() => {
  stopKeeping();
  cleanup();
  vi.unstubAllGlobals();
});

describe("RecitationShelf", () => {
  it("says when nothing is kept yet", async () => {
    render(<RecitationShelf />);
    await screen.findByText("لم تُحفظ تلاوة أي سورة هنا بعد.");
  });

  it("lists a kept surah with its size", async () => {
    await keepSurah(1);
    render(<RecitationShelf />);
    // Seven verses of a tenth of a megabyte each.
    const row = await screen.findByText(/، ٠٫٧ م\.ب$/);
    expect(row.closest("[data-health]")).toHaveAttribute("data-health", "whole");
  });

  it("names a surah whose files the device let go as incomplete, and keeps it again", async () => {
    await keepSurah(1);
    store.entries.delete(verseAudioUrl("quran/hafs-kfqc/1:4")!);
    render(<RecitationShelf />);
    const row = await waitFor(() => {
      const el = document.querySelector("[data-health]");
      expect(el).toHaveAttribute("data-health", "torn");
      return el!;
    });
    expect(row.textContent).toContain("غير مكتملة، ٦ من ٧");
    fireEvent.click(screen.getByRole("button", { name: "احفظها من جديد" }));
    await waitFor(() => expect(document.querySelector("[data-health]")).toHaveAttribute("data-health", "whole"));
  });

  it("removes a kept surah, files and all", async () => {
    await keepSurah(1);
    render(<RecitationShelf />);
    const remove = await screen.findByRole("button", { name: /^احذف تلاوة .+ من هذا الجهاز$/ });
    fireEvent.click(remove);
    await screen.findByText("لم تُحفظ تلاوة أي سورة هنا بعد.");
    expect(keptSurahs()).toEqual([]);
    expect(isKeptUrl(verseAudioUrl("quran/hafs-kfqc/1:1")!)).toBe(false);
    await waitFor(() => expect(store.entries.size).toBe(0));
  });

  it("shows a save on its way, counting, with a way to stop it", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<RecitationShelf />);
    act(() => void startKeeping(1));
    await screen.findByText(/^جارٍ حفظ .+ — ٠ من ٧$/);
    fireEvent.click(screen.getByRole("button", { name: "إيقاف" }));
    await screen.findByText("لم تُحفظ تلاوة أي سورة هنا بعد.");
  });

  it("says so when the browser cannot keep files", () => {
    vi.stubGlobal("caches", undefined);
    render(<RecitationShelf />);
    expect(screen.getByText("لا يستطيع هذا المتصفح حفظ تلاوة على هذا الجهاز.")).toBeInTheDocument();
  });
});
