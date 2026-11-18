// Talking to App Store Connect with one of the owner's keys, for the store-feedback and
// store-numbers skills (both use the hifth-reviews key). A key is a .p8 file in ~/.appstoreconnect/private_keys/, named by its id;
// its id and the team's issuer id sit in the repo's encrypted settings. This file reads the key
// to sign a short-lived token and never prints it, the ids or the token: a message names the
// setting or the file's folder, never the value.

import { createPrivateKey, createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const API = "https://api.appstoreconnect.apple.com";
export const KEYS_DIR = join(homedir(), ".appstoreconnect", "private_keys");
export const BUNDLE_ID = "com.bytesofpurpose.hifth";

/** Apple takes a token for at most 20 minutes; ask for less so a slow run never crosses it. */
const LIFETIME_S = 15 * 60;

const b64url = (data) => Buffer.from(data).toString("base64url");

/**
 * A token Apple accepts for `minutes` (ES256, signed by the key). `now` is seconds since 1970.
 * `key` is the .p8's text; it is read by the caller so a test can pass a made-up one.
 */
export function token({ keyId, issuerId, key, now = Math.floor(Date.now() / 1000) }) {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: issuerId, iat: now, exp: now + LIFETIME_S, aud: "appstoreconnect-v1" }));
  const signer = createSign("SHA256");
  signer.update(`${header}.${claims}`);
  // Apple wants the raw 64-byte signature, not the DER form Node gives by default.
  const signature = signer.sign({ key: createPrivateKey(key), dsaEncoding: "ieee-p1363" });
  return `${header}.${claims}.${b64url(signature)}`;
}

/**
 * The key's id and the issuer id from the environment, and the key's text from its file.
 * Throws a message naming what is missing, never a value.
 */
export function credentials(env = process.env, { idName, readKey = (p) => readFileSync(p, "utf8") }) {
  const keyId = env[idName] ?? "";
  const issuerId = env.ASC_ISSUER_ID ?? "";
  if (!keyId || !issuerId)
    throw new Error(`${idName} or ASC_ISSUER_ID is not loaded; run through the make target, which loads the encrypted settings (make app-release-setup checks both)`);
  let key;
  try {
    key = readKey(join(KEYS_DIR, `AuthKey_${keyId}.p8`));
  } catch {
    throw new Error(`no key file in ${KEYS_DIR}/ matches ${idName}; make app-release-setup says which is missing`);
  }
  return { keyId, issuerId, key };
}

/**
 * A client for one key: `get(path)` gives every page of a list joined (`data` and `included`),
 * `post(path, body)` sends one thing. The token is made again when it is near its end.
 */
export function client({ keyId, issuerId, key }, { fetch = globalThis.fetch, clock = () => Math.floor(Date.now() / 1000) } = {}) {
  let current = null;
  const auth = () => {
    const now = clock();
    if (!current || current.until - now < 60) current = { value: token({ keyId, issuerId, key, now }), until: now + LIFETIME_S };
    return { authorization: `Bearer ${current.value}` };
  };
  const failed = async (res, path) => {
    let why = "";
    try {
      const body = await res.json();
      why = (body.errors ?? []).map((e) => e.detail || e.title).filter(Boolean).join("; ");
    } catch {
      // An answer with no readable body still reports its status below.
    }
    // The path carries the app's number at most, which is public on its store page.
    return new Error(`App Store Connect answered ${res.status} for ${path.split("?")[0]}${why ? `: ${why}` : ""}`);
  };
  return {
    async get(path) {
      const data = [];
      const included = [];
      let url = path.startsWith("http") ? path : API + path;
      while (url) {
        if (!url.startsWith(API + "/")) throw new Error("App Store Connect gave a next page on another site; stopped");
        const res = await fetch(url, { headers: auth() });
        if (!res.ok) throw await failed(res, url.slice(API.length));
        const page = await res.json();
        data.push(...(Array.isArray(page.data) ? page.data : [page.data]));
        included.push(...(page.included ?? []));
        url = page.links?.next ?? null;
      }
      return { data, included };
    },
    /**
     * A report file (Apple sends the sales reports gzipped), as a Buffer, or null when Apple
     * answers 404, which for a report means there is nothing for that day yet.
     */
    async report(path) {
      const res = await fetch(API + path, { headers: { ...auth(), accept: "application/a-gzip" } });
      if (res.status === 404) return null;
      if (!res.ok) throw await failed(res, path);
      return Buffer.from(await res.arrayBuffer());
    },
    async post(path, body) {
      const res = await fetch(API + path, {
        method: "POST",
        headers: { ...auth(), "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await failed(res, path);
      return res.json();
    },
  };
}

/** The app's number in App Store Connect, found by its bundle id. */
export async function appId(api, bundleId = BUNDLE_ID) {
  const { data } = await api.get(`/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&fields[apps]=bundleId`);
  const app = data.find((a) => a?.attributes?.bundleId === bundleId);
  if (!app) throw new Error(`App Store Connect has no app with the bundle id ${bundleId} that this key can see`);
  return app.id;
}
