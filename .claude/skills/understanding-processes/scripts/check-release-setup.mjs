#!/usr/bin/env node
// Is this laptop set up to release the app? One line per thing a release needs,
// each saying ok, missing or later, and for anything not ok what to do and the
// page to do it on. Then which release steps can run today.
//
//   node .claude/skills/understanding-processes/scripts/check-release-setup.mjs
//   make app-release-setup                      the same, from the repo root
//   --only key-file,key-ids                     run only the named checks
//   --home <dir>                                look for the key there instead of ~ (tests)
//
// It never prints a secret, a certificate's name (that carries the owner's
// email) or the key's ids: only whether each is in place. Exit 1 when a check
// marked "missing" is needed for the archive, the export or Apple's check. The
// licence lock is reported, never counted as a failure: it is a decision, not
// a setup step.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const HOME = opt("--home") ?? homedir();
const ONLY = opt("--only")?.split(",");

const KEY_PAGE = "https://appstoreconnect.apple.com/access/integrations/api";
const CERT_PAGE = "https://developer.apple.com/account/resources/certificates/list";
const KEYS_DIR = join(HOME, ".appstoreconnect/private_keys");

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { cwd: root, encoding: "utf8", timeout: 20000 });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), missing: r.error?.code === "ENOENT" };
}

function keyFiles() {
  try {
    return readdirSync(KEYS_DIR).filter((f) => /^AuthKey_[A-Z0-9]+\.p8$/.test(f));
  } catch {
    return [];
  }
}

