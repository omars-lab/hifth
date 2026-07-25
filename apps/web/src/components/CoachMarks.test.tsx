import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoachMarks, COACH_STORAGE_KEY } from "./CoachMarks";

describe("CoachMarks", () => {
  beforeEach(() => localStorage.clear());

  it("teaches the first verb on a fresh device", () => {
    render(<CoachMarks ready />);
    expect(screen.getByRole("region", { name: "كيف تتنقّل" })).toBeInTheDocument();
    expect(screen.getByText("المس آية")).toBeInTheDocument();
  });

  it("waits until the app is usable", () => {
    render(<CoachMarks ready={false} />);
    expect(screen.queryByRole("region", { name: "كيف تتنقّل" })).not.toBeInTheDocument();
  });

  it("walks the three verbs and keeps focus on the primary button", () => {
    render(<CoachMarks ready />);
    fireEvent.click(screen.getByText("التالي"));
    expect(screen.getByText("اضغط واسحب")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByText("التالي"));
    fireEvent.click(screen.getByText("التالي"));
    expect(screen.getByText("المس رقاقة")).toBeInTheDocument();
    // Last card: the primary button becomes "done", not another "next".
    expect(screen.queryByText("التالي")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("تمّ"));
    expect(screen.queryByRole("region", { name: "كيف تتنقّل" })).not.toBeInTheDocument();
  });

  it("remembers the dismissal, so it never returns", () => {
    const { unmount } = render(<CoachMarks ready />);
    fireEvent.click(screen.getByText("تخطَّ"));
    expect(localStorage.getItem(COACH_STORAGE_KEY)).toBe("1");
    unmount();
    render(<CoachMarks ready />);
    expect(screen.queryByRole("region", { name: "كيف تتنقّل" })).not.toBeInTheDocument();
  });

  it("is skippable from the keyboard alone", () => {
    render(<CoachMarks ready />);
    fireEvent.keyDown(screen.getByRole("region", { name: "كيف تتنقّل" }), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "كيف تتنقّل" })).not.toBeInTheDocument();
    expect(localStorage.getItem(COACH_STORAGE_KEY)).toBe("1");
  });
});
