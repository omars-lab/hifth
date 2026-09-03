import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Edge, RailChip } from "@hifth/core";
import { HopPopover } from "./HopPopover";

const edge = (surah: number, ayah: number, extra: Partial<Edge> = {}): Edge => ({
  type: "loop",
  to: `quran/hafs-kfqc/${surah}:${ayah}`,
  page: 7,
  dir: { dSurah: 0, dPage: 0, sameJuz: true },
  ...extra,
});

const chip = (edges: Edge[]): RailChip => ({
  direction: "loop",
  glyph: "↻",
  count: edges.length,
  edges,
});

const noop = () => {};

describe("HopPopover", () => {
  it("renders nothing when no chip is open", () => {
    const { container } = render(
      <HopPopover chip={null} fromKey={null} canHop={() => true} onHop={noop} onClose={noop} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("a vendored target gets the in-app hop button, not an outbound link", () => {
    const onHop = vi.fn();
    render(
      <HopPopover
        chip={chip([edge(2, 3)])}
        fromKey="quran/hafs-kfqc/2:2"
        canHop={() => true}
        onHop={onHop}
        onClose={noop}
      />,
    );
    // The hop control is a button; there is no outbound link.
    expect(screen.getAllByRole("button", { name: /٢:٣|2:3/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("an un-vendored target links out to the outside library with the verse's ordinal, not its text", () => {
    render(
      <HopPopover
        chip={chip([edge(2, 3)])}
        fromKey="quran/hafs-kfqc/2:2"
        canHop={() => false}
        onHop={noop}
        onClose={noop}
      />,
    );
    const link = screen.getByRole("link");
    // 2:3 is the 10th ayah of the mus'haf (surah 1 has 7, 2:1..2:3 = 8,9,10).
    expect(link).toHaveAttribute("href", "https://qul.tarteel.ai/cms/verses/10");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    // Ships a URL, not bytes: no Arabic scripture in the href.
    expect(link.getAttribute("href")).not.toMatch(/[؀-ۿ]/);
  });
});
