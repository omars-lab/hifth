import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
