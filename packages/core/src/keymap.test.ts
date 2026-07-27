import { describe, it, expect } from "vitest";
import { appKeyAction, type KeyContext } from "./keymap.js";

/** A keydown with nothing in the way — the shell's own turf. */
const ctx = (over: Partial<KeyContext> = {}): KeyContext => ({
  key: "ArrowLeft",
  modified: false,
  defaultPrevented: false,
  inTextField: false,
  inDialog: false,
  onAyah: false,
  ...over,
});

describe("appKeyAction — the page turn", () => {
  it("turns the page with the horizontal arrows, RTL-wise", () => {
    // In an RTL mushaf the next page lies to the left.
    expect(appKeyAction(ctx({ key: "ArrowLeft" }))).toEqual({ kind: "page", step: 1 });
    expect(appKeyAction(ctx({ key: "ArrowRight" }))).toEqual({ kind: "page", step: -1 });
  });

  it("leaves the vertical arrows alone (they are the ayah stepper's / the scroll's)", () => {
    expect(appKeyAction(ctx({ key: "ArrowUp" }))).toBeNull();
    expect(appKeyAction(ctx({ key: "ArrowDown" }))).toBeNull();
  });

  it("ignores keys it does not own", () => {
    expect(appKeyAction(ctx({ key: "a" }))).toBeNull();
    expect(appKeyAction(ctx({ key: "Home" }))).toBeNull();
  });
});

describe("appKeyAction — the jumper", () => {
  it("opens on /", () => {
    expect(appKeyAction(ctx({ key: "/" }))).toEqual({ kind: "jumper" });
  });

  it("still opens while an ayah has focus — the stepper has no use for /", () => {
    expect(appKeyAction(ctx({ key: "/", onAyah: true }))).toEqual({ kind: "jumper" });
  });

  it("types a slash inside a text field instead of re-opening", () => {
    expect(appKeyAction(ctx({ key: "/", inTextField: true }))).toBeNull();
  });
});

describe("appKeyAction — precedence", () => {
  it("stands down when an ayah has focus: the Loop 3 stepper owns the arrows", () => {
    expect(appKeyAction(ctx({ key: "ArrowLeft", onAyah: true }))).toBeNull();
    expect(appKeyAction(ctx({ key: "ArrowRight", onAyah: true }))).toBeNull();
  });

  it("never second-guesses a key another handler already consumed", () => {
    expect(appKeyAction(ctx({ key: "ArrowLeft", defaultPrevented: true }))).toBeNull();
  });

  it("stands down under an open sheet", () => {
    expect(appKeyAction(ctx({ key: "ArrowLeft", inDialog: true }))).toBeNull();
    expect(appKeyAction(ctx({ key: "/", inDialog: true }))).toBeNull();
  });

  it("stands down inside a text field", () => {
    expect(appKeyAction(ctx({ key: "ArrowLeft", inTextField: true }))).toBeNull();
  });

  it("leaves modified combinations to the browser", () => {
    expect(appKeyAction(ctx({ key: "ArrowLeft", modified: true }))).toBeNull();
    expect(appKeyAction(ctx({ key: "/", modified: true }))).toBeNull();
  });
});
