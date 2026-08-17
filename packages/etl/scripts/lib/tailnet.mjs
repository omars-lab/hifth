/**
 * The one address a sitting is reached at.
 *
 * ── Why one, and why it matters more here than anywhere else ─────────────
 *
 * A sitting keeps the reader's place, and their drawn corrections, in the browser's
 * own store. That store belongs to an **origin** — scheme, host and port — and the
 * host half is compared as text. So this machine reached by its private-network name
 * and this machine reached by its private-network address are two different memories
 * of the same sitting, with no way for either to see the other and nothing on screen
 * that says so. The page simply opens at card one as though the last hour had not
 * happened.
 *
 * That is not hypothetical. It is the failure that made the serving side hand every
 * answer back on request in the first place, and it is written up three times in this
 * directory. The recovery works; it is still an hour of somebody's confidence.
 *
 * The fix is upstream of the recovery: **print one address and always the same one**.
 * This is what decides which. Everything that tells a reader where to go — the
 * server's banner, the front door's footer — asks here rather than composing a URL of
 * its own, so there is exactly one answer on this machine at any moment.
 *
 * ── How it finds it ──────────────────────────────────────────────────────
 *
 * The address comes from the network interfaces, not from a command. A private
 * network of this kind hands each machine an address in the shared range reserved for
 * carrier-grade translation — 100.64.0.0 through 100.127.255.255 — and no ordinary
 * home or office network issues one, so an interface holding an address in that range
 * is the private network and nothing else is. That is a read of state this process
 * already has, it needs nothing installed, and it cannot be wrong about whether the
 * network is up.
 *
 * The **name** is nicer to type and cannot be read that way, so it is asked of the
 * control program when one is installed where this looks. It is decoration: if the
 * name cannot be had, the address still works, and if the name is had but the machine
 * has not been told about the naming service the address is still what gets bound.
 * The name is preferred for printing precisely because it is what a person has
 * already been typing, and switching them to the other spelling is the very move this
 * whole file exists to prevent.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";

/** Where the control program lives when it is installed at all, most likely first. */
const CLIS = [
  "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
  "/usr/local/bin/tailscale",
  "/opt/homebrew/bin/tailscale",
  "/usr/bin/tailscale",
];

/**
 * The shared address range this kind of private network draws from.
 *
 * 100.64.0.0/10 — so the first octet is 100 and the second is 64 through 127. Tested
 * on the numbers rather than on the interface's name: the name is an implementation
 * detail of the operating system and differs between them, and a machine with two of
 * these interfaces would still only have one address in this range.
 */
export function isPrivateNetworkAddress(ip) {
  const parts = String(ip).split(".");
  if (parts.length !== 4) return false;
  const [a, b] = parts.map(Number);
  return a === 100 && b >= 64 && b <= 127;
}

/** The address this machine has on that network, or null when it is not on one. */
export function privateNetworkIp() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal && isPrivateNetworkAddress(a.address)) return a.address;
    }
  }
  return null;
}

/**
 * The name that resolves to it, when the control program will say.
 *
 * Deliberately quiet on every failure. Not installed, not running, not logged in, a
 * changed output shape — all four mean the same thing to a caller, which is that
 * there is no name to print, and none of them is a reason to refuse to serve.
 */
export function privateNetworkName() {
  const cli = CLIS.find((p) => existsSync(p));
  if (!cli) return null;
  try {
    const out = execFileSync(cli, ["status", "--json"], { encoding: "utf8", timeout: 4000, stdio: ["ignore", "pipe", "ignore"] });
    const name = JSON.parse(out)?.Self?.DNSName;
    return typeof name === "string" && name.includes(".") ? name.replace(/\.$/, "") : null;
  } catch {
    return null;
  }
}

/**
 * What to bind, what to print, and whether the two are the same thing.
 *
 * `ip` is the only one of the three a socket can be bound to. `host` is what belongs
 * in a URL handed to a person — the name when there is one, because that is the
 * spelling already in use. `alternates` is everything else this machine answers to,
 * and it exists so the caller can say *do not use these* rather than leaving a reader
 * to discover the rule by losing an hour to it.
 */
export function canonicalAddress() {
  const ip = privateNetworkIp();
  const name = ip ? privateNetworkName() : null;
  const host = name ?? ip ?? "127.0.0.1";
  const alternates = [ip, name, "127.0.0.1", "localhost"].filter((h) => h && h !== host);
  return { ip, name, host, alternates, onPrivateNetwork: Boolean(ip) };
}
