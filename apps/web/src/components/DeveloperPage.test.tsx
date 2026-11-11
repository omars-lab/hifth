import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/preact";
import DeveloperPage from "./DeveloperPage";

// The developer page (docs/design/app-pages.md ②): what was checked by hand, in one place.
// Written before the page (2026-11-11) and watched failing: the file did not exist.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("DeveloperPage", () => {
  it("says how this app was built, switch by switch, with the command for each", () => {
    render(<DeveloperPage onClose={() => {}} />);
    const built = screen.getByRole("region", { name: "How this app was built" });
    for (const name of ["The private pitch layer", "The library's page laid over ours", "The speed probe"]) {
      expect(within(built).getByText(name)).toBeTruthy();
    }
    expect(within(built).getByText("make dev-qul")).toBeTruthy();
    expect(within(built).getAllByText(/^(on|off)$/).length).toBe(3);
  });

  it("lists what this browser remembers for the app, and nothing else", () => {
    localStorage.setItem("hifth.app.pages.v1", "row");
    localStorage.setItem("someone.elses.key", "x");
    render(<DeveloperPage onClose={() => {}} />);
    const kept = screen.getByRole("region", { name: "What this browser remembers" });
    expect(within(kept).getByText("hifth.app.pages.v1")).toBeTruthy();
    expect(within(kept).queryByText("someone.elses.key")).toBeNull();
  });

  it("forgets one remembered thing when asked, and leaves the rest", () => {
    localStorage.setItem("hifth.app.pages.v1", "row");
    localStorage.setItem("hifth.record.view.v1", "month");
    render(<DeveloperPage onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Forget hifth.record.view.v1" }));
    expect(localStorage.getItem("hifth.record.view.v1")).toBeNull();
    expect(localStorage.getItem("hifth.app.pages.v1")).toBe("row");
    expect(screen.queryByText("hifth.record.view.v1")).toBeNull();
  });

  it("links the pages that are opened by hand today, each with its address-bar switch", () => {
    render(<DeveloperPage onClose={() => {}} />);
    const links = screen.getByRole("region", { name: "Pages and switches opened by hand" });
    const hrefs = within(links).getAllByRole("link").map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.includes("qul-diff.html"))).toBe(true);
    for (const sw of ["lang=ar", "lang=en", "phonebar=a", "share=a"]) {
      expect(hrefs.some((h) => h.includes(sw))).toBe(true);
    }
  });

  it("goes back to the mus'haf on Escape", () => {
    const onClose = vi.fn();
    render(<DeveloperPage onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
