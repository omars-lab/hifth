/**
 * The last few things that went wrong on the page, kept in memory only.
 *
 * Two kinds arrive here. A part of the page that throws while it draws stops
 * the page, and the stopped screen (`components/PageStopped.tsx`) notes it.
 * An error nothing else caught (a tap handler that throws, a promise nobody
 * waited on) leaves the page working, so it gets no screen of its own: a
 * warning the reader cannot act on does not go on the screen. Both are kept for
 * the "Report a problem" button (launch item 18), which shows the reader the
 * whole report before anything is sent.
 *
 * Nothing here is written to storage or sent anywhere. Reloading the page
 * empties it.
 */

export type FaultHow = "drawing" | "uncaught" | "unhandled promise";

export interface Fault {
  readonly at: number;
  readonly how: FaultHow;
  readonly message: string;
  /** The script's file name and line, when the browser gives them. */
  readonly where?: string;
}

/** How many are kept; a report needs the latest, not a history. */
export const FAULT_LIMIT = 20;
const MESSAGE_LIMIT = 300;

const faults: Fault[] = [];

function messageOf(value: unknown): string {
  if (value instanceof Error) return value.message || value.name;
  if (typeof value === "string") return value;
  try {
    return String(value);
  } catch {
    return "unreadable";
  }
}

/** Keep one fault. `where` is a script address and line, if known. */
export function noteFault(how: FaultHow, value: unknown, where?: { file?: string; line?: number }): void {
  const message = messageOf(value).slice(0, MESSAGE_LIMIT);
  const file = where?.file ? where.file.split(/[/?#]/).filter(Boolean).at(-1) : undefined;
  const fault: Fault = {
    at: Date.now(),
    how,
    message,
    ...(file ? { where: where?.line ? `${file}:${where.line}` : file } : {}),
  };
  faults.push(fault);
  if (faults.length > FAULT_LIMIT) faults.splice(0, faults.length - FAULT_LIMIT);
}

/** The kept faults, oldest first. A copy, so a caller cannot change the record. */
export function recentFaults(): readonly Fault[] {
  return faults.slice();
}

export function clearFaults(): void {
  faults.length = 0;
}

/**
 * Listen for errors nothing else caught. Returns the way to stop listening.
 * It only records: it never stops the browser's own handling, so the error
 * still shows in the developer console as before.
 */
export function installFaultLog(target: EventTarget): () => void {
  const onError = (event: Event): void => {
    const e = event as ErrorEvent;
    noteFault("uncaught", e.error ?? e.message, { file: e.filename, line: e.lineno });
  };
  const onRejection = (event: Event): void => {
    noteFault("unhandled promise", (event as PromiseRejectionEvent).reason);
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
