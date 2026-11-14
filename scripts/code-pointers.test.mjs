// locateTest is how the use-case list proves a promise has a test behind it.
// The app's own tests are Swift, so it has to find those as well as the web's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { locateTest, ROOT } from "./code-pointers.mjs";

function withFile(name, text, check) {
  const dir = mkdtempSync(join(ROOT, "node_modules", ".code-pointers-test-"));
  try {
    const abs = join(dir, name);
    writeFileSync(abs, text);
    check(relative(ROOT, abs));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a web test title is found on its line", () => {
  withFile("a.spec.ts", 'import x from "y";\ntest("opens the drawer", async () => {});\n', (file) => {
    assert.deepEqual(locateTest(file, "opens the drawer"), { ok: true, line: 2 });
  });
});

test("a Swift Testing title is found", () => {
  const swift = 'import Testing\n\n@Test("a blank note leaves no note file")\nfunc blank() {}\n';
  withFile("NoteTests.swift", swift, (file) => {
    assert.deepEqual(locateTest(file, "a blank note leaves no note file"), { ok: true, line: 3 });
  });
});

test("an XCTest method is found by its name", () => {
  const swift = "final class SmokeTests: XCTestCase {\n    func testWalkCaptureKeepsANote() throws {\n    }\n}\n";
  withFile("SmokeTests.swift", swift, (file) => {
    assert.deepEqual(locateTest(file, "testWalkCaptureKeepsANote"), { ok: true, line: 2 });
  });
});

test("a Swift name that is only in a comment is not a test", () => {
  const swift = '// see "a blank note leaves no note file" and testWalkCaptureKeepsANote\nfunc helper() {}\n';
  withFile("Helpers.swift", swift, (file) => {
    assert.equal(locateTest(file, "a blank note leaves no note file").ok, false);
    assert.equal(locateTest(file, "testWalkCaptureKeepsANote").ok, false);
  });
});
