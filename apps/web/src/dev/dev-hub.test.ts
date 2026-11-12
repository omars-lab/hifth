import { describe, expect, it } from "vitest";
import { devHubRoute } from "./dev-hub";

describe("the features page's address on the dev server", () => {
  it("serves the page and its pictures", () => {
    expect(devHubRoute("/dev-hub/")).toEqual({ kind: "file", file: "index.html" });
    expect(devHubRoute("/dev-hub/index.html")).toEqual({ kind: "file", file: "index.html" });
    expect(devHubRoute("/dev-hub/?x=1#top")).toEqual({ kind: "file", file: "index.html" });
    expect(devHubRoute("/dev-hub/shots/tool-note.png")).toEqual({ kind: "file", file: "shots/tool-note.png" });
  });

  it("adds the slash, so the page's relative links resolve", () => {
    expect(devHubRoute("/dev-hub")).toEqual({ kind: "add-slash" });
  });

  it("answers nothing else, so no other file can be read through it", () => {
    for (const url of [
      "/dev-hub/../.env",
      "/dev-hub/%2e%2e/.env",
      "/dev-hub/shots/../../.env",
      "/dev-hub/shots/x.png/../../a",
      "/dev-hub/taken-at.txt",
      "/dev-hub/shots/Tool_Note.png",
      "/dev-hubx/",
      "/",
      "/#/hafs-kfqc/p7",
    ]) {
      expect(devHubRoute(url), url).toBeNull();
    }
  });
});