// Was the app in the last export signed for the App Store? Unpacks the export
// into a scratch folder and reads who signed the app, printing nothing.
function lastExportSignedForStore() {
  const ipa = join(root, "native/build/store/export/Hifth.ipa");
  if (!existsSync(ipa)) return false;
  const dir = mkdtempSync(join(tmpdir(), "export-"));
  try {
    if (!run("unzip", ["-q", "-o", ipa, "-d", dir]).ok) return false;
    const r = spawnSync("codesign", ["-dvv", join(dir, "Payload/Hifth.app")], { encoding: "utf8", timeout: 20000 });
    return /^Authority=Apple Distribution:/m.test(r.stderr ?? "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Each check: what it is, which release step first needs it, and how to test it.
// `test` returns { state: "ok" | "missing" | "later", fix?, link? }.
const CHECKS = [
  {
    id: "node",
    name: "Node 22 or newer",
    needs: "archive",
    test: () =>
      Number(process.versions.node.split(".")[0]) >= 22
        ? { state: "ok" }
        : { state: "missing", fix: "run nvm use in the repo (the .nvmrc says 22)" },
  },
  {
    id: "xcode",
    name: "Xcode",
    needs: "archive",
    test: () =>
      run("xcodebuild", ["-version"]).ok
        ? { state: "ok" }
        : { state: "missing", fix: "install Xcode from the Mac App Store", link: "https://apps.apple.com/app/xcode/id497799835" },
  },
  {
    id: "xcodegen",
    name: "XcodeGen (makes the Xcode project)",
    needs: "archive",
    test: () =>
      run("xcodegen", ["--version"]).ok ? { state: "ok" } : { state: "missing", fix: "brew install xcodegen" },
  },
  {
    id: "xcode-account",
    name: "Xcode signed in to the Apple account",
    needs: "archive",
    test: () =>
      run("sh", ["native/scripts/xcode-account.sh"]).ok
        ? { state: "ok" }
        : { state: "missing", fix: "Xcode, Settings, Accounts, +, Apple ID; sign in with the account that holds the paid membership (you)" },
  },
  {
    id: "dev-identity",
    name: "Development certificate in the keychain",
    needs: "archive",
    test: () =>
      run("sh", ["native/scripts/signing-team.sh"]).out
        ? { state: "ok" }
        : { state: "missing", fix: "build once for a device with Xcode signed in (make app-device-install); Xcode makes it", link: CERT_PAGE },
  },
  {
    id: "distribution-cert",
    name: "App Store certificate",
    needs: "export",
    test: () => {
      // Xcode's automatic signing keeps this certificate's key at Apple and signs
      // in the cloud, so the keychain usually has none (2026-11-16: the export
      // signed, the keychain held nothing). Either place counts. The keychain's
      // output names each certificate with the owner's email: count, never print.
      const r = run("security", ["find-identity", "-v", "-p", "codesigning"]);
      if (r.out.split("\n").some((l) => l.includes('"Apple Distribution:'))) return { state: "ok" };
      if (lastExportSignedForStore()) return { state: "ok" };
      return {
        state: "missing",
        fix: "the first make app-export has Xcode make it in the Apple account; ask the owner first",
        link: CERT_PAGE,
      };
    },
  },
  {
    id: "key-file",
    name: "App Store Connect key file",
    needs: "check",
    test: () => {
      const files = keyFiles();
      if (files.length === 0)
        return {
          state: "missing",
          fix: `you make it (App Manager access), download the .p8 once and move it to ${KEYS_DIR}/`,
          link: KEY_PAGE,
        };
      const open = files.filter((f) => (statSync(join(KEYS_DIR, f)).mode & 0o077) !== 0);
      return open.length
        ? { state: "missing", fix: `other people on this laptop can read it: chmod 600 ${KEYS_DIR}/AuthKey_*.p8` }
        : { state: "ok" };
    },
  },
  {
    id: "key-ids",
    name: "App Store Connect key ID and issuer ID",
    needs: "check",
    test: () => {
      // Saved in the repo's encrypted settings; `make app-release-setup` runs
      // this under `dotenvx run`, which hands them over as environment values.
      const keyId = process.env.ASC_KEY_ID ?? "";
      const issuerId = process.env.ASC_ISSUER_ID ?? "";
      if (!keyId || !issuerId)
        return {
          state: "missing",
          fix: "save them in the repo's encrypted settings: make env-set NAME=ASC_KEY_ID, then make env-set NAME=ASC_ISSUER_ID (the long id above the keys list)",
          link: KEY_PAGE,
        };
      if (!/^[A-Z0-9]{10}$/.test(keyId) || !/^[0-9a-f-]{36}$/i.test(issuerId))
        return { state: "missing", fix: "ASC_KEY_ID must be 10 letters and digits and ASC_ISSUER_ID the 36-character id; save them again with make env-set" };
      if (!keyFiles().includes(`AuthKey_${keyId}.p8`))
        return { state: "missing", fix: `no key file matches the saved ASC_KEY_ID; check the ID, or move the right .p8 into ${KEYS_DIR}/` };
      return { state: "ok" };
    },
  },
  {
    // The second key, named hifth-reviews (Customer Support, Finance and
    // Marketing access), reads and answers store reviews and pulls the
    // download and sales reports. No release step needs it: reported, never a
    // failure, and it holds back no step.
    id: "reviews-key",
    name: "The reviews key (store reviews, downloads and sales)",
    needs: "after release",
    test: () => {
      const id = process.env.ASC_REVIEWS_KEY_ID ?? "";
      if (!id)
        return {
          state: "later",
          fix: "make a second key named hifth-reviews with Customer Support, Finance and Marketing access, move its .p8 next to the first, then make env-set NAME=ASC_REVIEWS_KEY_ID",
          link: KEY_PAGE,
        };
      if (!/^[A-Z0-9]{10}$/.test(id))
        return { state: "missing", fix: "ASC_REVIEWS_KEY_ID must be 10 letters and digits; save it again with make env-set" };
      if (id === process.env.ASC_KEY_ID)
        return { state: "missing", fix: "ASC_REVIEWS_KEY_ID names the same key as ASC_KEY_ID; save the hifth-reviews key's id instead" };
      const file = `AuthKey_${id}.p8`;
      if (!keyFiles().includes(file))
        return { state: "missing", fix: `no key file matches the saved ASC_REVIEWS_KEY_ID; move the hifth-reviews .p8 into ${KEYS_DIR}/` };
      if ((statSync(join(KEYS_DIR, file)).mode & 0o077) !== 0)
        return { state: "missing", fix: `other people on this laptop can read it: chmod 600 ${KEYS_DIR}/AuthKey_*.p8` };
      return { state: "ok" };
    },
  },
  {
    // Apple files the daily download and sales reports under the account's
    // vendor number. Only the store-numbers skill needs it.
    id: "vendor-number",
    name: "The vendor number (download and sales reports)",
    needs: "after release",
    test: () => {
      const n = process.env.ASC_VENDOR_NUMBER ?? "";
      if (!n)
        return {
          state: "later",
          fix: "copy the number at the top of Payments and Financial Reports, then make env-set NAME=ASC_VENDOR_NUMBER",
          link: "https://appstoreconnect.apple.com/itc/payments_and_financial_reports",
        };
      return /^\d+$/.test(n)
        ? { state: "ok" }
        : { state: "missing", fix: "ASC_VENDOR_NUMBER must be digits only; save it again with make env-set" };
    },
  },
  {
    id: "public-build",
    name: "The public build is in the app (needed for each release)",
    needs: "archive",
    test: () => {
      const stamp = join(root, "native/WebBundle/.hifth-web-flavour");
      const flavour = existsSync(stamp) ? readFileSync(stamp, "utf8").trim() : "";
      return flavour === "public"
        ? { state: "ok" }
        : { state: "later", fix: "make app-web FLAVOUR=public, just before the archive (the agent)" };
    },
  },
  {
    id: "licence",
    name: "The licence answer allows an upload",
    needs: "upload",
    test: () => {
      const register = JSON.parse(readFileSync(join(root, "docs/decisions.json"), "utf8"));
      const row = register.decisions.find((d) => d.id === "native-testflight-licence");
      const allowed = Boolean(row && row.status === "decided" && ["A", "B"].includes(row.decided));
      return allowed
        ? { state: "ok" }
        : { state: "later", fix: "locked until the two data owners give written permission (launch page items 3 and 4)" };
    },
  },
];

const STEPS = ["archive", "export", "check", "upload"];
const STEP_NAME = { archive: "archive", export: "sign for the store", check: "Apple's own check", upload: "upload" };

const results = CHECKS.filter((c) => !ONLY || ONLY.includes(c.id)).map((c) => ({ ...c, ...c.test() }));
for (const r of results) {
  console.log(`${r.state.padEnd(8)} ${r.name}`);
  if (r.state !== "ok" && r.fix) console.log(`         ${r.fix}${r.link ? `\n         ${r.link}` : ""}`);
}

if (!ONLY) {
  // A step can run when every check it needs, and every check an earlier step needs, is ok.
  // "later" on the public build does not hold a step back: the release puts it in first.
  console.log("");
  let open = true;
  for (const step of STEPS) {
    const blocking = results.filter(
      (r) =>
        STEPS.includes(r.needs) &&
        STEPS.indexOf(r.needs) <= STEPS.indexOf(step) &&
        r.state !== "ok" &&
        r.id !== "public-build",
    );
    open = open && blocking.length === 0;
    console.log(`${open ? "can run " : "waits   "} ${STEP_NAME[step]}${open ? "" : `: ${blocking.map((b) => b.name).join(", ")}`}`);
  }
}

// Only what the archive, the export or Apple's check needs fails the run.
const failed = results.some((r) => r.state === "missing" && ["archive", "export", "check"].includes(r.needs));
process.exit(failed ? 1 : 0);
