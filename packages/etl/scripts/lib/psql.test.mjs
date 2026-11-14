/**
 * The store scripts find psql even when Homebrew has kept it off the path.
 *
 * Homebrew's libpq installs psql in its own folder and does not put it on the path, so a
 * script that ran a bare `psql` failed on this laptop with the tool installed (2026-11-13,
 * the first page check against the new store). Each case below stands in a made-up set of
 * folders for the real disk.
 */
import { describe, expect, it } from "vitest";
import { findPsql } from "./psql.mjs";

const on = (...paths) => (p) => paths.includes(p);

describe("finding psql", () => {
  it("uses the one on the path when there is one", () => {
    expect(findPsql({ PATH: "/usr/bin:/somewhere/bin" }, on("/somewhere/bin/psql", "/opt/homebrew/opt/libpq/bin/psql")))
      .toBe("/somewhere/bin/psql");
  });

  it("falls back to Homebrew's libpq folder on an Apple-chip Mac", () => {
    expect(findPsql({ PATH: "/usr/bin:/bin" }, on("/opt/homebrew/opt/libpq/bin/psql")))
      .toBe("/opt/homebrew/opt/libpq/bin/psql");
  });

  it("falls back to Homebrew's libpq folder on an Intel Mac", () => {
    expect(findPsql({ PATH: "/usr/bin" }, on("/usr/local/opt/libpq/bin/psql")))
      .toBe("/usr/local/opt/libpq/bin/psql");
  });

  it("with none anywhere, returns the bare name so the error says psql is missing", () => {
    expect(findPsql({ PATH: "" }, on())).toBe("psql");
  });
});
