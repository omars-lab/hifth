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

test("the page lists every edition the contract knows, and says which ones ship", () => {
  const html = render(spec);
  const section = html.split('<section id="editions">')[1]?.split("</section>")[0];
  assert.ok(section, "no editions section");
  for (const e of spec.components.schemas.Edition["x-editions"]) {
    assert.match(section, new RegExp(`<code>${e.id}</code>`), `edition ${e.id} missing`);
    if (!e.shipped) assert.ok(section.includes(e.reason), `${e.id} does not say why it is not shipped`);
  }
  // A parameter whose schema is a $ref still shows its values, not a blank cell.
  const open = html.split('<section id="openLink">')[1].split("</section>")[0];
  assert.match(open, /<td><code>edition<\/code>[^]*?<td>[^]*?<code>hafs-kfqc<\/code>/, "the edition row must list the ids");
});

test("the page carries no held text and no Arabic", () => {
  assert.doesNotMatch(render(spec), /[؀-ۿ]/);
});

// The Swagger UI view (make app-links-ui) is a hand-written page beside the
// spec, so the same JSON can be browsed in the viewer most API readers know.
const SWAGGER = OUT.replace(/\.html$/, ".swagger.html");
const swagger = () => readFileSync(SWAGGER, "utf8");

test("the Swagger UI page reads the checked-in spec from beside itself", () => {
  const html = swagger();
  assert.match(html, /url:\s*"app-url-scheme\.openapi\.json"/, "Swagger UI must load the spec by its relative name");
  // An href to the JSON is what makes the site build copy it beside the page.
  assert.match(html, /href="app-url-scheme\.openapi\.json"/, "the page must link the raw JSON so the site serves it");
  assert.match(html, /cdnjs\.cloudflare\.com\/ajax\/libs\/swagger-ui\/\d+\.\d+\.\d+\//, "Swagger UI must be pinned to one version");
  // Whole-address examples are the spec's own x-examples; the page draws them, it does not copy them.
  assert.match(html, /get\("x-examples"\)/, "the page must draw the spec's x-examples, not carry its own");
  assert.doesNotMatch(html, /hifth:\/\/x-callback-url\/open\?/, "no example address is written into the page by hand");
  assert.doesNotMatch(html, /[؀-ۿ]/);
});

test("the readable page and the Swagger UI page link each other", () => {
  assert.match(render(spec), /href="app-url-scheme\.swagger\.html"/);
  assert.match(swagger(), /href="app-url-scheme\.html"/);
});
