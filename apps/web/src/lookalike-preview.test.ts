import { afterEach, describe, expect, it } from "vitest";
import type { Edge } from "@hifth/core";
import {
  LOOKALIKE_PREVIEW_KEY,
  rememberLookalikePreview,
  savedLookalikePreview,
  sharedRun,
} from "./lookalike-preview";

/** Made-up refs and spans; only the shape matters here. */
const edge = (extra: Partial<Edge> = {}): Edge => ({
  type: "mutashabih",
  to: "quran/hafs-kfqc/2:9",
  page: 19,
  dir: { dSurah: 0, dPage: 12, sameJuz: true },
  ...extra,
});

describe("the shared words a closed look-alike row can show", () => {
  it("are the other verse's run, when the pair shares one stretch", () => {
    expect(sharedRun(edge({ span: { from: [2, 6] }, toSpan: { from: [3, 7] } }))).toEqual({
      key: "2:9",
      page: 19,
      from: 3,
      to: 7,
      words: 5,
    });
  });

  it("come from the verse inside a passage that matches best", () => {
    const passage = edge({
      through: "quran/hafs-kfqc/2:12",
      like: { to: "quran/hafs-kfqc/2:11", page: 20 },
      span: { from: [1, 4] },
      toSpan: { from: [1, 4] },
    });
    expect(sharedRun(passage)).toMatchObject({ key: "2:11", page: 20, words: 4 });
  });

  it("are not offered when no one stretch is shared", () => {
    expect(sharedRun(edge())).toBeNull();
    expect(sharedRun(edge({ match: "repeat" }))).toBeNull();
    expect(sharedRun(edge({ match: "loose" }))).toBeNull();
    // A pair alike loosely or more than once says so in its own line; a
    // picture of words under it would contradict that, even if a span came.
    const spans = { span: { from: [2, 6] as [number, number] }, toSpan: { from: [3, 7] as [number, number] } };
    expect(sharedRun(edge({ match: "loose", ...spans }))).toBeNull();
    expect(sharedRun(edge({ match: "repeat", ...spans }))).toBeNull();
    // A run that ends before it starts is a bad row, not one word.
    expect(sharedRun(edge({ span: { from: [4, 2] }, toSpan: { from: [4, 2] } }))).toBeNull();
  });
});

describe("how a closed row shows them, as the reader set it", () => {
  afterEach(() => localStorage.removeItem(LOOKALIKE_PREVIEW_KEY));

  it("is the picture until the reader picks", () => {
    expect(savedLookalikePreview()).toBe("picture");
  });

  it("is kept across visits", () => {
    rememberLookalikePreview("count");
    expect(savedLookalikePreview()).toBe("count");
    rememberLookalikePreview("none");
    expect(savedLookalikePreview()).toBe("none");
  });

  it("falls back to the picture when what is stored is not a way", () => {
    localStorage.setItem(LOOKALIKE_PREVIEW_KEY, "sideways");
    expect(savedLookalikePreview()).toBe("picture");
  });
});
