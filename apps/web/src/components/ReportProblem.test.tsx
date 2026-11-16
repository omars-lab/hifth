import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { stringsFor } from "../i18n";
import { clearFaults, noteFault } from "../fault-log";
import { SUPPORT_ADDRESS } from "../problem-report";
import { ReportProblem } from "./ReportProblem";

/*
 * Launch item 18: a reader whose page went wrong can send us a short report.
 * The reader decides who sees their data, so the whole report is on the screen
 * before anything can be sent, it says where it goes, and the only way out is
 * the reader's own mail app, where they still have to press send.
 */

const AR = stringsFor("ar");

function reportBox(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: AR.reportTextLabel }) as HTMLTextAreaElement;
}

afterEach(() => {
  clearFaults();
  localStorage.clear();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
});

describe("Report a problem", () => {
  it("is one button until the reader presses it", () => {
    render(<ReportProblem />);
    expect(screen.getByRole("button", { name: AR.reportOpen })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the whole report, says where it goes, and offers the mail app", () => {
    noteFault("uncaught", new Error("made-up fault for the report"));
    render(<ReportProblem />);
    fireEvent.click(screen.getByRole("button", { name: AR.reportOpen }));
    expect(screen.getByRole("heading", { name: AR.reportTitle })).toBeTruthy();
    expect(screen.getByText(AR.reportBody)).toBeTruthy();
    expect(screen.getByText(SUPPORT_ADDRESS)).toBeTruthy();
    const box = reportBox();
    expect(box.readOnly).toBe(true);
    expect(box.value).toContain("Hifth problem report");
    expect(box.value).toContain("made-up fault for the report");
    const send = screen.getByRole("link", { name: AR.reportSend }) as HTMLAnchorElement;
    expect(send.getAttribute("href")?.startsWith(`mailto:${SUPPORT_ADDRESS}?`)).toBe(true);
    expect(decodeURIComponent(send.getAttribute("href") ?? "")).toContain("made-up fault for the report");
  });

  it("never puts the reader's notes or marks in what it shows or sends", () => {
    localStorage.setItem("hifth:notes", JSON.stringify([{ text: "a made-up private note" }]));
    localStorage.setItem("hifth:marks", "made-up-mark-words");
    render(<ReportProblem />);
    fireEvent.click(screen.getByRole("button", { name: AR.reportOpen }));
    const href = decodeURIComponent(screen.getByRole("link", { name: AR.reportSend }).getAttribute("href") ?? "");
    for (const shown of [reportBox().value, href]) {
      expect(shown).not.toContain("made-up private note");
      expect(shown).not.toContain("made-up-mark-words");
    }
  });

  it("closes back to the one button", () => {
    render(<ReportProblem />);
    fireEvent.click(screen.getByRole("button", { name: AR.reportOpen }));
    fireEvent.click(screen.getByRole("button", { name: AR.reportClose }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: AR.reportOpen })).toBeTruthy();
  });

  it("offers Copy only where the page may use the clipboard", async () => {
    render(<ReportProblem />);
    fireEvent.click(screen.getByRole("button", { name: AR.reportOpen }));
    expect(screen.queryByRole("button", { name: AR.reportCopy })).toBeNull();
  });

  it("copies the same report it shows", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ReportProblem />);
    fireEvent.click(screen.getByRole("button", { name: AR.reportOpen }));
    fireEvent.click(screen.getByRole("button", { name: AR.reportCopy }));
    expect(writeText).toHaveBeenCalledWith(reportBox().value);
    await waitFor(() => expect(screen.getByRole("button", { name: AR.reportCopied })).toBeTruthy());
  });
});
