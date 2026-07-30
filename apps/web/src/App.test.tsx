// jsdom has no IndexedDB, so without this the revision store would report itself
// unsupported and every wiring assertion below would pass by recording nothing.
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import { App } from "./App";
import { forgetRecord, readRecord } from "./revision-store";

const MANIFEST = {
  edition: "hafs-kfqc",
  editionLabel: "test",
  pages: [
    {
      edition: "hafs-kfqc",
      page: 7,
      viewBox: "0 0 345 550",
      polygons: [
        { elementId: "verse-1", number: 2041, surah: 2, ayah: 41, key: "quran/hafs-kfqc/2:41" },
        // The hop target, vendored so a hop actually lands — which is what makes
        // "a hop credits the source, not the destination" testable at all.
        { elementId: "verse-2", number: 2047, surah: 2, ayah: 47, key: "quran/hafs-kfqc/2:47" },
      ],
    },
  ],
};

// A minimal adjacency shard for surah 2 so the rail has something to bucket.
// 2:41 → 2:47 (same-surah loop, page 7).
const ADJ_SHARD = {
  "41": {
    edges: [
      {
        type: "mutashabih",
        to: "quran/hafs-kfqc/2:47",
        page: 7,
        dir: { dSurah: 0, dPage: 0 },
        note: "test edge",
      },
    ],
    ext: [],
  },
};

// Fixture page carries one clickable polygon whose id matches the manifest, plus
// a glyph path that must NOT be selectable.
const PAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 345 550">' +
  '<path class="glyph" d="M0 0h1"/>' +
  '<polygon id="verse-1" class="ayahPolygon" points="0,0 10,0 10,10 0,10"/>' +
  '<polygon id="verse-2" class="ayahPolygon" points="0,20 10,20 10,30 0,30"/>' +
  "</svg>";

// beforeAll/afterAll, deliberately, and not beforeEach/afterEach — and at file
// scope, so the second describe below runs against the same network.
//
// The app's loading chain is longer than any one assertion: a manifest fetch
// resolves, that sets state, an effect runs, and only then is the selection's
// adjacency shard requested. A test that has already asserted what it came to
// assert returns while that chain is still in flight. Tearing the stub down
// per-test therefore removed the network from underneath a fetch the app had
// every right to make, and it hit Node's real `fetch` with a root-relative
// URL — `TypeError: Failed to parse URL from /assets/adj/hafs-kfqc/2.json`.
//
// It surfaced as an *unhandled rejection*, not a failed assertion, so the
// suite reported 89/89 passing and `make ci` failed only when the machine was
// busy enough for the continuation to land after teardown. A file-scoped stub
// is also the more honest model: the network does not cease to exist because
// a test stopped looking at it.
//
// If you are tempted to move these back: vitest.setup.ts now installs a fetch
// that throws by name, so the same mistake fails loudly instead of silently —
// but it still only fails on the runs that lose the race. The lifecycle is the
// fix; the guard only makes the diagnosis take minutes instead of an evening.
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("manifest.json")) {
        return Promise.resolve(new Response(JSON.stringify(MANIFEST)));
      }
      if (url.includes("/adj/")) {
        return Promise.resolve(new Response(JSON.stringify(ADJ_SHARD)));
      }
      return Promise.resolve(
        new Response(PAGE_SVG, { headers: { "content-type": "image/svg+xml" } }),
      );
    }),
  );
});
afterAll(() => vi.unstubAllGlobals());

afterEach(() => {
  // The hash router writes location.hash as the view changes; jsdom shares one
  // window across tests, so clear it or the next cold-open restores stale state.
  window.history.replaceState(null, "", window.location.pathname);
});

