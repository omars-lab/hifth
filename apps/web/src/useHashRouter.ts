import { useEffect, useRef } from "react";
import { parseHash, serializeState, type AppState } from "@hifth/core";
import { postReady, postRoute } from "./native-bridge";

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
  // The hash for what the app is showing now, so a hashchange that only names
  // the current view is ignored. It was once "the hash we last wrote", which
  // went stale the moment the reader moved on: a link back to that page was
  // then taken for our own echo and dropped, leaving the reader where they were.
  const showing = useRef<string | null>(null);
  // Guard the cold-open restore so it runs exactly once, when we first become
  // ready — a teacher's link parsed before the resolver loads must not be lost.
  const coldOpened = useRef(false);
  // Where the cold-open link points, held until the view has moved there. The
  // app's first view (page 1, nothing selected) exists in the same moment the
  // link is read, and used to be reported — and written over the link in the
  // address bar — before the restore had landed: the shell heard "page 1" then
  // the verse, its window title flickered, and a `current` request queued
  // before the first route was answered with page 1 (native-shell.md ⑧).
  const landing = useRef<string | null>(null);

  // Restore on `ready` (cold open, once the resolver exists) and on user-driven
  // hash changes (paste, back/forward). The resolver loads async, so the mount
  // may precede it; we defer the first restore to the ready edge, then listen.
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash;
      if (hash === showing.current) return;
      const parsed = parseHash(hash);
      if (parsed) onRestoreRef.current(parsed);
      return parsed;
    };
    if (ready && !coldOpened.current) {
      coldOpened.current = true;
      const parsed = apply(); // cold open, now that restore can actually resolve the link
      if (parsed) landing.current = place(parsed);
      // The native shell holds any early `hifth://` link until it hears this.
      postReady();
    }
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [ready]);

  // Reflect live state into the URL (replace, not push — trail is the history).
  // Held until after the cold-open restore, so the initial (empty) view can't
  // overwrite an incoming teacher's link before we've read it.
  useEffect(() => {
    if (!state || !coldOpened.current) return;
    // The view the link is restoring into is not yet the link's: say nothing
    // until it is. Only the *place* is compared — a link's `?w=`, `?open=` or
    // `?tool=` never comes back out of the view, so a link to the page already
    // showing is reported at once, as nothing will move the view for it.
    if (landing.current !== null) {
      const arrived = place(state) === landing.current;
      landing.current = null;
      if (!arrived) return;
    }
    const hash = serializeState(state);
    showing.current = hash;
    // The shell has no address bar; this is how it learns what is on screen.
    postRoute(hash);
    if (hash === window.location.hash) return;
    window.history.replaceState(null, "", hash);
  }, [state]);
}

/** The page or verse a view is on, with nothing else: what a restore moves. */
function place(state: AppState): string {
  const { edition, select, page } = state;
  return serializeState(page === undefined ? { edition, select } : { edition, select, page });
}
