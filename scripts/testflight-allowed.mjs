// May the app be archived and sent to TestFlight? Only when the licence
// question (docs/decisions/native-testflight-licence.md) is settled on one of
// the two upload options. Settled on C, own devices only, it stays locked.
// Exits 0 when allowed, 1 otherwise; `make app-archive` calls it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const UPLOAD_OPTIONS = new Set(["A", "B"]);

export function uploadAllowed(register) {
  const row = register.decisions.find((d) => d.id === "native-testflight-licence");
  return Boolean(row && row.status === "decided" && UPLOAD_OPTIONS.has(row.decided));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = new URL("../docs/decisions.json", import.meta.url);
  process.exit(uploadAllowed(JSON.parse(readFileSync(path, "utf8"))) ? 0 : 1);
}
