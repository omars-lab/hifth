import { afterEach, describe, expect, it, vi } from "vitest";
import { clearFaults, noteFault } from "./fault-log";
import { stringsFor } from "./i18n";
import { STEP_LIMIT, clearSteps, noteViewChange } from "./step-log";
import { REPORT_DEVICE_LINES, REPORT_FAULTS, STEP_WORDS, SUPPORT_ADDRESS, deviceKind, gatherFacts, mailLink, reportText, type ReportFacts } from "./problem-report";

const FACTS: ReportFacts = {
  platform: "ios",
  appVersion: "0.1.0 (7)",
  commit: "abc1234def",
  userAgent: "Made-up browser 1.0",
  device: "iPad",
  screen: "820 × 1180 at 2×",
  language: "ar",
  when: "2026-11-16T12:00:00.000Z",
  faults: [],
  steps: [],
  deviceReports: null,
};

/** Made-up lines in the shape the app's DeviceReports.summary writes. */
const DEVICE_LINES =
  "- 2026-11-17 08:30 crash (exception 1, signal 11), app 0.1.0 (7)\n" +
  "  at Hifth +0x1a2b < Hifth +0x3c4d < UIKitCore +0x10\n" +
  "- 2026-11-16 21:04 froze for 20 sec, app 0.1.0 (7)";

afterEach(() => {
  vi.useRealTimers();
  clearFaults();
  clearSteps();
  localStorage.clear();
  delete (window as { __HIFTH_NATIVE__?: unknown }).__HIFTH_NATIVE__;
});

