import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { composeLinks, describeOutcome, listsFromSpec, predictLink } from "./link-builder";

/**
 * The link builder on the contract page says what the Mac and iPad app will do
 * with a link before anyone sends it. It can only do that by re-doing the
 * shell's own parsing in JavaScript, so this holds the copy to the one thing
 * both sides share: the examples in the OpenAPI file, each of which the Swift
 * tests run through the real parser. If the two parsers ever disagree, one of
 * these two test files goes red and says on which link.
 */
const spec = JSON.parse(
  readFileSync(new URL("../../../docs/design/app-url-scheme.openapi.json", import.meta.url), "utf8"),
);
const lists = listsFromSpec(spec);
const site = spec["x-public-site"] as string;

describe("the lists the builder checks against come from the contract", () => {
  it("editions with their shipped flag, the three name lists, the default and the site", () => {
    expect(lists.editions.map((e) => e.id)).toEqual(["hafs-kfqc", "warsh-libya", "qalun-libya", "hafs-indopak"]);
    expect(lists.editions.filter((e) => e.shipped).map((e) => e.id)).toEqual(["hafs-kfqc"]);
    expect(lists.defaultEdition).toBe("hafs-kfqc");
    expect(lists.tools).toContain("note");
    expect(lists.panels).toContain("commentary");
    expect(lists.views).toEqual(["one", "two"]);
    expect(site).toMatch(/^https:\/\/.+\/$/);
  });
});

describe("the builder's guess agrees with the shell on every example in the contract", () => {
  const examples = spec["x-examples"] as { url: string; result: string; note?: string }[];
  it.each(examples.map((e) => [e.url, e.result]))("%s → %s", (url, result) => {
    expect(describeOutcome(predictLink(url, lists))).toBe(result);
  });
  it("and every refusal carries a reason a person can act on", () => {
    for (const e of examples) {
      const outcome = predictLink(e.url, lists);
      if (outcome.kind === "error") expect(outcome.message, e.url).toMatch(/\S/);
    }
  });
  it("an unshipped edition is refused by name, with what the app ships", () => {
    const outcome = predictLink("hifth://x-callback-url/open?page=1&edition=warsh-libya", lists);
    expect(outcome).toMatchObject({ kind: "error", code: "bad-route" });
    if (outcome.kind === "error") {
      expect(outcome.message).toContain("warsh-libya");
      expect(outcome.message).toContain("hafs-kfqc");
    }
    const unknown = predictLink("hifth://x-callback-url/open?route=/hafs/2:255", lists);
    if (unknown.kind === "error") expect(unknown.message).toContain("no mus'haf named");
  });
  it("something that is not a URL at all is refused, not thrown", () => {
    expect(predictLink("not a link", lists)).toEqual({ kind: "refused" });
    expect(predictLink("", lists)).toEqual({ kind: "refused" });
  });
});

describe("composing the three links from a filled-in form", () => {
  it("a verse with words, in a mode, with a place to answer", () => {
    const out = composeLinks(
      { place: "verse", verse: "2:255", words: "3-7", mode: "highlight", xSuccess: "shortcuts://x-callback-url/run-shortcut?name=Next" },
      lists,
      site,
    );
    expect(out.request).toBe(
      "hifth://x-callback-url/open?verse=2:255&words=3-7&mode=highlight&x-success=shortcuts://x-callback-url/run-shortcut?name=Next",
    );
    expect(out.outcome).toEqual({ kind: "open", hash: "#/hafs-kfqc/2:255?w=3-7&tool=highlight" });
    expect(out.plain).toBe("hifth:///hafs-kfqc/2:255?w=3-7&tool=highlight");
    expect(out.site).toBe(site + "#/hafs-kfqc/2:255?w=3-7&tool=highlight");
  });
  it("a page in the default mus'haf needs no edition in the request", () => {
    const out = composeLinks({ place: "page", page: "45" }, lists, site);
    expect(out.request).toBe("hifth://x-callback-url/open?page=45");
    expect(out.plain).toBe("hifth:///hafs-kfqc/p45");
  });
  it("a surah opens on its context, and a panel chosen by hand wins", () => {
    expect(composeLinks({ place: "surah", surah: "36" }, lists, site).plain).toBe("hifth:///hafs-kfqc/36:1?open=context");
    expect(composeLinks({ place: "surah", surah: "36", open: "commentary" }, lists, site).plain).toBe(
      "hifth:///hafs-kfqc/36:1?open=commentary",
    );
  });
  it("a whole route is passed as given, its own query kept safe from the request's", () => {
    const out = composeLinks({ place: "route", route: "/hafs-kfqc/2:255?w=3-7&skin=tajweed" }, lists, site);
    expect(out.request).toBe("hifth://x-callback-url/open?route=/hafs-kfqc/2:255?w=3-7%26skin=tajweed");
    expect(out.outcome).toEqual({ kind: "open", hash: "#/hafs-kfqc/2:255?w=3-7&skin=tajweed" });
  });
  it("a mus'haf the app does not ship gives no link to send, and says why", () => {
    const out = composeLinks({ place: "page", page: "1", edition: "qalun-libya" }, lists, site);
    expect(out.request).toBe("hifth://x-callback-url/open?page=1&edition=qalun-libya");
    expect(out.plain).toBe("");
    expect(out.site).toBe("");
    expect(out.outcome.kind).toBe("error");
    expect(describeOutcome(out.outcome)).toBe("error bad-route");
  });
  it("an empty form asks for a place", () => {
    const out = composeLinks({ place: "page" }, lists, site);
    expect(out.outcome).toMatchObject({ kind: "error", code: "missing-route" });
  });
  it("a value with a stray & or space is encoded so it cannot break the request", () => {
    const out = composeLinks({ place: "verse", verse: "2:255", xError: "a://e?x=1&y=2 3" }, lists, site);
    expect(out.request).toBe("hifth://x-callback-url/open?verse=2:255&x-error=a://e?x=1%26y=2%203");
    expect(out.outcome.kind).toBe("open");
  });
});
