import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Jumper } from "./Jumper";

/** Render an open jumper and hand back its field + the jump spy. */
function open() {
  const onJump = vi.fn();
  const onClose = vi.fn();
  render(<Jumper open onJump={onJump} onClose={onClose} />);
  const input = screen.getByRole("combobox");
  return { onJump, onClose, input };
}

describe("Jumper", () => {
  it("is a modal dialog with the field focused on open", () => {
    const { input } = open();
    const dialog = screen.getByRole("dialog", { name: "اذهب إلى" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.activeElement).toBe(input);
  });

  it("renders nothing when closed", () => {
    render(<Jumper open={false} onJump={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers the thirty juz when the field is empty", () => {
    open();
    const grid = screen.getByRole("group", { name: "الأجزاء" });
    expect(grid.querySelectorAll("button")).toHaveLength(30);
  });

  it("jumps to a juz from the grid", () => {
    const { onJump, onClose } = open();
    fireEvent.click(screen.getByRole("button", { name: "الجزء ٩" }));
    // Juz 9 starts at 7:88 (JUZ_STARTS in core) — the grid must not invent it.
    expect(onJump).toHaveBeenCalledWith({ kind: "juz", surah: 7, ayah: 88, juz: 9 });
    expect(onClose).toHaveBeenCalled();
  });

  it("finds a surah by name and lands on its first ayah", () => {
    const { onJump, input } = open();
    fireEvent.change(input, { target: { value: "البقرة" } });
    fireEvent.click(screen.getAllByRole("option")[0]!);
    expect(onJump).toHaveBeenCalledWith({ kind: "surah", surah: 2, ayah: 1 });
  });

  it("takes the active option on Enter", () => {
    const { onJump, input } = open();
    fireEvent.change(input, { target: { value: "2:255" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onJump).toHaveBeenCalledWith({ kind: "ayah", surah: 2, ayah: 255 });
  });

  it("moves the active option with the arrows", () => {
    const { onJump, input } = open();
    fireEvent.change(input, { target: { value: "نس" } });
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onJump.mock.calls[0]![0].surah).toBe(10); // يونس, the second reading
  });

  it("says so when nothing matches, instead of guessing", () => {
    const { input, onJump } = open();
    fireEvent.change(input, { target: { value: "زقزق" } });
    expect(screen.getByText("لا مكان بهذا الاسم أو الرقم")).toBeInTheDocument();
    expect(onJump).not.toHaveBeenCalled();
  });

  it("closes on Escape without going anywhere", () => {
    const { onClose, onJump, input } = open();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(onJump).not.toHaveBeenCalled();
  });
});
