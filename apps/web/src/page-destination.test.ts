import { describe, expect, it } from "vitest";
import { useState } from "react";
import { act, renderHook } from "@testing-library/preact";
import { usePageDestination } from "./page-destination";

/** The hook as the app holds it: the page in state, set only through the hook. */
function useHeld() {
  const [page, setPageState] = useState(7);
  return { page, ...usePageDestination(page, setPageState) };
}

describe("where the reader is going", () => {
  it("a page set by anything but a turn puts the destination there", () => {
    const { result } = renderHook(useHeld);
    result.current.pendingPageRef.current = 8; // a turn in the air
    // A hop lands on 40 before it does: the hop is where the reader is now.
    act(() => result.current.setPage(40));
    expect(result.current.pageRef.current).toBe(40);
    expect(result.current.pendingPageRef.current).toBe(40);
  });

  it("a flick let go as the last turn lands keeps its own destination", () => {
    // Two quick flicks from 7: the first lands on 8, and the second is let go
    // after the page was set to 8 but before that change had settled. Reset
    // to 8 then, the second flick's own landing on 9 found the destination
    // moved and was dropped, and the header stayed on 8.
    const { result } = renderHook(useHeld);
    result.current.pendingPageRef.current = 8;
    act(() => {
      result.current.setPage(8);
      result.current.pendingPageRef.current = 9;
    });
    expect(result.current.pageRef.current).toBe(8);
    expect(result.current.pendingPageRef.current).toBe(9);
  });

  it("a jump undone in the same moment leaves the destination where the page is", () => {
    // A part marker tapped as the app opens: the jump says "going to 42", and
    // the opening link puts the page back on 7 before either has shown. The
    // page never visibly changed, so the destination stayed 42, and every
    // later tap on that marker was taken for the jump already under way.
    const { result } = renderHook(useHeld);
    act(() => {
      result.current.setPage(42);
      result.current.setPage(7);
    });
    expect(result.current.page).toBe(7);
    expect(result.current.pendingPageRef.current).toBe(7);
  });
});
