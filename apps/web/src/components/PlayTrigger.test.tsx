import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { stringsFor } from "../i18n";
import { PlayTrigger, listenCaption, listenGlyph } from "./PlayTrigger";

/*
 * While a verse's file is still opening, the sound has already been asked for:
 * a press then stops it, as it does once the verse sounds. So the control says
 * what a press will do — pause — and does not still offer to play. On a slow
 * connection a reader who sees "Play" taps again, thinking the first tap was
 * missed, and that second tap silenced the verse before it began.
 */
// Rendered outside the app's language provider, the control speaks the default, Arabic.
const t = stringsFor("ar");

describe("the listen control while the verse is still loading", () => {
  it("is named for pausing, and pressed, as while it plays", () => {
    render(<PlayTrigger selectedKey="quran/hafs-kfqc/2:48" label="2:48" phase="loading" onToggle={() => {}} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe(t.pauseAyah("2:48"));
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("says Pause under its glyph, as while it plays", () => {
    expect(listenCaption("loading", t)).toBe(t.vdPause);
    expect(listenCaption("playing", t)).toBe(t.vdPause);
    expect(listenCaption("idle", t)).toBe(t.vdListen);
    expect(listenCaption("error", t)).toBe(t.vdListenOffline);
  });

  it("turns, in the verse's menu as in the bar, rather than still showing play", () => {
    expect(listenGlyph("loading")).toBe("↻");
    expect(listenGlyph("playing")).toBe("⏸︎");
    expect(listenGlyph("idle")).toBe("▶︎");
    expect(listenGlyph("error")).toBe("▶︎");
  });

  it("offers to play when nothing is asked for yet", () => {
    render(<PlayTrigger selectedKey="quran/hafs-kfqc/2:48" label="2:48" phase="idle" onToggle={() => {}} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe(t.playAyah("2:48"));
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
