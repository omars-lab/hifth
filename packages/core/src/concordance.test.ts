import { describe, it, expect } from "vitest";
import {
  Concordance,
  EDITIONS,
  editionMeta,
  type ConcordanceTable,
} from "./concordance.js";

/*
 * Only `hafs-kfqc` is vendored, so the seam is proven against a **fixture**
 * rather than a second real edition. The refs below are synthetic — invented to
 * exercise the three shapes a real table has (an unchanged ayah, a shifted one,
 * and one with no counterpart at all) — and are deliberately NOT presented as
 * anyone's counting. Faking a second mushaf's numbering would be the one kind of
 * test data this project must never ship.
 */
const FIXTURE_EDITION = "fixture-alt";

const IDENTITY_TABLE: ConcordanceTable = {
  from: "hafs-kfqc",
  to: FIXTURE_EDITION,
  base: "identity",
  deltas: {
    "8:36": "8:35", // shifted by one from here on in this fixture
    "8:37": null, // merged into its neighbour — no counterpart
  },
};

const EXPLICIT_TABLE: ConcordanceTable = {
  from: "hafs-kfqc",
  to: FIXTURE_EDITION,
  base: "explicit",
  deltas: { "2:255": "2:255" },
};

const key = (edition: string, s: number, a: number) => `quran/${edition}/${s}:${a}`;

describe("edition registry", () => {
  it("ships exactly one vendored edition today, and says so", () => {
    const vendored = EDITIONS.filter((e) => e.status === "vendored");
    expect(vendored.map((e) => e.id)).toEqual(["hafs-kfqc"]);
  });

  it("gives every un-vendored edition a real reason (never a ghost entry)", () => {
    for (const e of EDITIONS) {
      if (e.status === "unvendored") {
        expect(e.reason).toBeTruthy();
        expect(e.reason!.length).toBeGreaterThan(8);
      }
    }
  });

  it("looks an edition up by id", () => {
    expect(editionMeta("hafs-kfqc")?.status).toBe("vendored");
    expect(editionMeta("nope")).toBeNull();
  });
});

describe("Concordance — no table, no mapping", () => {
  it("refuses to map when it holds nothing for the pair", () => {
    const c = new Concordance();
    expect(c.has("hafs-kfqc", FIXTURE_EDITION)).toBe(false);
    // The whole point: an empty concordance says "I don't know", never
    // "same numbers, probably".
    expect(c.map(key("hafs-kfqc", 2, 255), FIXTURE_EDITION)).toBeNull();
  });

  it("maps a key to itself within its own edition (not index arithmetic)", () => {
    const c = new Concordance();
    expect(c.has("hafs-kfqc", "hafs-kfqc")).toBe(true);
    expect(c.map(key("hafs-kfqc", 2, 255), "hafs-kfqc")).toBe(key("hafs-kfqc", 2, 255));
  });

  it("rejects a key that is not a bare ayah key", () => {
    const c = new Concordance();
    c.add(IDENTITY_TABLE);
    expect(c.map("quran/hafs-kfqc/p7", FIXTURE_EDITION)).toBeNull();
    expect(c.map("root/ktb", FIXTURE_EDITION)).toBeNull();
  });
});

describe("Concordance — an identity-base table", () => {
  const c = new Concordance();
  c.add(IDENTITY_TABLE);

  it("carries an unlisted ayah across, because the table claims it can", () => {
    expect(c.map(key("hafs-kfqc", 2, 255), FIXTURE_EDITION)).toBe(
      key(FIXTURE_EDITION, 2, 255),
    );
  });

  it("applies a recorded delta", () => {
    expect(c.map(key("hafs-kfqc", 8, 36), FIXTURE_EDITION)).toBe(key(FIXTURE_EDITION, 8, 35));
  });

  it("returns null for an ayah recorded as having no counterpart", () => {
    expect(c.map(key("hafs-kfqc", 8, 37), FIXTURE_EDITION)).toBeNull();
  });

  it("maps only in the direction it was given", () => {
    expect(c.has(FIXTURE_EDITION, "hafs-kfqc")).toBe(false);
    expect(c.map(key(FIXTURE_EDITION, 2, 255), "hafs-kfqc")).toBeNull();
  });
});

describe("Concordance — an explicit-base table", () => {
  const c = new Concordance();
  c.add(EXPLICIT_TABLE);

  it("maps what it lists", () => {
    expect(c.map(key("hafs-kfqc", 2, 255), FIXTURE_EDITION)).toBe(
      key(FIXTURE_EDITION, 2, 255),
    );
  });

  it("refuses everything it does not list", () => {
    expect(c.map(key("hafs-kfqc", 2, 254), FIXTURE_EDITION)).toBeNull();
  });
});

describe("Concordance — round trip", () => {
  it("returns to the original key when both directions are registered", () => {
    const back: ConcordanceTable = {
      from: FIXTURE_EDITION,
      to: "hafs-kfqc",
      base: "identity",
      deltas: { "8:35": "8:36" },
    };
    const c = new Concordance();
    c.add(IDENTITY_TABLE);
    c.add(back);
    const there = c.map(key("hafs-kfqc", 8, 36), FIXTURE_EDITION);
    expect(there).toBe(key(FIXTURE_EDITION, 8, 35));
    expect(c.map(there!, "hafs-kfqc")).toBe(key("hafs-kfqc", 8, 36));
  });

  it("replaces a pair's table when re-added", () => {
    const c = new Concordance();
    c.add(IDENTITY_TABLE);
    c.add(EXPLICIT_TABLE);
    expect(c.map(key("hafs-kfqc", 8, 36), FIXTURE_EDITION)).toBeNull();
  });
});
