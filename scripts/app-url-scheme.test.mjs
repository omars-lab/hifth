import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { render, SPEC, OUT } from "./build-app-url-scheme.mjs";

const spec = JSON.parse(readFileSync(SPEC, "utf8"));

test("the checked-in page is what the spec renders today (make app-links-doc)", () => {
  assert.equal(readFileSync(OUT, "utf8"), render(spec));
});

test("every path has at least one example the tests can run", () => {
  const html = render(spec);
  for (const [path, ops] of Object.entries(spec.paths)) {
    const section = html.split(`<section id="${ops.get.operationId}">`)[1]?.split("</section>")[0];
    assert.ok(section, `no section for ${path}`);
    assert.match(section, /<code class="url">/, `no example under ${path}`);
  }
});

test("the page carries no held text and no Arabic", () => {
  assert.doesNotMatch(render(spec), /[؀-ۿ]/);
});
