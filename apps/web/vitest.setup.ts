/// <reference types="@testing-library/jest-dom" />
import "@testing-library/jest-dom/vitest";

/**
 * A unit test that reaches the network is always a bug, but it is a bug that
 * hides well. jsdom leaves `fetch` as Node's real implementation, and every URL
 * this app requests is root-relative (`/assets/adj/…`), which undici rejects
 * with `TypeError: Failed to parse URL`. Inside a promise chain nobody awaits —
 * a manifest load that sets state, that runs an effect, that requests a shard —
 * that surfaces as an *unhandled rejection* long after the assertion it belongs
 * to has passed. Vitest reports it only if it lands before the run ends, so the
 * suite says 89/89 and `make ci` goes red only on the runs where the machine
 * happened to be busy enough. It was seen twice under `make ci` and never once
 * standalone, including under deliberate CPU contention — which is the whole
 * problem with it, and the reason the fix cannot be confirmed by re-running.
 *
 * So make it deterministic instead. A test that wants the network stubs it (see
 * App.test.tsx, which stubs for the whole file precisely because the app's
 * loading chain outlives any single test); anything else fails on the first
 * request, naming the URL, every time.
 */
globalThis.fetch = ((input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.toString();
  throw new Error(
    `unit test tried to fetch ${url}\n` +
      `  Unit tests must not touch the network. Stub it in the test file:\n` +
      `    vi.stubGlobal("fetch", vi.fn(...))  — in beforeAll, not beforeEach,\n` +
      `    or a load chain that outlives one test will land here after teardown.`,
  );
}) as typeof fetch;
