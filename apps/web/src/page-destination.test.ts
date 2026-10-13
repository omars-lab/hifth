import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/preact";
import { usePageDestination } from "./page-destination";

describe("where the reader is going", () => {
  it("a page set by anything but a turn puts the destination there", () => {
    const { result, rerender } = renderHook(({ page }) => usePageDestination(page), { initialProps: { page: 7 } });
    result.current.pendingPageRef.current = 8; // a turn in the air
    // A hop lands on 40 before it does: the hop is where the reader is now.
    act(() => rerender({ page: 40 }));
    expect(result.current.pageRef.current).toBe(40);
    expect(result.current.pendingPageRef.current).toBe(40);
  });

  it("a flick let go as the last turn lands keeps its own destination", () => {
    // Two quick flicks from 7: the first lands on 8, and the second is let go
    // after the page was set to 8 but before that change had settled. Reset
    // to 8 then, the second flick's own landing on 9 found the destination
    // moved and was dropped, and the header stayed on 8.
    const { result, rerender } = renderHook(({ page }) => usePageDestination(page), { initialProps: { page: 7 } });
    result.current.pendingPageRef.current = 8;
    act(() => {
      result.current.turnLanded(8);
      rerender({ page: 8 });
      result.current.pendingPageRef.current = 9;
    });
    expect(result.current.pageRef.current).toBe(8);
    expect(result.current.pendingPageRef.current).toBe(9);
  });
});
