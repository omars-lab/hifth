import { afterEach, describe, expect, it } from "vitest";
import { clearFaults, noteFault } from "./fault-log";
import { stringsFor } from "./i18n";
import { REPORT_FAULTS, SUPPORT_ADDRESS, deviceKind, gatherFacts, mailLink, reportText, type ReportFacts } from "./problem-report";

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
};

afterEach(() => {
  clearFaults();
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
    expect(mailLink(reportText({ ...FACTS, faults }), "What happened?").length).toBeLessThan(4000);
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
