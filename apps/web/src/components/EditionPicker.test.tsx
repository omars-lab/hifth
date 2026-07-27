import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Concordance, EDITIONS } from "@hifth/core";
import { EditionPicker } from "./EditionPicker";

const CURRENT = "hafs-kfqc";

function open(props: Partial<React.ComponentProps<typeof EditionPicker>> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  render(
    <EditionPicker
      open
      current={CURRENT}
      currentKey={`quran/${CURRENT}/2:255`}
      concordance={new Concordance()}
      onSelect={onSelect}
      onClose={onClose}
      {...props}
    />,
  );
  return { onSelect, onClose };
}

describe("EditionPicker", () => {
  it("lists every edition, not only the vendored one", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "المصحف" });
    for (const e of EDITIONS) {
      expect(dialog).toHaveTextContent(e.label);
    }
  });

  it("badges the current mushaf and disables its row", () => {
    open();
    expect(screen.getByText("الحالي")).toBeInTheDocument();
    const row = screen.getByRole("button", { current: true });
    expect(row).toBeDisabled();
  });

  it("surfaces an unvendored edition disabled, with its real reason", () => {
    open();
    const unvendored = EDITIONS.filter((e) => e.status !== "vendored");
    expect(unvendored.length).toBeGreaterThan(0);
    for (const e of unvendored) {
      // Two riwayat share one blocker (the same licence), hence getAllByText.
      expect(screen.getAllByText(e.reason!).length).toBeGreaterThan(0);
    }
    // Nothing offered that cannot be delivered.
    const pickable = screen
      .getAllByRole("button")
      .filter((b) => !b.hasAttribute("disabled") && b.getAttribute("aria-label") !== "إغلاق");
    expect(pickable).toHaveLength(0);
  });

  it("says there is no concordance table rather than implying the numbers match", () => {
    open();
    expect(screen.getAllByText("لا جدول مقابلة بعد").length).toBe(EDITIONS.length - 1);
  });

  it("shows the counterpart ayah when a table exists", () => {
    const concordance = new Concordance();
    const other = EDITIONS.find((e) => e.id !== CURRENT)!;
    concordance.add({
      from: CURRENT,
      to: other.id,
      base: "identity",
      deltas: { "2:255": "2:254" },
    });
    open({ concordance });
    expect(screen.getByText("تقابلها ٢:٢٥٤")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const { onClose } = open();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "المصحف" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    render(
      <EditionPicker
        open={false}
        current={CURRENT}
        currentKey={null}
        concordance={new Concordance()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
