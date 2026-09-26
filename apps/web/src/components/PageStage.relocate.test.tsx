/**
 * The newest move wins, whichever page loads first.
 *
 * A deep link and a hop each wait for their page to mount before they show it.
 * A page already mounted answers at once; one that is not waits for its fetch.
 * So an older request for a page still loading used to land *after* a newer one
 * for a page already there, and the reader was put back where they had just
 * left — the chrome saying 7 while the stage showed 1. The desktop e2e caught it
 * only on a busy machine; this stages the same order on purpose, with the slow
 * fetch held open by hand.
 */
import { createRef } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { Resolver, type AssetManifest } from "@hifth/core";
import { PageStage, type PageStageHandle } from "./PageStage";

const PAGES = [1, 7, 12];

function manifest(): AssetManifest {
  return {
    edition: "hafs-kfqc",
    editionLabel: "test",
    pages: PAGES.map((page, i) => ({
      edition: "hafs-kfqc" as const,
      page,
      viewBox: "0 0 345 550",
      polygons: [
        {
          elementId: "verse-1",
          number: 2000 + i + 1,
          surah: 2,
          ayah: i + 1,
          key: `quran/hafs-kfqc/2:${i + 1}`,
        },
      ],
    })),
  };
}

const PAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 345 550">' +
  '<polygon id="verse-1" class="ayahPolygon" points="0,0 10,0 10,10 0,10"/>' +
  "</svg>";
const svgResponse = () => new Response(PAGE_SVG, { headers: { "content-type": "image/svg+xml" } });

/** Page 12's fetch, held open until the test lets it go. */
let releaseSlow: () => void = () => {};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).endsWith("/12.svg"))
        return new Promise<Response>((resolve) => {
          releaseSlow = () => resolve(svgResponse());
        });
      return Promise.resolve(svgResponse());
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

/** The page whose host is showing — the one the reader is looking at. */
function showing(container: HTMLElement): number[] {
  return [...container.querySelectorAll<SVGElement>('svg[aria-labelledby^="page-label-"]')]
    .filter((svg) => (svg.parentElement as HTMLElement).style.display === "block")
    .map((svg) => Number(svg.getAttribute("aria-labelledby")!.replace("page-label-", "")));
}

describe("two moves in flight", () => {
  it("a deep link still loading does not land on top of a later hop", async () => {
    const ref = createRef<PageStageHandle>();
    const { container } = render(
      <PageStage
        ref={ref}
        resolver={new Resolver(manifest())}
        page={1}
        total={604}
        mountedPages={[7]}
        label="Page 1"
        selectedKey={null}
        breadcrumbKey={null}
        onSelect={() => {}}
        labelFor={() => "البقرة"}
      />,
    );
    await waitFor(() => expect(showing(container)).toEqual([1]));

    // The link asks for 12, which is slow; the hop asks for 7, which is ready.
    let link!: Promise<void>;
    let hop!: Promise<void>;
    act(() => {
      link = ref.current!.showPage(12);
      hop = ref.current!.navigateTo("quran/hafs-kfqc/2:2", { pulse: false, zoom: 1 });
    });
    await act(() => hop);
    expect(showing(container)).toEqual([7]);

    // Now the old request's page arrives. It must not take the stage back.
    await act(async () => {
      releaseSlow();
      await link;
    });
    expect(showing(container)).toEqual([7]);
  });
});
