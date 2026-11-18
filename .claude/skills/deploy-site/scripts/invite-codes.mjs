#!/usr/bin/env node
/**
 * Makes invite codes for the tester stage of sign-in (docs/design/sign-in.md, step 18).
 *
 *   make hifth-app-invites               five new codes
 *   make hifth-app-invites ARGS="--count 12"
 *
 * Prints each code once, for the owner to hand to a tester, and one line holding the codes'
 * scrambled copies: the value of the SIGN_IN_INVITES setting on the Cloudflare project. The
 * setting is not a secret, because each code is 80 random bits and cannot be worked back from
 * its scrambled copy. The codes themselves are: whoever holds one can start a sign-in.
 *
 * The owner runs this in their own terminal. Nothing is saved: a code that is lost is replaced
 * by a new one. To add testers later, run it again and add the new scrambled copies to the
 * setting after a comma; to shut a code out, take its scrambled copy out of the setting.
 * Clearing the setting does not close sign-in, it opens it to everyone.
 */
import { fileURLToPath } from "node:url";
import { inviteHash, newInvite } from "../../../../apps/landing/lib/invites.mjs";

const MOST = 100;

/** { count } from the command line, or { error }. */
export function countFrom(args) {
  if (args.length === 0) return { count: 5 };
  const count = Number(args[1]);
  if (args.length !== 2 || args[0] !== "--count" || !Number.isInteger(count) || count < 1 || count > MOST) {
    return { error: `Use --count with a whole number from 1 to ${MOST}.` };
  }
  return { count };
}

/** What is printed: the codes, then the setting's line. */
export async function sheet(codes) {
  const hashes = await Promise.all(codes.map((code) => inviteHash(code)));
  return [
    "Invite codes. Each is shown only now; hand one to each tester.",
    "Capitals, spaces and dashes do not matter when a tester types one.",
    "",
    ...codes.map((code) => `  ${code}`),
    "",
    "The setting for the Cloudflare project (not a secret; holds no code):",
    `SIGN_IN_INVITES=${hashes.join(",")}`,
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const asked = countFrom(process.argv.slice(2));
  if (asked.error) {
    console.error(asked.error);
    process.exit(2);
  }
  process.stdout.write(await sheet(Array.from({ length: asked.count }, () => newInvite())));
}
