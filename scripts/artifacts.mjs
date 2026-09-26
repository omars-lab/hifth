/**
 * Shared reader for docs/artifacts.json — the published-page register.
 *
 * One export, same shape as scripts/decisions.mjs's readDecisions(): the gate,
 * the decision board and the experience atlas all need the same rows read the
 * same way, and a second hand-rolled JSON.parse in each is a second place the
 * parsing can quietly diverge.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

export const ARTIFACTS_PATH = join(ROOT, "docs", "artifacts.json");

export function readArtifacts() {
  if (!existsSync(ARTIFACTS_PATH)) {
    console.error(`artifacts missing at ${ARTIFACTS_PATH}`);
    process.exit(1);
  }
  const { artifacts } = JSON.parse(readFileSync(ARTIFACTS_PATH, "utf8"));
  return artifacts;
}
