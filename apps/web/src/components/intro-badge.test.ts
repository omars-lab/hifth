import { describe, expect, it } from "vitest";
import { badgeSpot, titleBand, titleLeftEdge } from "./intro-badge";

describe("intro badge · where a surah's name sits", () => {
  it("two lines above the opening verse, over the basmala", () => {
    // Ya-Sin on page 440: verse 1 starts on the line at 191.5.
    const band = titleBand(191.5, 36);
    expect(band.top).toBeCloseTo(120, 0);
    expect(band.bottom).toBeCloseTo(155.75, 1);
  });

  it("one line above for At-Tawbah, which has no basmala, and Al-Fatihah, whose basmala is verse 1", () => {
    expect(titleBand(49.3, 9).bottom).toBeCloseTo(49.3, 1);
    expect(titleBand(49.3, 1).bottom).toBeCloseTo(49.3, 1);
  });
});

describe("intro badge · where the name's ink ends on the left", () => {
  const band = { top: 120, bottom: 156 };
  // A made-up title: ink from 150 to 196, with a word gap at 170–174.
  const title = (x: number, y: number) => y > 128 && y < 150 && x >= 150 && x <= 196 && !(x > 170 && x < 174);

  it("walks left from the middle across the word gap to the last ink", () => {
    expect(titleLeftEdge(title, band, 172.5)).toBe(150);
  });

  it("stops at a wide gap, so ink further along the line is not taken for the name", () => {
    const withOrnament = (x: number, y: number) => title(x, y) || (x >= 20 && x <= 30 && y > 130 && y < 140);
    expect(titleLeftEdge(withOrnament, band, 172.5)).toBe(150);
  });

  it("nothing when the line holds no ink near the middle", () => {
    expect(titleLeftEdge(() => false, band, 172.5)).toBeNull();
    expect(titleLeftEdge((x) => x < 40, band, 172.5)).toBeNull();
  });
});

describe("intro badge · where the badge goes", () => {
  it("left of the name, a little above the middle of its line", () => {
    const name = (x: number, y: number) => y > 128 && y < 150 && x >= 150 && x <= 196;
    const spot = badgeSpot(name, 191.5, 36, 35.75, 172.5);
    expect(spot?.cx).toBe(140);
    expect(spot?.cy).toBeGreaterThan(120);
    expect(spot?.cy).toBeLessThan(138);
  });

  it("beside the basmala when the page draws no name line, as on the first two pages", () => {
    // Only the line just above verse 1 is inked, from 60 to 180.
    const basmala = (x: number, y: number) => y > 160 && y < 185 && x >= 60 && x <= 180;
    const spot = badgeSpot(basmala, 191.5, 2, 35.75, 172.5);
    expect(spot?.cx).toBe(50);
    expect(spot?.cy).toBeGreaterThan(155.75);
    expect(spot?.cy).toBeLessThan(191.5);
  });

  it("nowhere when neither line holds ink", () => {
    expect(badgeSpot(() => false, 191.5, 36, 35.75, 172.5)).toBeNull();
  });
});
