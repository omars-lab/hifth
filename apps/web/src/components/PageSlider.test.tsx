import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PageSlider } from "./PageSlider";

/** What this build actually holds until Loop 4b vendors the rest. */
const VENDORED = [7, 9, 19];
const TOTAL = 604;

const noop = () => {};

function slider(over: Partial<React.ComponentProps<typeof PageSlider>> = {}) {
  const props = {
    total: TOTAL,
    available: VENDORED,
    page: 9,
    onStep: noop as (s: 1 | -1) => void,
    onGoTo: noop as (l: number, a: number) => void,
    ...over,
  };
  render(<PageSlider {...props} />);
  return screen.getByRole("slider");
}

describe("PageSlider", () => {
  it("spans the printed book, not the vendored inventory", () => {
    // Three pages are in `public/assets`; the mus'haf is 604 pages long. A
    // track that stopped at 19 would quietly redefine the book as whatever
    // happens to have been vendored this week.
    const input = slider();
    expect(input.getAttribute("min")).toBe("1");
    expect(input.getAttribute("max")).toBe("604");
  });

  it("says how much of the book is actually here", () => {
    slider();
    expect(screen.getByText("المتوفّر ٣ من ٦٠٤ صفحة")).toBeTruthy();
  });

  it("names the page rather than reading out a bare number", () => {
    // Without `aria-valuetext` a screen reader says "9" — a number with no unit
    // in a bar made of numbers.
    expect(slider().getAttribute("aria-valuetext")).toBe("صفحة 9 من 604");
  });

  it("puts the previous page on the right edge and the next on the left", () => {
    // The bar is pinned RTL in both languages, so the *first* child renders at
    // the right. Earlier in the mus'haf is to the right; later is to the left.
    // This is the same convention `appKeyAction` encodes as ArrowLeft = +1.
    const onStep = vi.fn();
    render(
      <PageSlider total={TOTAL} available={VENDORED} page={9} onStep={onStep} onGoTo={noop} />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]!.getAttribute("aria-label")).toBe("الصفحة السابقة");
    expect(buttons[buttons.length - 1]!.getAttribute("aria-label")).toBe("الصفحة التالية");

    fireEvent.click(buttons[0]!);
    expect(onStep).toHaveBeenLastCalledWith(-1);
    fireEvent.click(buttons[buttons.length - 1]!);
    expect(onStep).toHaveBeenLastCalledWith(1);
  });

  it("commits on release, not on every value the thumb passes over", () => {
    // Each page is a ~170 KB inline SVG. A drag from 9 to 300 crosses 291 of
    // them; navigating on `input` would mount every one.
    const onGoTo = vi.fn();
    const input = slider({ onGoTo });
    fireEvent.input(input, { target: { value: "300" } });
    fireEvent.input(input, { target: { value: "301" } });
    expect(onGoTo).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "301" } });
    expect(onGoTo).toHaveBeenCalledTimes(1);
  });

  it("lands on the nearest page it has, and reports both numbers", () => {
    // The caller needs `asked` as well as `landed` — the difference between the
    // two is exactly what has to be said out loud.
    const onGoTo = vi.fn();
    const input = slider({ onGoTo });
    fireEvent.change(input, { target: { value: "300" } });
    expect(onGoTo).toHaveBeenCalledWith(19, 300);
  });

  it("shows where the drag would land before the reader lets go", () => {
    const input = slider();
    fireEvent.input(input, { target: { value: "300" } });
    expect(screen.getByText("صفحة 300 من 604")).toBeTruthy();
    expect(screen.getByText("أقرب صفحة متوفّرة · صفحة 19")).toBeTruthy();
  });

  it("says nothing about snapping when the page is one we hold", () => {
    const input = slider();
    fireEvent.input(input, { target: { value: "7" } });
    expect(screen.getByText("صفحة 7 من 604")).toBeTruthy();
    expect(screen.queryByText(/أقرب صفحة/)).toBeNull();
  });

  it("gives the arrow keys to the page turn, not to the range's own step", () => {
    // A range input's arrows move by `step` — one page of 604. Inside a
    // three-page inventory every press would snap straight back, so the bar
    // steps between vendored pages instead. Left is forward: the next page of a
    // mus'haf lies to the left.
    const onStep = vi.fn();
    const input = slider({ onStep });
    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(onStep).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(onStep).toHaveBeenLastCalledWith(-1);
  });

  it("leaves modified arrows to the browser", () => {
    const onStep = vi.fn();
    fireEvent.keyDown(slider({ onStep }), { key: "ArrowLeft", metaKey: true });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("sends Home and End to the ends of what exists", () => {
    const onGoTo = vi.fn();
    const input = slider({ onGoTo });
    fireEvent.keyDown(input, { key: "Home" });
    expect(onGoTo).toHaveBeenLastCalledWith(7, 7);
    fireEvent.keyDown(input, { key: "End" });
    expect(onGoTo).toHaveBeenLastCalledWith(19, 19);
  });

  it("refuses to move before the manifest lands", () => {
    // No pages means no nearest page. The bar keeps its space in the layout so
    // nothing shifts under a thumb when the manifest arrives, but it is inert.
    const onGoTo = vi.fn();
    const input = slider({ available: [], total: 1, onGoTo });
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { value: "1" } });
    expect(onGoTo).not.toHaveBeenCalled();
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});
