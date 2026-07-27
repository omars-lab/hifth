import { useEffect, useRef } from "react";
import { parseHash, serializeState, type AppState } from "@hifth/core";

/**
 * Hash router (spec §7) — the app's view ↔ URL bridge. It does two things:
 *
 *  - **Cold open / back-forward:** parses `location.hash` once on mount and on
 *    every `hashchange`, handing the decoded `AppState` to `onRestore`. App feeds
 *    that through the *same* select/navigateTo path a live hop uses — there is no
 *    separate deep-link code to drift (spec §7).
 *  - **Live view → URL:** whenever `state` changes, writes the serialized hash
 *    back with `replaceState` (no new history entry per hop — the trail is the
 *    history), so the address bar always holds a shareable link to "here".
 *
 * The write is guarded so echoing our own hash back does not re-trigger a
 * restore (which would fight the live state). DOM-free serialization lives in
 * core; this owns only the `location`/`history` I/O.
 */
export function useHashRouter(
  state: AppState | null,
  onRestore: (state: AppState) => void,
  ready = true,
): void {
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  // The hash we last wrote, so a hashchange we caused is ignored.
  const selfWritten = useRef<string | null>(null);
  // Guard the cold-open restore so it runs exactly once, when we first become
  // ready — a teacher's link parsed before the resolver loads must not be lost.
  const coldOpened = useRef(false);

  // Restore on `ready` (cold open, once the resolver exists) and on user-driven
  // hash changes (paste, back/forward). The resolver loads async, so the mount
  // may precede it; we defer the first restore to the ready edge, then listen.
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash;
      if (hash === selfWritten.current) return;
      const parsed = parseHash(hash);
      if (parsed) onRestoreRef.current(parsed);
    };
    if (ready && !coldOpened.current) {
      coldOpened.current = true;
      apply(); // cold open, now that restore can actually resolve the link
    }
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [ready]);

  // Reflect live state into the URL (replace, not push — trail is the history).
  // Held until after the cold-open restore, so the initial (empty) view can't
  // overwrite an incoming teacher's link before we've read it.
  useEffect(() => {
    if (!state || !coldOpened.current) return;
    const hash = serializeState(state);
    if (hash === window.location.hash) return;
    selfWritten.current = hash;
    window.history.replaceState(null, "", hash);
  }, [state]);
}
