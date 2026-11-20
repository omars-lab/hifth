import { describe, expect, it } from "vitest";
import { GROW_CAP, applyTextGrow, growScale, phoneTextScale, textGrowFrom } from "./text-grow";

function memoryStore(): Storage {
  const kept = new Map<string, string>();
  return {
    getItem: (k) => kept.get(k) ?? null,
    setItem: (k, v) => void kept.set(k, v),
    removeItem: (k) => void kept.delete(k),
    clear: () => kept.clear(),
    key: () => null,
    get length() {
      return kept.size;
    },
  };
}

describe("larger text, rough build", () => {
  it("stays off for a reader who never picked a way", () => {
    expect(textGrowFrom("", memoryStore())).toEqual({ way: null, size: 1.5 });
  });

  it("a link's ?grow= picks the way and is remembered on this device", () => {
    const store = memoryStore();
    expect(textGrowFrom("?grow=own&size=1.25", store)).toEqual({ way: "own", size: 1.25 });
    expect(textGrowFrom("", store)).toEqual({ way: "own", size: 1.25 });
    expect(textGrowFrom("?grow=off", store)).toEqual({ way: null, size: 1.25 });
    expect(textGrowFrom("", store)).toEqual({ way: null, size: 1.25 });
  });

  it("ignores a way or a size it does not know", () => {
    expect(textGrowFrom("?grow=huge&size=9", memoryStore())).toEqual({ way: null, size: 1.5 });
  });

  it("reads the phone's text size against its normal 17, and the browser's against 16", () => {
    // The iPhone SE at its largest size: body text 53 px.
    expect(phoneTextScale({ appleBody: 53, root: 16 })).toBe(GROW_CAP);
    expect(phoneTextScale({ appleBody: 17, root: 16 })).toBe(1);
    expect(phoneTextScale({ appleBody: 25.5, root: 16 })).toBe(1.5);
    // A browser with no phone size: the font is not understood, so the probe
    // takes the page's own 16, and a reader who set the browser larger shows in the root.
    expect(phoneTextScale({ appleBody: 16, root: 20 })).toBe(1.25);
    // Never smaller than the app as it is.
    expect(phoneTextScale({ appleBody: 14, root: 12 })).toBe(1);
  });

  it("the own way uses its own size; the phone ways use the phone's", () => {
    expect(growScale({ way: "own", size: 1.25 }, 2)).toBe(1.25);
    expect(growScale({ way: "phone", size: 1.25 }, 1.8)).toBe(1.8);
    expect(growScale({ way: "panels", size: 1.25 }, 1.8)).toBe(1.8);
    expect(growScale({ way: null, size: 1.25 }, 1.8)).toBe(1);
  });

  it("marks the document only when a way is picked, so the app as it is stays untouched", () => {
    const root = document.documentElement;
    applyTextGrow(root, { way: "phone", size: 1.5 }, 1.6);
    expect(root.dataset.textGrow).toBe("phone");
    expect(root.style.getPropertyValue("--text-grow")).toBe("1.6");
    applyTextGrow(root, { way: null, size: 1.5 }, 1.6);
    expect(root.dataset.textGrow).toBeUndefined();
    expect(root.style.getPropertyValue("--text-grow")).toBe("");
  });
});

