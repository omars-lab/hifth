import { useCallback, useState } from "react";
import { serializeState, type AppState } from "@hifth/core";
import styles from "./ShareSheet.module.css";

interface ShareSheetProps {
  /** The current view to encode into the shareable link, or null (nothing to share). */
  state: AppState | null;
  /** Whether the current view includes a trail (offers the "share the whole walk" copy). */
  hasTrail: boolean;
}

type Feedback = { kind: "copied" | "shared" | "error"; text: string } | null;

/**
 * ShareSheet (spec §7) — the "send this view" affordance. It turns the current
 * app state into an anchor link (the same `serializeState` a cold-open parses)
 * and hands it to the OS share sheet when available (`navigator.share`), else
 * copies it to the clipboard. Either way the recipient lands *exactly here* —
 * ayah, breadcrumb, and trail — because open = parse → restore is the same code
 * path as a live hop.
 *
 * Both paths are user-initiated (a button tap): we never auto-share.
 */
export function ShareSheet({ state, hasTrail }: ShareSheetProps): JSX.Element | null {
  const [feedback, setFeedback] = useState<Feedback>(null);

  const onShare = useCallback(async () => {
    if (!state) return;
    const url = window.location.origin + window.location.pathname + serializeState(state);
    const shareData: ShareData = {
      title: "حفظ",
      text: hasTrail ? "مسار مُتشابهات" : "آية",
      url,
    };
    // Prefer the native share sheet; fall back to clipboard.
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share(shareData);
        setFeedback({ kind: "shared", text: "تمت المشاركة" });
        return;
      } catch (err) {
        // User cancelled the sheet — not an error; say nothing.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Otherwise fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard?.writeText(url);
      setFeedback({ kind: "copied", text: "نُسخ الرابط" });
    } catch {
      setFeedback({ kind: "error", text: "تعذّر النسخ" });
    }
  }, [state, hasTrail]);

  if (!state) return null;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.share}
        onClick={() => void onShare()}
        aria-label={hasTrail ? "شارك المسار كرابط" : "شارك هذه الآية كرابط"}
      >
        <span className={styles.glyph} aria-hidden="true">
          ⇪
        </span>
        <span className={styles.label}>{hasTrail ? "شارك المسار" : "شارك"}</span>
      </button>
      {feedback && (
        <span className={styles.feedback} role="status" data-kind={feedback.kind}>
          {feedback.text}
        </span>
      )}
    </div>
  );
}
