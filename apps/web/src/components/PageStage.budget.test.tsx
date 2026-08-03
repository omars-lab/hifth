/**
 * The DOM budget (`docs/backlog.md` ③, spec §3.4).
 *
 * This is the test the backlog asked for: "selects a high-degree ayah and
 * asserts the mounted count stays at the cap". It is a component test rather
 * than an App test because the thing under test is a *policy the stage applies
 * to a request* — App's job is only to name the pages a selection wants, and it
 * is allowed to want more of them than a phone can hold.
 *
 * Counting: every mounted page contributes exactly one `svg[role="group"]` with
 * an `aria-labelledby="page-label-<n>"`, set in `ensurePage`. That is the DOM
 * cost the cap exists to bound — one inline mus'haf page is ~150 KB of paths.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MOUNTED_PAGE_CAP, Resolver, spreadBudget, type AssetManifest } from "@hifth/core";
import { PageStage } from "./PageStage";

/** Twelve vendored pages, one ayah each — enough to overrun a cap of 6 twice over. */
const PAGES = [200, 12, 44, 91, 133, 205, 310, 402, 511, 590, 601, 604];

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
          elementId: `verse-${i + 1}`,
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

beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response(PAGE_SVG, { headers: { "content-type": "image/svg+xml" } })),
    ),
  );
});
afterAll(() => vi.unstubAllGlobals());

function mountedIn(container: HTMLElement): number[] {
  return [...container.querySelectorAll('svg[aria-labelledby^="page-label-"]')].map((el) =>
    Number(el.getAttribute("aria-labelledby")!.replace("page-label-", "")),
  );
}

function stage(mountedPages: readonly number[], pageBudget = MOUNTED_PAGE_CAP) {
  return (
    <PageStage
      resolver={new Resolver(manifest())}
      page={PAGES[0]!}
      total={604}
      mountedPages={mountedPages}
      pageBudget={pageBudget}
      label="Page 200"
      selectedKey={null}
      breadcrumbKey={null}
      onSelect={() => {}}
      labelFor={() => "البقرة"}
    />
  );
}

describe("the stage's DOM budget", () => {
  it("holds no more than the cap however many hop targets a selection has", async () => {
    // Every one of these resolves now that the whole print is vendored — which
    // is exactly what Loop 4b changed and what made this test necessary.
    const { container } = render(stage(PAGES));
    await waitFor(() => expect(mountedIn(container).length).toBeGreaterThan(1));
    // Settle: each mount is its own await, so let the queue drain before counting.
    await waitFor(() => {
      expect(mountedIn(container)).toHaveLength(MOUNTED_PAGE_CAP);
    });
    // …and it is the head of the request that survived: rail order is hifz
    // order, so the pages kept are the ones the reader is likeliest to tap.
    expect(mountedIn(container).sort((a, b) => a - b)).toEqual(
      PAGES.slice(0, MOUNTED_PAGE_CAP).sort((a, b) => a - b),
    );
  });

  it("keeps the page being read, whichever targets are requested", async () => {
    const { container } = render(stage(PAGES.slice(1)));
    await waitFor(() => {
      expect(mountedIn(container)).toContain(PAGES[0]);
      expect(mountedIn(container)).toHaveLength(MOUNTED_PAGE_CAP);
    });
  });

  it("re-uses a mounted page instead of re-fetching it when the request narrows", async () => {
    const { container, rerender } = render(stage(PAGES.slice(0, 3)));
    await waitFor(() => expect(mountedIn(container)).toHaveLength(3));
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // A narrower request: the two dropped targets stay mounted in the spare
    // slots rather than being destroyed, so nothing is fetched again.
    rerender(stage([PAGES[0]!]));
    await waitFor(() => expect(mountedIn(container)).toHaveLength(3));
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(calls);
  });

  /*
   * `docs/backlog.md` ④. On the desktop spread `App` mounts two of these, so it
   * hands each leaf a share of one budget (`spreadBudget`) rather than letting
   * both take the whole cap. That only works if the stage obeys the share it is
   * given — this is the half of ④ that lives here; the arithmetic of the split
   * is `mounted-set.test.ts`.
   */
  it("obeys a smaller budget than the cap, so a spread's two leaves cost one book", async () => {
    const { container } = render(stage(PAGES, spreadBudget().facing));
    await waitFor(() => {
      expect(mountedIn(container)).toHaveLength(spreadBudget().facing);
    });
    expect(spreadBudget().facing).toBeLessThan(MOUNTED_PAGE_CAP);
  });
});
