// A stand-in for Cloudflare's D1 database in the tests: Node's own SQLite, behind the few D1
// calls the server code uses (prepare, bind, first, all, run). The tables come from the real
// migration files in apps/landing/migrations/, so the tests check the same SQL Cloudflare runs.
// D1 enforces foreign keys, so the stand-in does too.

import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MIGRATIONS = fileURLToPath(new URL("../migrations/", import.meta.url));

export function localD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(MIGRATIONS + file, "utf8"));
  }
  const plain = (row) => (row === undefined ? null : { ...row });
  const db = {
    prepare(sql) {
      const statement = (args) => ({
        bind: (...values) => statement(values),
        first: async (column) => {
          const row = plain(sqlite.prepare(sql).get(...args));
          return row && column ? row[column] : row;
        },
        all: async () => ({ success: true, results: sqlite.prepare(sql).all(...args).map(plain) }),
        run: async () => ({ success: true, meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }),
      });
      return statement([]);
    },
  };
  /** Every row of a table, for tests that look at what was kept. */
  const rows = (table) => sqlite.prepare(`SELECT * FROM ${table}`).all().map(plain);
  return { db, rows };
}
