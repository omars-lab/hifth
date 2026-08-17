/**
 * The one address, and the rule that decides it.
 *
 * A browser keeps a reader's place per address, compared as text, so this machine
 * reached by its name and this machine reached by its number are two different
 * memories of the same sitting. That has already cost an hour. Everything that
 * tells a reader where to go asks this module rather than composing an address of
 * its own, so what has to hold is that it gives exactly one answer and knows what
 * the other spellings are.
 *
 * The range test is the checkable half and gets a table. The rest is a fact about
 * the machine the tests are running on — up here, absent in CI — so what is asserted
 * about it is the shape that has to hold either way.
 */
import { describe, expect, it } from "vitest";
import { canonicalAddress, isPrivateNetworkAddress } from "./tailnet.mjs";

describe("which addresses belong to a private network of this kind", () => {
  // 100.64.0.0/10 — the range reserved for carrier-grade translation, which this
  // kind of network draws from and no home or office network hands out.
  it.each([
    ["100.64.0.0", true],
    ["100.111.186.78", true],
    ["100.127.255.255", true],
    ["100.63.255.255", false],
    ["100.128.0.1", false],
    ["10.0.0.1", false],
    ["192.168.1.20", false],
    ["127.0.0.1", false],
    ["172.16.0.1", false],
  ])("%s → %s", (ip, want) => {
    expect(isPrivateNetworkAddress(ip)).toBe(want);
  });

  it("is not fooled by something that is not an address", () => {
    for (const junk of ["", "100.64", "100.64.0.0.1", "macbook.example.net", null, undefined, 100]) {
      expect(isPrivateNetworkAddress(junk)).toBe(false);
    }
  });
});

describe("the address a reader is given", () => {
  const where = canonicalAddress();

  it("always has one, even with no network at all", () => {
    expect(typeof where.host).toBe("string");
    expect(where.host.length).toBeGreaterThan(0);
  });

  // The whole point. If the address a page prints were also in the list of
  // addresses it warns against, the warning would fire on the right one.
  it("never lists the one it chose among the ones to avoid", () => {
    expect(where.alternates).not.toContain(where.host);
  });

  it("does not repeat itself", () => {
    expect(new Set(where.alternates).size).toBe(where.alternates.length);
  });

  it("says it is on a private network exactly when it found an address on one", () => {
    expect(where.onPrivateNetwork).toBe(Boolean(where.ip));
    if (where.ip) expect(isPrivateNetworkAddress(where.ip)).toBe(true);
  });

  // Off the network there is nothing to bind but loopback, and saying anything else
  // would be promising a phone something that cannot work.
  it("falls back to this machine only, when there is no private network", () => {
    if (!where.onPrivateNetwork) expect(where.host).toBe("127.0.0.1");
  });

  // On it, the name is preferred over the number because the name is the spelling
  // already in use, and moving a reader to the other one is the exact failure.
  it("prefers the name over the number when there is one", () => {
    if (where.name) expect(where.host).toBe(where.name);
    else if (where.ip) expect(where.host).toBe(where.ip);
  });
});
