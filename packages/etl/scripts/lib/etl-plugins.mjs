/**
 * The ETL plugin registry — the one shared interface every Qur'an-data source enters by.
 *
 * The tenet (CLAUDE.md, "Every source of Qur'an data is a plugin") is enforced here in
 * one place: there is no privileged path and no fork of the pipeline. A source is a named
 * descriptor with the same shape as every other, listed in PLUGINS, and the runner
 * (etl.mjs) discovers it here — it is never wired in by hand at the call site.
 *
 * Adding a source is adding a file under plugins/ and one line to PLUGINS. Nothing about
 * the runner changes.
 */

/**
 * @typedef {Object} EtlPlugin
 * @property {string}   name       stable id, kebab-case — how the runner names it
 * @property {string}   title      one plain-language line: what this source does
 * @property {"derive"|"hold"} role  derive = makes the app's own data; hold = holds a copy to check against
 * @property {boolean}  default    run under a bare `make etl`? (a source that needs a database or a
 *                                 licence read is not a default)
 * @property {string[]} reads      where its inputs come from, in plain words
 * @property {string[]} writes     where its outputs go, in plain words
 * @property {string[]} gates      the checks that must stay green because of it
 * @property {string[]} [needs]    what it needs before real work (surfaced so the list explains itself)
 * @property {string[]} [measuredBy] how it is checked against an outside ruler, if it is
 * @property {(args?: string[]) => Promise<void>} run  do the work; forwards extra flags
 */

import deriveAndMeasure from "../plugins/derive-and-measure.mjs";
import heldCopy from "../plugins/held-copy.mjs";

/** Every registered source, in the order the runner lists and runs them. */
export const PLUGINS = [deriveAndMeasure, heldCopy];

/** Look one up by name; undefined if there is no such source. */
export function byName(name) {
  return PLUGINS.find((p) => p.name === name);
}

/** The sources a bare `make etl` runs — the ones whose output ships. */
export function defaults() {
  return PLUGINS.filter((p) => p.default);
}
