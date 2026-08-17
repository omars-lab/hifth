import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AppState, MergedEdge } from "@hifth/core";
import { HighlightMenu } from "./HighlightMenu";

/**
 * The panel itself is a crop of two mus'haf pages and needs both pages' artwork
 * and word geometry to draw anything — none of which is this file's subject.
 * What the menu owns is *which ayah the panel is told it is standing on*, so the
 * stub reports exactly that and `DiffView.test.tsx` covers the drawing.
 */
vi.mock("./DiffView", () => ({
  DiffView: ({ fromKey }: { fromKey: string }) => <div data-here={fromKey} />,
}));

const ED = "hafs-kfqc";
const k = (ref: string) => `quran/${ED}/${ref}`;
const RANGE = [k("2:47"), k("2:48")];

/**
 * A merged edge with the fields under test; `dir` only matters for ordering.
 * `from` defaults to the sole contributor — pass it explicitly to model a row
 * that several range members contributed but only one of them produced.
 */
function edge(p: Partial<MergedEdge> & Pick<MergedEdge, "type" | "to" | "sources">): MergedEdge {
  return { page: 19, dir: { dSurah: 0, dPage: 12 }, from: p.sources[0], ...p } as MergedEdge;
}

const HOPS: MergedEdge[] = [
  // The edge names the words the pair matches on, so this row expands into a
  // comparison. An edge that matches in more than one place names none, and
  // that is what the second row models — no caret, nothing to expand.
  edge({
    type: "mutashabih",
    to: k("2:122"),
    sources: [k("2:47")],
    twin: true,
    note: "توأم — السياق يختلف",
    span: { from: [1, 13] },
    toSpan: { from: [1, 13] },
  }),
  // A target on an un-vendored page: surfaced, but the leap is disabled.
  edge({ type: "mutashabih", to: k("14:5"), page: 255, sources: [k("2:48")] }),
];

const SHARE_STATE: AppState = {
  edition: ED,
  select: { surah: 2, ayah: 47, toAyah: 48 },
};

/** Only page 19 is "vendored" in these tests (14:5's page 255 is not). */
const canHop = (to: string) => to === k("2:122");

type Props = Parameters<typeof HighlightMenu>[0];

function renderMenu(overrides: Partial<Props> = {}) {
  const props: Props = {
    rangeKeys: RANGE,
    hops: HOPS,
    canHop,
    onHop: vi.fn(),
    shareState: SHARE_STATE,
    onClear: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<HighlightMenu {...props} />) };
}

describe("HighlightMenu (spec §9 — the drag-highlight menu)", () => {
  it("renders nothing until a range is highlighted", () => {
    const { container } = renderMenu({ rangeKeys: null });
    expect(container).toBeEmptyDOMElement();
  });

  it("titles the range in Arabic-Indic digits and lists its merged hops", () => {
    renderMenu();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading")).toHaveTextContent("البقرة · ٢:٤٧–٢:٤٨");
    expect(within(dialog).getByText(/البقرة · ٢:١٢٢/)).toBeInTheDocument();
    // each row names the range member that contributed it (the merge, visible)
    expect(within(dialog).getByText("من ٢:٤٧")).toBeInTheDocument();
    expect(within(dialog).getByText("من ٢:٤٨")).toBeInTheDocument();
  });

  it("enables vendored leaps and disables un-vendored ones with an honest note", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: /انتقل إلى البقرة · ٢:١٢٢/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /انتقل إلى إبراهيم · ١٤:٥/ })).toBeDisabled();
    expect(screen.getByText(/غير متوفّرة بعد/)).toBeInTheDocument();
  });

  it("expands a row into the comparison, standing on that row's source ayah", () => {
    renderMenu();
    const row = screen.getByRole("button", { expanded: false });
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    // The panel's "here" side is 2:47 — the member that produced this edge.
    expect(document.querySelector(`[data-here="${k("2:47")}"]`)).toBeInTheDocument();
  });

  it("a row both members contributed diffs against the one that produced it", () => {
    // The real corpus has these: 2:123 is an edge of 2:47 *and* 2:48, and the
    // surviving row is 2:48's (it carries the curated note). Naming 2:47 here —
    // the first contributor — would caption 2:48's note with the wrong ayah.
    renderMenu({
      hops: [
        edge({
          type: "mutashabih",
          to: k("2:122"),
          sources: [k("2:47"), k("2:48")],
          from: k("2:48"),
          note: "شفاعة ↔ عدل",
          span: { from: [1, 13] },
          toSpan: { from: [1, 13] },
        }),
      ],
    });
    expect(screen.getByText("من ٢:٤٧، ٢:٤٨")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(document.querySelector(`[data-here="${k("2:48")}"]`)).toBeInTheDocument();
  });

  it("hops with the merged edge (the caller reads its `from` for the trail)", () => {
    const { props } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /انتقل إلى البقرة · ٢:١٢٢/ }));
    expect(props.onHop).toHaveBeenCalledWith(HOPS[0]);
  });

  it("shares the range through the §7 range form", async () => {
    // jsdom exposes no clipboard; define one (navigator itself is not stubbable).
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /شارك هذا المقطع كرابط/ }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`#/${ED}/2:47-2:48`));
    });
  });

  it("clears the highlight on request", () => {
    const { props } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "إلغاء التحديد" }));
    expect(props.onClear).toHaveBeenCalled();
  });

  it("is a modal dialog: focus moves in, Escape closes", () => {
    const { props } = renderMenu();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("says so when the highlighted passage has no links yet", () => {
    renderMenu({ hops: [] });
    expect(screen.getByText("لا روابط في هذا المقطع بعد")).toBeInTheDocument();
  });
});
