import { useCallback, useState } from "react";

/**
 * LiveAnnouncer — a single polite `aria-live` region for the app. Selection,
 * hops, and page changes are silent to screen readers otherwise (the survey's
 * gap #4): the SVG is one opaque `role="img"`, so a hop that pans to a new page
 * announces nothing. This is the app's spoken channel — App calls `announce(...)`
 * on each meaningful change and the message is read without moving focus.
 *
 * `role="status"` + `aria-live="polite"` so announcements queue behind whatever
 * the user is doing rather than interrupting. Visually hidden (`sr-only`).
 */
export function useAnnouncer(): {
  message: string;
  announce: (msg: string) => void;
} {
  const [message, setMessage] = useState("");
  const announce = useCallback((msg: string) => {
    // Re-set to "" first so repeating the same message still re-announces
    // (AT only speaks on a text change).
    setMessage("");
    // A microtask gap is enough for React to flush the clear before the set.
    queueMicrotask(() => setMessage(msg));
  }, []);
  return { message, announce };
}

export function LiveAnnouncer({ message }: { message: string }): JSX.Element {
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
