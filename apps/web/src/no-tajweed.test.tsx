import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/preact";

/*
 * The fallback for the tajweed colours (app-store-launch ㊲). The owner chose
 * on 2026-11-20 to keep them, with the reader's own switch to turn them on and
 * off; if the permission for their data does not come, the store build is made
 * without them. With the build's switch off, there is no button to turn them
 * on, no key to them, no fetch of their data, and no credit for data the build
 * does not carry. Every other test runs with the colours in.
 */
vi.mock("./tajweed-in-build", () => ({ TAJWEED: false, TAJWEED_CREDIT: "https://github.com/cpfair/quran-tajweed" }));

const { SkinToggle } = await import("./components/SkinToggle");
const { Colophon } = await import("./components/Colophon");
const { loadTajweedShard, loadTajweedVocabulary } = await import("./assets");

describe("a build without the tajweed colours", () => {
  it("shows no button to turn them on", () => {
    const { container } = render(<SkinToggle skin="plain" onChange={() => {}} onOpenLegend={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("fetches none of their data", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(await loadTajweedShard("hafs-kfqc", 1)).toBeNull();
    expect(await loadTajweedVocabulary("hafs-kfqc")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it("does not credit data it does not carry, and keeps every other credit", () => {
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).not.toContain("https://github.com/cpfair/quran-tajweed");
    expect(links).toContain("https://tanzil.net");
  });
});
