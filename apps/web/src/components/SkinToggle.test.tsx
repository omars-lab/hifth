import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Tajweed,
  type TajweedRuleId,
  type TajweedShard,
  type TajweedVocabulary,
} from "@hifth/core";
import { SkinToggle, TajweedLegend } from "./SkinToggle";

// Shards are keyed by the *source's* rule ids, and the vocabulary is what turns
// them into the seven painted families — so a fixture needs both halves.
const vocabulary: TajweedVocabulary = {
  source: "test",
  rules: [
    { id: "madd_2", family: "madd" },
    { id: "madd_6", family: "madd-lazim" },
    { id: "hamzat_wasl", family: "wasl" },
  ],
};

const shard: TajweedShard = {
  "38": { madd_2: [24, 25], madd_6: [61, 63] },
  "39": { hamzat_wasl: [3, 4] },
};

function lens(): Tajweed {
  const tj = new Tajweed("hafs-kfqc", vocabulary);
  tj.addShard(2, shard);
  return tj;
}

const counts = (): ReadonlyMap<TajweedRuleId, number> =>
  lens().countsForKeys(["quran/hafs-kfqc/2:38", "quran/hafs-kfqc/2:39"]);

const noop = () => {};

describe("SkinToggle", () => {
  it("is a pressed-state toggle, not two buttons", () => {
    const { rerender } = render(<SkinToggle skin="plain" onChange={noop} onOpenLegend={noop} />);
    const toggle = screen.getByRole("button", { pressed: false });
    expect(toggle).toHaveTextContent("تجويد");
    rerender(<SkinToggle skin="tajweed" onChange={noop} onOpenLegend={noop} />);
    expect(screen.getByRole("button", { pressed: true })).toBeTruthy();
  });

  it("shows the beta badge in BOTH states — it is the deliverable, not a TODO", () => {
    const { rerender } = render(<SkinToggle skin="plain" onChange={noop} onOpenLegend={noop} />);
    expect(screen.getByText("تجريبي")).toBeTruthy();
    rerender(<SkinToggle skin="tajweed" onChange={noop} onOpenLegend={noop} />);
    expect(screen.getByText("تجريبي")).toBeTruthy();
  });

  it("flips to the other skin", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SkinToggle skin="plain" onChange={onChange} onOpenLegend={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { pressed: false }));
    expect(onChange).toHaveBeenCalledWith("tajweed");
    rerender(<SkinToggle skin="tajweed" onChange={onChange} onOpenLegend={noop} />);
    fireEvent.click(screen.getByRole("button", { pressed: true }));
    expect(onChange).toHaveBeenLastCalledWith("plain");
  });

  it("offers the legend even while the skin is off — the key explains the switch", () => {
    const onOpenLegend = vi.fn();
    render(<SkinToggle skin="plain" onChange={noop} onOpenLegend={onOpenLegend} />);
    fireEvent.click(screen.getByLabelText("مفتاح ألوان التجويد"));
    expect(onOpenLegend).toHaveBeenCalled();
  });
});

describe("TajweedLegend", () => {
  const open = (over: Partial<Parameters<typeof TajweedLegend>[0]> = {}) =>
    render(
      <TajweedLegend
        open
        counts={counts()}
        page={7}
        selection={null}
        credit={null}
        onClose={noop}
        {...over}
      />,
    );

  it("renders nothing when closed", () => {
    const { container } = render(
      <TajweedLegend
        open={false}
        counts={counts()}
        page={7}
        selection={null}
        credit={null}
        onClose={noop}
      />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("is a modal dialog that takes focus (HopPopover's contract)", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("names every rule in words, so colour is never the only channel", () => {
    open();
    for (const label of ["مدّ", "همزة وصل", "غنّة وإخفاء", "إدغام", "قلقلة", "لا يُلفظ"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("says what is on THIS page, including the rules that are not", () => {
    open();
    // 2:38 and 2:39 between them carry one madd, one madd lāzim, one wasl.
    expect(screen.getAllByText(/١ آية في صفحة ٧/).length).toBe(3);
    expect(screen.getAllByText("لا شيء في هذه الصفحة").length).toBe(4);
  });

  it("spells out the selected ayah's rules as text chips", () => {
    open({
      selection: { label: "البقرة · ٢:٣٨", marks: lens().marksForKey("quran/hafs-kfqc/2:38") },
    });
    const section = screen.getByLabelText("أحكام الآية المحددة");
    expect(section.textContent).toContain("البقرة · ٢:٣٨");
    expect(section.textContent).toContain("مدّ لازم");
  });

  it("states the beta status and the ayah-granularity caveat", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("تجريبية");
    expect(dialog.textContent).toContain("الآية كاملة");
  });

  it("carries the source credit and its link — CC BY 4.0's actual condition", () => {
    open({ credit: { text: "رخصة CC BY 4.0", href: "https://github.com/cpfair/quran-tajweed" } });
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://github.com/cpfair/quran-tajweed");
  });
});
