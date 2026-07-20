import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
        { elementId: "verse-1", number: 2038, surah: 2, ayah: 38, key: "quran/hafs-kfqc/2:38" },
      ],
    },
  ],
};

const PAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 345 550"><path d="M0 0h1"/></svg>';

describe("App shell", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("manifest.json")) {
          return Promise.resolve(new Response(JSON.stringify(MANIFEST)));
        }
        return Promise.resolve(new Response(PAGE_SVG, { headers: { "content-type": "image/svg+xml" } }));
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

  it("reports the selectable ayah count from the manifest", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/آيات قابلة للتحديد/)).toBeInTheDocument();
    });
  });
});
