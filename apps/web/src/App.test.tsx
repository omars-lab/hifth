import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { App } from "./App";

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
      ],
    },
  ],
};

// Fixture page carries one clickable polygon whose id matches the manifest, plus
// a glyph path that must NOT be selectable.
const PAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 345 550">' +
  '<path class="glyph" d="M0 0h1"/>' +
  '<polygon id="verse-1" class="ayahPolygon" points="0,0 10,0 10,10 0,10"/>' +
  "</svg>";

describe("App shell", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("manifest.json")) {
          return Promise.resolve(new Response(JSON.stringify(MANIFEST)));
        }
        return Promise.resolve(
          new Response(PAGE_SVG, { headers: { "content-type": "image/svg+xml" } }),
        );
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

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
      const svg = container.querySelector("svg[role='img']");
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
});
