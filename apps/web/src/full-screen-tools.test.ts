import { afterEach, describe, expect, it } from "vitest";
import {
  EDGE_REACH,
  FULL_SCREEN_TOOLS,
  FULL_SCREEN_TOOLS_KEY,
  nearTheirEdge,
  rememberFullScreenTools,
  savedFullScreenTools,
  stillOnThem,
} from "./full-screen-tools";

describe("where the tools go in full screen", () => {
  afterEach(() => localStorage.clear());

  it("keeps them down the side when this device never chose", () => {
    expect(savedFullScreenTools()).toBe("side");
  });

  it("remembers each of the four ways, and ignores anything else", () => {
    for (const way of FULL_SCREEN_TOOLS) {
      rememberFullScreenTools(way);
      expect(savedFullScreenTools()).toBe(way);
    }
    localStorage.setItem(FULL_SCREEN_TOOLS_KEY, "somewhere");
    expect(savedFullScreenTools()).toBe("side");
  });
});

describe("hidden at the edge", () => {
  it("comes back only when the pointer is close to the tools' own side", () => {
    expect(nearTheirEdge(1280 - EDGE_REACH, 1280, "right")).toBe(true);
    expect(nearTheirEdge(1280 - EDGE_REACH - 1, 1280, "right")).toBe(false);
    expect(nearTheirEdge(4, 1280, "right")).toBe(false);
    expect(nearTheirEdge(EDGE_REACH, 1280, "left")).toBe(true);
    expect(nearTheirEdge(EDGE_REACH + 1, 1280, "left")).toBe(false);
    expect(nearTheirEdge(1276, 1280, "left")).toBe(false);
  });

  it("stays while the pointer is on the tools or just round them", () => {
    const box = { left: 1200, right: 1256, top: 200, bottom: 600 };
    expect(stillOnThem(1220, 400, box)).toBe(true);
    expect(stillOnThem(1180, 190, box)).toBe(true);
    expect(stillOnThem(1170, 400, box)).toBe(false);
    expect(stillOnThem(1220, 630, box)).toBe(false);
  });
});