describe("App shell", () => {
  it("renders the Arabic brand mark and RTL direction", () => {
    render(<App />);
    expect(screen.getByText("حفظ")).toBeInTheDocument();
    expect(document.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });

  it("shows the starting page number (7)", () => {
    render(<App />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("mounts the page SVG with an accessible role and overlay group", async () => {
    const { container } = render(<App />);
    await waitFor(() => {
      const svg = container.querySelector("svg[role='group']");
      expect(svg).not.toBeNull();
    });
    expect(container.querySelector("#hifth-overlay")).not.toBeNull();
  });

  it("prompts to select an ayah when nothing is selected", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/المس آية على الصفحة لتحديدها/)).toBeInTheDocument();
    });
  });

  it("selects the tapped ayah: shows its label and draws the selection highlight", async () => {
    const { container } = render(<App />);
    const poly = await waitFor(() => {
      const p = container.querySelector<SVGElement>("#verse-1");
      expect(p).not.toBeNull();
      return p!;
    });

    // The tap fires the highlighter's pointerup listener, which flows out
    // through onSelect into a React setState — wrap it so React can flush.
    act(() => {
      poly.dispatchEvent(new Event("pointerup", { bubbles: true }));
    });

    // Footer now shows the surah name + ayah ref in Arabic-Indic digits.
    await waitFor(() => {
      expect(screen.getByText(/البقرة · ٢:٤١/)).toBeInTheDocument();
    });
    // And the highlighter drew a selection clone into the overlay.
    expect(container.querySelector("#hifth-overlay .hl-sel")).not.toBeNull();
  });

  it("surfaces a hop rail chip for a selected ayah that has edges", async () => {
    const { container } = render(<App />);
    const poly = await waitFor(() => {
      const p = container.querySelector<SVGElement>("#verse-1");
      expect(p).not.toBeNull();
      return p!;
    });

    act(() => {
      poly.dispatchEvent(new Event("pointerup", { bubbles: true }));
    });

    // 2:41 has one same-surah mutashabih → a loop chip appears on the rail.
    await waitFor(() => {
      expect(screen.getByRole("group", { name: "روابط الآية" })).toBeInTheDocument();
    });
  });
});

/*
 * The revision record's whole claim is about *which* taps count. `recordLook`
 * and `rollUp` are tested on their own; what cannot be tested there is whether
 * App.tsx calls them from the three places it must not — and those three are the
 * difference between a record of revision and a record of app usage.
 */
describe("the revision record — which taps become a look", () => {
  beforeEach(async () => {
    await forgetRecord();
  });

  /** Fire the highlighter's pointerup on a polygon, letting React flush. */
  const tap = async (container: HTMLElement, id: string) => {
    const poly = await waitFor(() => {
      const p = container.querySelector<SVGElement>(`#${id}`);
      expect(p).not.toBeNull();
      return p!;
    });
    act(() => {
      poly.dispatchEvent(new Event("pointerup", { bubbles: true }));
    });
    // The write is fired and forgotten inside the handler; give it its turn.
    await act(async () => {
      await Promise.resolve();
    });
  };

  it("records a deliberate tap, on the page it was read on", async () => {
    const { container } = render(<App />);
    await tap(container, "verse-1");

    await waitFor(async () => {
      const { events } = await readRecord();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ key: "quran/hafs-kfqc/2:41", page: 7 });
      expect(events[0]!.endKey).toBeUndefined();
    });
  });

  it("does not record the second tap that dismisses a selection", async () => {
    // `handleSelect` fires on toggle-off too. That tap means "dismiss", and
    // counting it would double the score of every ayah someone thought better
    // of — the ayahs a hafiz is least sure about, scored highest.
    const { container } = render(<App />);
    await tap(container, "verse-1");
    await tap(container, "verse-1");

    // The selection really did clear — otherwise this asserts nothing.
    await waitFor(() => {
      expect(screen.getByText(/المس آية على الصفحة لتحديدها/)).toBeInTheDocument();
    });
    const { events } = await readRecord();
    expect(events).toHaveLength(1);
  });

  it("credits the source of a hop, never the ayah the app moved them to", async () => {
    // Recording the destination would draw a heatmap of wherever the corpus
    // happens to point, which is a picture of the data, not of the reader.
    const { container } = render(<App />);
    await tap(container, "verse-1");

    const rail = await screen.findByRole("group", { name: "روابط الآية" });
    const chip = within(rail).getAllByRole("button")[0]!;
    act(() => chip.click());
    const hop = await screen.findByRole("button", { name: /انتقل إلى/ });
    act(() => hop.click());
    await act(async () => {
      await Promise.resolve();
    });

    // The hop landed — asserted on the live region, which says it once, rather
    // than on the page text, where the trail bead says it too.
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/انتقلت إلى البقرة · ٢:٤٧/);
    });
    // …and the record still holds only the ayah the reader chose.
    const { events } = await readRecord();
    expect(events.map((e) => e.key)).toEqual(["quran/hafs-kfqc/2:41"]);
  });

  it("records a passage arrived at by a share link as nothing at all", async () => {
    // Someone else chose that ayah. A link opened from a group chat is not
    // evidence that this reader revised anything.
    window.history.replaceState(null, "", "#/hafs-kfqc/2:41");
    const { container } = render(<App />);
    await waitFor(() => {
      expect(container.querySelector("#verse-1")).not.toBeNull();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const { events } = await readRecord();
    expect(events).toHaveLength(0);
  });
});
