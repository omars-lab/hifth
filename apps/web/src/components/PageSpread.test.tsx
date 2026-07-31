import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageSpread } from "./PageSpread";

/** What this build actually holds until Loop 4b vendors the rest. */
const VENDORED = [7, 9, 19];
const TOTAL = 604;

/** Stands in for the live stage. PageSpread never looks inside it. */
const STAGE = <div data-testid="live-stage">stage</div>;

function spread(over: Partial<React.ComponentProps<typeof PageSpread>> = {}) {
  const props = {
    enabled: true,
    page: 7,
    total: TOTAL,
    available: VENDORED,
    children: STAGE,
    ...over,
  };
  const { container } = render(<PageSpread {...props} />);
  return container;
}

/** The two leaves, in DOM order: right leaf first (see PageSpread's geometry note). */
function leaves(container: HTMLElement): HTMLElement[] {
  // The book, not the desk around it: `page-spread` runs the width of the window
  // and holds one child, and the leaves are inside that.
  const root = container.querySelector("[data-testid='page-book']");
  // The gutter is the last child and is not a leaf.
  return Array.from(root?.children ?? []).slice(0, 2) as HTMLElement[];
}

describe("PageSpread", () => {
  it("renders the stage alone, with no wrapper, below the breakpoint", () => {
    // Not "the spread with one panel hidden". A phone must not carry a spread's
    // DOM at all — `display: none` would still have cost the second leaf's
    // ~170 KB fetch and its Highlighter, which is the whole reason `enabled`
    // gates the mount rather than the styling.
    const container = spread({ enabled: false });
    expect(container.querySelector("[data-testid='page-spread']")).toBeNull();
    expect(screen.getByTestId("live-stage")).toBeTruthy();
  });

  it("puts the lower page number on the right", () => {
    // The mus'haf reads right to left, so the right leaf is the earlier page.
    // Asserted through DOM order because that is how the component states it:
    // first child, inside `main[dir="rtl"]`, is the right-hand leaf. If someone
    // adds a `row-reverse` to make it "look right", this fails.
    const container = spread({ page: 7 });
    const [right, left] = leaves(container);
    // Page 7 pairs with 8; 7 is the earlier page, so 7 — the live one — is on
    // the right and the hole for 8 is on the left.
    expect(right!).toContainElement(screen.getByTestId("live-stage"));
    expect(left!.textContent).toContain("صفحة 8 ليست في هذه النسخة");
  });

  it("keeps the live stage on the leaf the reader is actually on", () => {
    // All three vendored pages are odd, so under the print's real parity all
    // three are right-hand leaves. That is an accident of what was vendored, so
    // the even case is exercised with a fixture inventory rather than left to
    // Loop 4b: 8 pairs with 7 and must land on the *left*.
    for (const page of [9, 19]) {
      const container = spread({ page });
      const [right] = leaves(container);
      expect(right!.querySelector("[data-testid='live-stage']")).not.toBeNull();
    }
    const container = spread({ page: 8, available: [7, 8, 9, 19] });
    const [, left] = leaves(container);
    expect(left!.querySelector("[data-testid='live-stage']")).not.toBeNull();
  });

  it("draws the missing facing page as absent, not as blank paper", () => {
    // A blank sheet in the paper colour is a picture of a page with nothing
    // printed on it — a different and false claim. The hole says which page it
    // is and how much of the mus'haf is here.
    spread({ page: 7 });
    const absent = screen.getByRole("region", { name: "الصفحة المقابلة" });
    expect(absent.textContent).toContain("صفحة 8 ليست في هذه النسخة");
    expect(absent.textContent).toContain("المتوفّر ٣ من ٦٠٤ صفحة");
  });

  it("says the inventory in the same words the page bar uses", () => {
    // One fact, one sentence, one string. Two surfaces that phrase the vendoring
    // gap differently will eventually disagree about it.
    spread({ page: 7 });
    expect(screen.getAllByText("المتوفّر ٣ من ٦٠٤ صفحة").length).toBe(1);
  });

  it("draws a vendored facing page instead of a hole", () => {
    // Unreachable with today's three non-adjacent pages, so it is exercised with
    // a fixture inventory that has a pair. A branch that waits for Loop 4b to be
    // run for the first time is a branch Loop 4b discovers the hard way.
    const container = spread({
      page: 7,
      available: [7, 8, 9, 19],
      renderFacing: (p) => <div data-testid="facing-stage">{p}</div>,
    });
    const [, left] = leaves(container);
    expect(left!.querySelector("[data-testid='facing-stage']")?.textContent).toBe("8");
    expect(screen.queryByRole("region", { name: "الصفحة المقابلة" })).toBeNull();
  });

  it("falls back to absent when the caller cannot afford a second mount", () => {
    // `renderFacing` is optional. A caller that holds the page but declines to
    // mount it gets the honest hole, not an empty leaf.
    spread({ page: 7, available: [7, 8, 9, 19] });
    expect(screen.getByRole("region", { name: "الصفحة المقابلة" })).toBeTruthy();
  });

  it("gives page 1 a real facing leaf, because Al-Fatiha faces Al-Baqarah", () => {
    // Under the print's real parity page 1 is an ordinary right-hand leaf and
    // page 2 faces it. This used to assert the opposite — blank furniture on the
    // left — and that half-opening was the visible symptom of `spreadOf`'s wrong
    // phase, not a fact about the book.
    const container = spread({ page: 1 });
    const [right, left] = leaves(container);
    expect(right!.querySelector("[data-testid='live-stage']")).not.toBeNull();
    expect(left!.textContent).toContain("صفحة 2 ليست في هذه النسخة");
  });

  it("leaves the far side blank and unlabelled at the end of an odd-length print", () => {
    // Nothing is missing at the end of a book. Captioning this side would tell a
    // reader that page 604 is a page we failed to vendor. The Madani print is
    // even and never reaches this branch, so it is exercised with an odd `total`
    // — a branch that waits for another edition is a branch that edition finds
    // the hard way.
    const container = spread({ page: 603, total: 603, available: [603] });
    const [right, left] = leaves(container);
    expect(right!.querySelector("[data-testid='live-stage']")).not.toBeNull();
    expect(left!.getAttribute("aria-hidden")).toBe("true");
    expect(left!.textContent).toBe("");
    expect(screen.queryByRole("region", { name: "الصفحة المقابلة" })).toBeNull();
  });

  it("hides the gutter from the accessibility tree", () => {
    // It is a drawn shadow standing in for a binding. There is nothing to say
    // about it, and a screen reader stopping on the spine of the book is noise.
    const container = spread();
    const root = container.querySelector("[data-testid='page-book']")!;
    const gutter = root.lastElementChild!;
    expect(gutter.getAttribute("aria-hidden")).toBe("true");
  });
});
