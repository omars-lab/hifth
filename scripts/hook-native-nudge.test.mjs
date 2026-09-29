import { test } from "node:test";
import assert from "node:assert/strict";
import { verdict } from "./hook-native-nudge.mjs";

test("nothing to say when no Swift under native/Hifth changed", () => {
  assert.equal(verdict(["apps/web/src/App.tsx", "native/Makefile.native"], false), null);
});

test("sends the session back when shell Swift changed and no test did", () => {
  const r = verdict(["native/Hifth/Web/ShellModel.swift"], false);
  assert.match(r, /ShellModel\.swift/);
  assert.match(r, /make app-test/);
});

test("lets the stop through when a test changed alongside", () => {
  assert.equal(verdict(["native/Hifth/Web/ShellModel.swift", "native/HifthUITests/SmokeTests.swift"], false), null);
  assert.equal(verdict(["native/Hifth/Route/Route.swift", "native/HifthTests/RouteTests.swift"], false), null);
});

test("never loops: a second stop is let through", () => {
  assert.equal(verdict(["native/Hifth/Web/ShellModel.swift"], true), null);
});
