import { useCallback, useState } from "react";
import { serializeState, type AppState } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./ShareSheet.module.css";

interface ShareSheetProps {
  /** The current view to encode into the shareable link, or null (nothing to share). */
  state: AppState | null;
  /** Whether the current view includes a trail (offers the "share the whole walk" copy). */
  hasTrail: boolean;
  /** What the link points at: one ayah (default) or a highlighted range (spec §7 range form). */
  variant?: "ayah" | "range";
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
export function ShareSheet({
  state,
  hasTrail,
  variant = "ayah",
}: ShareSheetProps): JSX.Element | null {
  const { t } = useT();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const isRange = variant === "range";

  const onShare = useCallback(async () => {
    if (!state) return;
    const url = window.location.origin + window.location.pathname + serializeState(state);
    // The share payload speaks the sender's UI language: it is a sentence in
    // the sender's own share sheet before it is anything to the recipient, and
    // the link itself carries the view regardless of either side's language.
    const shareData: ShareData = {
      title: t.shareTitle,
      text: hasTrail ? t.shareTextTrail : isRange ? t.shareTextRange : t.shareTextAyah,
      url,
    };
    // Prefer the native share sheet; fall back to clipboard.
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share(shareData);
        setFeedback({ kind: "shared", text: t.shared });
        return;
      } catch (err) {
        // User cancelled the sheet — not an error; say nothing.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Otherwise fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard?.writeText(url);
      setFeedback({ kind: "copied", text: t.copied });
    } catch {
      setFeedback({ kind: "error", text: t.copyFailed });
    }
  }, [state, hasTrail, isRange, t]);

  if (!state) return null;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.share}
        onClick={() => void onShare()}
        aria-label={
          hasTrail ? t.shareAriaTrail : isRange ? t.shareAriaRange : t.shareAriaAyah
        }
      >
        <span className={styles.glyph} aria-hidden="true">
          ⇪
        </span>
        <span className={styles.label}>{hasTrail ? t.shareLabelTrail : t.shareLabel}</span>
      </button>
      {feedback && (
        <span className={styles.feedback} role="status" data-kind={feedback.kind}>
          {feedback.text}
        </span>
      )}
    </div>
  );
}
