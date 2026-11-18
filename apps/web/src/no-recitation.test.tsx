import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/preact";

/*
 * The App Store build leaves the recitation out (app-store-launch ⑥): it
 * streams from Quran.com, whose terms allow personal use only. With the switch
 * off, no control may offer to play a verse, no setting may be about playing,
 * and the credits may not name a recitation the build does not have. Every
 * other test runs with the switch on, as the website and the private build do.
 */
vi.mock("./recitation", () => ({ RECITATION: false, RECITATION_CREDIT: "https://quran.com" }));

const { verseAudioUrl } = await import("./audio");
const { PlayTrigger } = await import("./components/PlayTrigger");
const { ListenOptions } = await import("./components/ListenOptions");
const { RecitationShelf } = await import("./components/RecitationShelf");
const { Colophon } = await import("./components/Colophon");

describe("a build without the recitation", () => {
  it("has no address to fetch any verse's recitation from", () => {
    expect(verseAudioUrl("quran/hafs-kfqc/1:1")).toBeNull();
    expect(verseAudioUrl("quran/hafs-kfqc/2:255")).toBeNull();
  });

  it("offers to keep no surah's recitation on the device", async () => {
    const { keepSupported } = await import("./recitation-keep");
    expect(keepSupported()).toBe(false);
  });

  it("shows no listen button, even with a verse chosen", () => {
    const { container } = render(
      <PlayTrigger selectedKey="quran/hafs-kfqc/2:48" label="2:48" phase="idle" onToggle={() => {}} caption="Listen" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows no play options", () => {
    const { container } = render(
      <ListenOptions label="2:48" way={{ repeat: 1, speed: 1 }} onWay={() => {}} onPlayTo={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows no shelf of recitations kept on the device", () => {
    const { container } = render(<RecitationShelf />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers no settings about playing, in the info panel", () => {
    const { container } = render(
      <Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} runMark="light" onRunMark={() => {}} />,
    );
    for (const setting of ["run-follow", "run-ahead", "run-mark"])
      expect(container.querySelector(`[data-${setting}]`), setting).toBeNull();
    // Nor does any note in the panel name a Listen tool the build does not have.
    expect((container.textContent?.match(/\blisten/gi) ?? []).length).toBe(0);
  });

  it("does not credit a recitation it does not play, and keeps every other credit", () => {
    render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const credited = Array.from(document.querySelectorAll("li[data-credit]")).map((li) => li.getAttribute("data-credit"));
    expect(credited).not.toContain("https://quran.com");
    expect(credited).toContain("https://github.com/quranpedia/quran-svg");
    expect(credited).toContain("http://corpus.quran.com");
  });
});
