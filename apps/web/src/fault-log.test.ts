import { afterEach, describe, expect, it } from "vitest";
import { FAULT_LIMIT, clearFaults, installFaultLog, noteFault, recentFaults } from "./fault-log";

/*
 * Errors nothing else caught (a tap handler that throws, a promise nobody
 * waited on) do not stop the page, so they get no screen: a warning the reader
 * cannot act on does not go on the screen. They are kept here, in memory only,
 * for the "Report a problem" button to show the reader before anything is sent.
 */

afterEach(() => clearFaults());

describe("the record of errors nothing else caught", () => {
  it("keeps an uncaught error and an unhandled promise failure", () => {
    const target = new EventTarget();
    const remove = installFaultLog(target);

    target.dispatchEvent(
      Object.assign(new Event("error"), {
        message: "made-up tap fault",
        filename: "http://localhost/assets/app.js",
        lineno: 12,
        error: new Error("made-up tap fault"),
      }),
    );
    target.dispatchEvent(
      Object.assign(new Event("unhandledrejection"), { reason: new Error("made-up fetch fault") }),
    );
    remove();

    expect(recentFaults().map((f) => [f.how, f.message])).toEqual([
      ["uncaught", "made-up tap fault"],
      ["unhandled promise", "made-up fetch fault"],
    ]);
    expect(recentFaults()[0]?.where).toBe("app.js:12");
  });

  it("stops listening once removed", () => {
    const target = new EventTarget();
    installFaultLog(target)();
    target.dispatchEvent(Object.assign(new Event("error"), { message: "after" }));
    expect(recentFaults()).toEqual([]);
  });

  it("keeps only the latest few, oldest dropped first", () => {
    for (let i = 0; i < FAULT_LIMIT + 5; i++) noteFault("uncaught", `fault ${i}`);
    const kept = recentFaults();
    expect(kept).toHaveLength(FAULT_LIMIT);
    expect(kept[0]?.message).toBe("fault 5");
    expect(kept.at(-1)?.message).toBe(`fault ${FAULT_LIMIT + 4}`);
  });

  it("cuts a very long message short", () => {
    noteFault("uncaught", "x".repeat(5000));
    expect(recentFaults()[0]?.message.length).toBeLessThanOrEqual(300);
  });
});
