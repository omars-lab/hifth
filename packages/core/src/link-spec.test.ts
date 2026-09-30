import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EDITIONS } from "./concordance";
import { LINK_TOOLS, OPEN_PANELS } from "./router";

/**
 * The app's URL contract (`docs/design/app-url-scheme.openapi.json`) lists the
 * panels, tools and views a link may name. Those lists are the router's own,
 * copied into the file so a reader sees them without opening the code. This
 * keeps the copy honest: a panel added here and not there fails.
 */
const spec = JSON.parse(
  readFileSync(new URL("../../../docs/design/app-url-scheme.openapi.json", import.meta.url), "utf8"),
) as {
  paths: Record<string, { get: { parameters: { name?: string; schema?: { enum?: string[] } }[] } }>;
  components: {
    schemas: {
      Edition: {
        enum: string[];
        "x-editions": { id: string; name: string; shipped: boolean; reason?: string }[];
      };
    };
  };
};

const enumOf = (name: string): string[] | undefined =>
  spec.paths["/x-callback-url/open"].get.parameters.find((p) => p.name === name)?.schema?.enum;

describe("the URL contract names the same panels, tools and views as the router", () => {
  it("open= panels", () => expect(enumOf("open")).toEqual([...OPEN_PANELS]));
  it("tool= tools, and mode= as the same list", () => {
    expect(enumOf("tool")).toEqual([...LINK_TOOLS]);
    expect(enumOf("mode")).toEqual([...LINK_TOOLS]);
  });
  it("view= one or two", () => expect(enumOf("view")).toEqual(["one", "two"]));
});

/**
 * The editions a link may name are the app's own list, copied into the file
 * with an English name and whether the mus'haf is actually in the build. The
 * shell refuses any other name, and refuses a known one that is not shipped,
 * so the copy has to be the list — ids, order and shipped flags alike.
 */
describe("the URL contract lists the same editions as the app, shipped or not", () => {
  const edition = spec.components.schemas.Edition;
  it("the ids, in the app's order", () => {
    expect(edition.enum).toEqual(EDITIONS.map((e) => e.id));
    expect(edition["x-editions"].map((e) => e.id)).toEqual(EDITIONS.map((e) => e.id));
  });
  it("shipped means vendored, and an unshipped one says why", () => {
    for (const e of edition["x-editions"]) {
      const meta = EDITIONS.find((m) => m.id === e.id);
      expect(e.shipped, e.id).toBe(meta?.status === "vendored");
      if (!e.shipped) expect(e.reason, e.id).toMatch(/\S/);
      expect(e.name, e.id).toMatch(/\S/);
    }
  });
});