describe("the problem report", () => {
  it("names the app, its version, the build, the device, the screen, the language and the time", () => {
    const text = reportText(FACTS);
    expect(text).toContain("App: iPad or iPhone app 0.1.0 (7)");
    expect(text).toContain("Built from: abc1234def");
    expect(text).toContain("Device: iPad");
    expect(text).toContain("Web view: Made-up browser 1.0");
    expect(text).toContain("Screen: 820 × 1180 at 2×");
    expect(text).toContain("Language: ar");
    expect(text).toContain("Time: 2026-11-16T12:00:00.000Z");
    expect(text).toContain("Errors: none kept since the page opened");
  });

  it("names an iPad as an iPad, though its web view says it is a Mac", () => {
    // Seen on the store build, 2026-11-17: an iPad's report said "Macintosh",
    // because iPads present themselves to web pages as Macs. A Mac has no touch
    // screen, so touch points tell the two apart.
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";
    expect(deviceKind(mac, 5)).toBe("iPad");
    expect(deviceKind(mac, 0)).toBe("Mac");
    expect(deviceKind("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5)).toBe("iPhone");
    expect(deviceKind("Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)", 5)).toBe("iPad");
    expect(deviceKind("Mozilla/5.0 (Linux; Android 14)", 5)).toBe("Android");
    expect(deviceKind("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0)).toBe("Windows");
    expect(deviceKind("Made-up browser 1.0", 0)).toBe("not known");
  });

  it("carries only the latest errors, each cut short", () => {
    const faults = Array.from({ length: 9 }, (_, i) => ({
      at: Date.UTC(2026, 10, 16, 12, 0, i),
      how: "uncaught" as const,
      message: `made-up fault ${i} ${"x".repeat(400)}`,
      where: "index.js:42",
    }));
    const text = reportText({ ...FACTS, faults });
    expect(text).toContain(`the last ${REPORT_FAULTS}`);
    expect(text).not.toContain("made-up fault 3");
    expect(text).toContain("12:00:08 uncaught at index.js:42: made-up fault 8");
    for (const line of text.split("\n")) expect(line.length).toBeLessThan(260);
  });

  it("lists the reader's last steps by name, a run of the same step as one line", () => {
    expect(reportText(FACTS)).toContain("Steps: none kept since the page opened");
    const steps = [
      { at: Date.UTC(2026, 10, 16, 11, 58, 0), name: "open" as const, count: 1 },
      { at: Date.UTC(2026, 10, 16, 11, 59, 30), name: "turn" as const, count: 12 },
      { at: Date.UTC(2026, 10, 16, 11, 59, 40), name: "verse" as const, count: 1 },
    ];
    const text = reportText({ ...FACTS, steps });
    expect(text).toContain("Steps (the last 3, oldest first):");
    expect(text).toContain("- 11:59:30 turned to another page (12 times)");
    expect(text).toContain("- 11:59:40 chose a verse\n");
    expect(text.indexOf("Steps (")).toBeLessThan(text.indexOf("Errors:"));
  });

  it("prints a sentence for every step code, and no code on its own", () => {
    const steps = (Object.keys(STEP_WORDS) as (keyof typeof STEP_WORDS)[]).map((name, i) => ({ at: i, name, count: 1 }));
    const lines = reportText({ ...FACTS, steps })
      .split("\n")
      .filter((line) => line.startsWith("- 00:00:00 "));
    expect(lines).toHaveLength(steps.length);
    for (const line of lines) expect(line.slice("- 00:00:00 ".length)).toMatch(/^[a-z]+ [a-z ]+$/);
  });

  it("takes the steps the app kept, and never which page they were on", () => {
    // The clock is fixed: the report's time line once ended in ".438" seconds
    // and matched the page number by chance (a commit check, 2026-11-20).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 10, 20, 7, 58, 11, 438));
    noteViewChange({ edition: "e", select: null, page: 437 }, { edition: "e", select: null, page: 438 });
    const text = reportText(gatherFacts());
    expect(text).toContain("turned to another page");
    const kept = text.replace(/^Time: .*$/m, "");
    expect(kept).not.toContain("437");
    expect(kept).not.toContain("438");
  });

  it("says when it comes from the website, or from a laptop's own copy", () => {
    const text = reportText({ ...FACTS, platform: "browser", appVersion: null, commit: null });
    expect(text).toContain("App: website\n");
    expect(text).toContain("Built from: a laptop's working copy");
  });

  it("never holds the reader's notes or marks, even when they are on the device", () => {
    localStorage.setItem("hifth:notes", JSON.stringify([{ text: "a made-up private note" }]));
    localStorage.setItem("hifth:marks", "made-up-mark-words");
    noteFault("drawing", new Error("made-up drawing error"));
    const text = reportText(gatherFacts());
    expect(text).toContain("made-up drawing error");
    expect(text).not.toContain("made-up private note");
    expect(text).not.toContain("made-up-mark-words");
  });

  it("reads the app's version from the app when it is inside one", () => {
    (window as { __HIFTH_NATIVE__?: unknown }).__HIFTH_NATIVE__ = {
      platform: "macos",
      publicBase: "https://example.invalid/",
      appVersion: "0.2.0 (3)",
    };
    const facts = gatherFacts();
    expect(facts.platform).toBe("macos");
    expect(facts.appVersion).toBe("0.2.0 (3)");
  });

  it("is a website report with no version in a browser", () => {
    const facts = gatherFacts();
    expect(facts.platform).toBe("browser");
    expect(facts.appVersion).toBeNull();
  });

  it("opens a mail to the project's address with the report in it, the reader's own words first", () => {
    const link = mailLink("REPORT-LINES", "What happened?");
    expect(link.startsWith(`mailto:${SUPPORT_ADDRESS}?`)).toBe(true);
    const params = new URLSearchParams(link.slice(link.indexOf("?") + 1));
    expect(params.get("subject")).toBe("Hifth problem report");
    const body = params.get("body") ?? "";
    expect(body.indexOf("What happened?")).toBeLessThan(body.indexOf("REPORT-LINES"));
  });

  it("keeps a full report's mail link short enough for mail apps", () => {
    const faults = Array.from({ length: 20 }, (_, i) => ({
      at: i,
      how: "drawing" as const,
      message: "y".repeat(300),
    }));
    const steps = Array.from({ length: STEP_LIMIT }, (_, i) => ({
      at: i,
      name: i % 2 ? ("follow" as const) : ("back" as const),
      count: 99,
    }));
    const deviceReports = Array.from({ length: 40 }, () => "- 2026-11-17 08:30 crash (exception 1, signal 11), app 0.1.0 (7)").join("\n");
    expect(mailLink(reportText({ ...FACTS, faults, steps, deviceReports }), "What happened?").length).toBeLessThan(4000);
  });

  it("lists the crash and freeze reports the app keeps, after the errors", () => {
    const text = reportText({ ...FACTS, deviceReports: DEVICE_LINES });
    expect(text).toContain(`Crash and freeze reports from Apple's system, kept on this device (newest first):\n${DEVICE_LINES}`);
    expect(text.indexOf("Errors")).toBeLessThan(text.indexOf("Crash and freeze"));
  });

  it("says when the app keeps none, and leaves the section out on the website", () => {
    expect(reportText(FACTS)).toContain("Crash and freeze reports: none kept on this device");
    expect(reportText({ ...FACTS, platform: "browser", appVersion: null })).not.toContain("Crash and freeze");
  });

  it("takes no more from the app than a few short lines", () => {
    const deviceReports = Array.from({ length: 30 }, (_, i) => `- made-up line ${i} ${"z".repeat(400)}`).join("\n");
    const text = reportText({ ...FACTS, deviceReports });
    const section = text.slice(text.indexOf("Crash and freeze")).split("\n").slice(1);
    expect(section).toHaveLength(REPORT_DEVICE_LINES);
    expect(text).not.toContain(`made-up line ${REPORT_DEVICE_LINES}`);
    for (const line of section) expect(line.length).toBeLessThan(200);
  });

  it("reads the device's reports from the app, and ignores anything that is not text", () => {
    const marker = (deviceReports: unknown) => {
      (window as { __HIFTH_NATIVE__?: unknown }).__HIFTH_NATIVE__ = {
        platform: "ios",
        publicBase: "https://example.invalid/",
        deviceReports,
      };
    };
    marker(DEVICE_LINES);
    expect(gatherFacts().deviceReports).toBe(DEVICE_LINES);
    marker(42);
    expect(gatherFacts().deviceReports).toBeNull();
    marker("");
    expect(gatherFacts().deviceReports).toBeNull();
  });

  it("keeps the page an error names, so the reader is promised no list of pages, not no page at all", () => {
    noteFault("uncaught", new Error("page 45 fetch failed: 404"));
    expect(reportText(gatherFacts())).toContain("page 45 fetch failed");
    for (const lang of ["en", "ar"] as const) {
      const body = stringsFor(lang).reportBody;
      expect(body).not.toMatch(/none of your notes, marks or the pages|ولا الصفحات التي قرأتها/);
      expect(body).toMatch(/no list of the pages|ولا قائمة بالصفحات/);
    }
  });
});
