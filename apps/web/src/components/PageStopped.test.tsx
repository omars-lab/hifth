import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/preact";
import { stringsFor } from "../i18n";
import { clearFaults, recentFaults } from "../fault-log";
import { PageStopped } from "./PageStopped";

/*
 * Launch item 15: a part of the page that throws while it draws used to take
 * the whole page with it, and the reader was left looking at a blank screen
 * with nothing to press. Now the page says it stopped, says their notes are
 * safe, and offers the one thing that helps: opening the page again.
 */

const AR = stringsFor("ar");

function Throws(): JSX.Element {
  throw new Error("made-up fault while drawing");
}

afterEach(() => {
  clearFaults();
  vi.restoreAllMocks();
});

describe("when a part of the page throws while it draws", () => {
  it("shows the stopped screen instead of a blank page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <PageStopped>
        <Throws />
      </PageStopped>,
    );
    expect(screen.getByRole("heading", { name: AR.pageStoppedTitle })).toBeTruthy();
    expect(screen.getByText(AR.pageStoppedBody)).toBeTruthy();
    expect(screen.getByRole("button", { name: AR.pageStoppedReload })).toBeTruthy();
  });

  it("keeps what went wrong for a later report, and only in memory", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <PageStopped>
        <Throws />
      </PageStopped>,
    );
    const faults = recentFaults();
    expect(faults).toHaveLength(1);
    expect(faults[0]?.message).toBe("made-up fault while drawing");
    expect(faults[0]?.how).toBe("drawing");
  });

  it("opens the page again when the button is pressed", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    render(
      <PageStopped reload={reload}>
        <Throws />
      </PageStopped>,
    );
    fireEvent.click(screen.getByRole("button", { name: AR.pageStoppedReload }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("offers a problem report that already holds the error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <PageStopped>
        <Throws />
      </PageStopped>,
    );
    // The report panel loads from the rarely used tools' file once the card shows.
    fireEvent.click(await screen.findByRole("button", { name: AR.reportOpen }, { timeout: 5000 }));
    const box = screen.getByRole("textbox", { name: AR.reportTextLabel }) as HTMLTextAreaElement;
    expect(box.value).toContain("made-up fault while drawing");
  });

  it("draws the page as usual when nothing throws", () => {
    render(
      <PageStopped>
        <p>the page</p>
      </PageStopped>,
    );
    expect(screen.getByText("the page")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: AR.pageStoppedTitle })).toBeNull();
  });
});
