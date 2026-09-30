import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { describeOutcome, listsFromSpec, predictLink, type AppState } from "@hifth/core";
import { linksFor, shareShapeFromUrl } from "./share-links";

/**
 * The share sheet writes two links for the view on screen: the website's, which
 * anyone can open, and the app's, which the Mac and iPad shell opens. The app
 * link has to be one the shell's own rules accept, so each one written here is
 * run through the same copy of those rules the contract page uses.
 */
const spec = JSON.parse(
  // The tests run with apps/web as their working directory; the browser-shaped
  // test environment gives import.meta.url a scheme the file system refuses.
  readFileSync(resolve(process.cwd(), "../../docs/design/app-url-scheme.openapi.json"), "utf8"),
);
const lists = listsFromSpec(spec);
const base = "https://blog.bytesofpurpose.com/hifth/";
const ayah: AppState = { edition: "hafs-kfqc", select: { surah: 2, ayah: 48 } };

describe("the links the share sheet writes", () => {
  it("as it is: the website link the one button always wrote, and the plain app link beside it", () => {
    const out = linksFor(ayah, "", base);
    expect(out.site).toBe(base + "#/hafs-kfqc/2:48");
    expect(out.app).toBe("hifth:///hafs-kfqc/2:48");
    expect(describeOutcome(predictLink(out.app, lists))).toBe("open #/hafs-kfqc/2:48");
  });

  it("with a panel to open on arrival: both links carry it, and the shell accepts the app link", () => {
    const out = linksFor(ayah, "lookalikes", base);
    expect(out.site).toBe(base + "#/hafs-kfqc/2:48?open=lookalikes");
    expect(out.app).toBe("hifth:///hafs-kfqc/2:48?open=lookalikes");
    expect(describeOutcome(predictLink(out.app, lists))).toBe("open #/hafs-kfqc/2:48?open=lookalikes");
  });

  it("the trail a teacher walked survives, with the panel after it", () => {
    const walked: AppState = { ...ayah, via: { surah: 2, ayah: 47 }, trail: [{ surah: 2, ayah: 40 }] };
    const out = linksFor(walked, "roots", base);
    expect(out.app).toBe("hifth:///hafs-kfqc/2:48?via=2:47&trail=2:40&open=roots");
    expect(describeOutcome(predictLink(out.app, lists))).toBe("open #/hafs-kfqc/2:48?via=2:47&trail=2:40&open=roots");
  });

  it("a highlighted range shares the same way", () => {
    const range: AppState = { edition: "hafs-kfqc", select: { surah: 2, ayah: 47, toAyah: 48 } };
    expect(linksFor(range, "", base).app).toBe("hifth:///hafs-kfqc/2:47-2:48");
  });

  it("the sheet's shape comes from the address: C unless it names A or B", () => {
    expect(shareShapeFromUrl("?share=a")).toBe("a");
    expect(shareShapeFromUrl("?share=B")).toBe("b");
    expect(shareShapeFromUrl("?share=c")).toBe("c");
    expect(shareShapeFromUrl("?share=x")).toBe("c");
    expect(shareShapeFromUrl("")).toBe("c");
  });
});
