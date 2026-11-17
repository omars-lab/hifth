/**
 * The report a reader can choose to send when something goes wrong (launch
 * item 18).
 *
 * The reader decides who sees their data, so this builds the whole report as
 * plain text first; the "Report a problem" panel shows every line of it, and
 * only then offers to open the reader's own mail app with it filled in. Nothing
 * is sent from here, and nothing is sent without the reader pressing send in
 * their mail app.
 *
 * What it holds: which app and version, the build's commit, the device's
 * browser line, the screen size, the language, the time, and the last few
 * errors the page kept in memory (`fault-log.ts`). What it never holds: the
 * reader's notes, marks, bookmarks, a list of the pages they read, or anything
 * they typed. The test checks that by writing made-up notes to storage and
 * looking for them in the report. An error's own words can still name a page
 * (a page that failed to load says which), so the reader is promised no list
 * of pages, not that no page number ever appears.
 *
 * "The last few steps by name" from the launch page waits on the app's own log
 * (launch item 19); until then the report says only what is listed above.
 */

import { recentFaults, type Fault } from "./fault-log";
import { nativeInfo } from "./native-bridge";
import { SOURCE_COMMIT, isCommit } from "./provenance";

/** Where reports go: the project's own address, chosen by the owner 2026-11-14. */
export const SUPPORT_ADDRESS = "hello@hifth.app";

/** How many of the kept errors go in; the latest matter, and a mail link has a length limit. */
export const REPORT_FAULTS = 5;
const FAULT_MESSAGE_LIMIT = 200;

export interface ReportFacts {
  /** "ios" or "macos" inside the apps, "browser" on the website. */
  readonly platform: "ios" | "macos" | "browser";
  /** The app's version and build, e.g. "0.1.0 (1)"; the website has none. */
  readonly appVersion: string | null;
  /** The commit the page was built from, or null on a laptop's dev server. */
  readonly commit: string | null;
  readonly userAgent: string;
  /** The kind of device in plain words (`deviceKind`), since the line above can lie. */
  readonly device: string;
  /** Width × height in CSS pixels, and the pixel ratio. */
  readonly screen: string;
  readonly language: string;
  /** When the report was made, as an ISO time. */
  readonly when: string;
  readonly faults: readonly Fault[];
}

/**
 * What the report says, read from the page as it is now. It reads the app's
 * marker, the build's commit, the browser and the kept errors, and nothing
 * else: not storage, not the address bar, not anything on the page.
 */
export function gatherFacts(): ReportFacts {
  const info = nativeInfo();
  const ratio = window.devicePixelRatio || 1;
  return {
    platform: info?.platform ?? "browser",
    appVersion: info?.appVersion ?? null,
    commit: isCommit(SOURCE_COMMIT) ? SOURCE_COMMIT : null,
    userAgent: navigator.userAgent,
    device: deviceKind(navigator.userAgent, navigator.maxTouchPoints || 0),
    screen: `${window.innerWidth} × ${window.innerHeight} at ${ratio}×`,
    language: document.documentElement.lang || navigator.language,
    when: new Date().toISOString(),
    faults: recentFaults(),
  };
}

/**
 * What kind of device this is. An iPad tells web pages it is a Mac, so a Mac
 * that has a touch screen is an iPad: no Mac has one.
 */
export function deviceKind(userAgent: string, touchPoints: number): string {
  if (/iPhone/.test(userAgent)) return "iPhone";
  if (/iPad/.test(userAgent)) return "iPad";
  if (/Macintosh/.test(userAgent)) return touchPoints > 1 ? "iPad" : "Mac";
  if (/Android/.test(userAgent)) return "Android";
  if (/Windows/.test(userAgent)) return "Windows";
  if (/Linux/.test(userAgent)) return "Linux";
  return "not known";
}

function platformName(platform: ReportFacts["platform"]): string {
  if (platform === "ios") return "iPad or iPhone app";
  if (platform === "macos") return "Mac app";
  return "website";
}

/** The report, as the lines the reader sees and the mail carries. */
export function reportText(facts: ReportFacts): string {
  const lines = [
    "Hifth problem report",
    "",
    `App: ${platformName(facts.platform)}${facts.appVersion ? ` ${facts.appVersion}` : ""}`,
    `Built from: ${facts.commit ?? "a laptop's working copy"}`,
    `Device: ${facts.device}`,
    `Web view: ${facts.userAgent}`,
    `Screen: ${facts.screen}`,
    `Language: ${facts.language}`,
    `Time: ${facts.when}`,
    "",
  ];
  const faults = facts.faults.slice(-REPORT_FAULTS);
  if (faults.length === 0) {
    lines.push("Errors: none kept since the page opened");
  } else {
    lines.push(`Errors (the last ${faults.length}, oldest first):`);
    for (const fault of faults) {
      const at = new Date(fault.at).toISOString().slice(11, 19);
      const where = fault.where ? ` at ${fault.where}` : "";
      lines.push(`- ${at} ${fault.how}${where}: ${fault.message.slice(0, FAULT_MESSAGE_LIMIT)}`);
    }
  }
  return lines.join("\n");
}

/**
 * The mail link: the support address, a subject naming the app, and a body
 * that leaves room at the top for the reader's own words before the report.
 */
export function mailLink(report: string, intro: string): string {
  const subject = "Hifth problem report";
  const body = `${intro}\n\n\n---\n${report}`;
  return `mailto:${SUPPORT_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
