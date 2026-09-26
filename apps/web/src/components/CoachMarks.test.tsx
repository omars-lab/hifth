import { describe, it, expect, beforeEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoachMarks } from "./CoachMarks";

/** The strip as App holds it: open until it reports that it left. */
function Harness({ ready = true, onDismiss }: { ready?: boolean; onDismiss?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <CoachMarks
      ready={ready}
      open={open}
      onDismiss={() => {
        setOpen(false);
        onDismiss?.();
      }}
    />
  );
}

const region = () => screen.queryByRole("region", { name: "كيف تتنقّل" });

describe("CoachMarks", () => {
  beforeEach(() => localStorage.clear());

  it("stays away until the reader asks for it", () => {
    // Since 2026-09-25 the tips open only from the button in settings: a fresh
    // device goes straight to the page.
    render(<CoachMarks ready open={false} />);
    expect(region()).not.toBeInTheDocument();
  });

  it("teaches the first verb when asked", () => {
    render(<Harness />);
    expect(region()).toBeInTheDocument();
    expect(screen.getByText("المس آية")).toBeInTheDocument();
  });

  it("waits until the app is usable", () => {
    render(<Harness ready={false} />);
    expect(region()).not.toBeInTheDocument();
  });

  it("walks the three verbs and keeps focus on the primary button", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("التالي"));
    expect(screen.getByText("اضغط واسحب")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByText("التالي"));
    fireEvent.click(screen.getByText("التالي"));
    expect(screen.getByText("المس رقاقة")).toBeInTheDocument();
    // Last card: the primary button becomes "done", not another "next".
    expect(screen.queryByText("التالي")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("تمّ"));
    expect(region()).not.toBeInTheDocument();
  });

  it("starts again from the first card each time it is opened", () => {
    const { rerender } = render(<CoachMarks ready open />);
    fireEvent.click(screen.getByText("التالي"));
    rerender(<CoachMarks ready open={false} />);
    rerender(<CoachMarks ready open />);
    expect(screen.getByText("المس آية")).toBeInTheDocument();
  });

  it("announces its departure however it leaves — the band it frees is spoken for", () => {
    // App holds the storage notice until this fires, so a path that dismisses
    // the strip without reporting it would leave the notice suppressed for the
    // whole session. Every exit is checked for that reason.
    for (const leave of [
      () => fireEvent.click(screen.getByText("تخطَّ")),
      () => fireEvent.keyDown(region()!, { key: "Escape" }),
      () => {
        fireEvent.click(screen.getByText("التالي"));
        fireEvent.click(screen.getByText("التالي"));
        fireEvent.click(screen.getByText("تمّ"));
      },
    ]) {
      const onDismiss = vi.fn();
      const { unmount } = render(<Harness onDismiss={onDismiss} />);
      leave();
      expect(onDismiss).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it("is skippable from the keyboard alone", () => {
    render(<Harness />);
    fireEvent.keyDown(region()!, { key: "Escape" });
    expect(region()).not.toBeInTheDocument();
  });
});
