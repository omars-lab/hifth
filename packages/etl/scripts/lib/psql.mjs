/**
 * Where psql is, for the scripts that read or fill the store.
 *
 * Homebrew's libpq installs psql in its own folder and does not put it on the path ("keg-only"),
 * so a bare `psql` fails on a Mac that has it. This looks on the path first, then in
 * Homebrew's libpq folder (Apple-chip, then Intel). With none found it returns the bare name,
 * so the error still names psql as the missing piece.
 */
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const HOMEBREW_LIBPQ = ["/opt/homebrew/opt/libpq/bin", "/usr/local/opt/libpq/bin"];

export function findPsql(env = process.env, exists = existsSync) {
  const dirs = [...(env.PATH || "").split(delimiter).filter(Boolean), ...HOMEBREW_LIBPQ];
  for (const dir of dirs) {
    const p = join(dir, "psql");
    if (exists(p)) return p;
  }
  return "psql";
}
