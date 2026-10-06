import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type AppState } from "@hifth/core";
import { useT } from "../i18n";
import { nativeShare, shareBase } from "../native-bridge";
import { linksFor, shareShapeFromUrl, type SharePanel, type ShareShape } from "../share-links";
import styles from "./ShareSheet.module.css";

interface ShareSheetProps {
  /** The current view to encode into the shareable link, or null (nothing to share). */
  state: AppState | null;
  /** Whether the current view includes a trail (offers the "share the whole walk" copy). */
  hasTrail: boolean;
  /** What the link points at: one ayah (default) or a highlighted range (spec §7 range form). */
  variant?: "ayah" | "range";
  /**
   * Which of the three built shapes to show (decision share-sheet-builder).
   * Read once from the address so the decision page can mount each one; the
   * app itself never passes it.
   */
  shape?: ShareShape;
  /** The pitch build has a commentary panel to send someone to; the public one does not. */
  pitch?: boolean;
  /**
   * Where the open tray starts on a phone (window px), or null when it covers
   * nothing — so the page can lift the verse being shared above it.
   */
  onCover?: (top: number | null) => void;
}

/** Wider than this, the tray is a small card in the corner, not a band across the page. */
const WIDE = "(min-width: 40rem)";

type Feedback = { kind: "copied" | "shared" | "error"; text: string } | null;

/** Read once: the shape is a property of the visit, not of any one sheet. */
const SHAPE = shareShapeFromUrl(window.location.search);

/**
 * ShareSheet (spec §7) — the "send this view" affordance, and since the
 * share-sheet-builder decision also where a link to the app is built.
 *
 * Shape A is the sheet as it was: one tap, the website link, to the OS share
 * sheet when there is one (`navigator.share`), else the clipboard. Shapes B
 * and C open a small sheet at the bottom with the two links side by side; C
 * first asks what the link should open on arrival. Either way the recipient
 * lands *exactly here* — ayah, breadcrumb, trail, and the panel asked for —
 * because open = parse → restore is the same code path as a live hop.
 *
 * The app link is `hifth://…`, which a browser's share sheet may refuse, so it
 * is always copied; inside the shell the shell's own sheet takes it.
 *
 * Every path is user-initiated (a button tap): we never auto-share.
 */
export function ShareSheet({
  state,
  hasTrail,
  variant = "ayah",
  shape = SHAPE,
  pitch = false,
  onCover,
}: ShareSheetProps): JSX.Element | null {
  const { t } = useT();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<SharePanel>("");
  const isRange = variant === "range";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const legendId = useId();

  const ariaLabel = hasTrail ? t.shareAriaTrail : isRange ? t.shareAriaRange : t.shareAriaAyah;
  // The share payload speaks the sender's UI language: it is a sentence in
  // the sender's own share sheet before it is anything to the recipient, and
  // the link itself carries the view regardless of either side's language.
  const shareText = hasTrail ? t.shareTextTrail : isRange ? t.shareTextRange : t.shareTextAyah;

  /** The website link: the shell's sheet, then the browser's, then the clipboard. */
  async function shareSite(url: string): Promise<void> {
    const shareData: ShareData = { title: t.shareTitle, text: shareText, url };
    // Inside the shell, its own share sheet: the page there has neither
    // `navigator.share` nor a clipboard, and the shell says the outcome.
    if (nativeShare(shareData as { url: string; title: string; text: string })) return;
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
    await copy(url);
  }

  /** The app link: the shell's sheet can take it; a browser only copies it. */
  async function shareApp(url: string): Promise<void> {
    if (nativeShare({ title: t.shareTitle, text: shareText, url })) return;
    await copy(url);
  }

  async function copy(url: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(url);
      setFeedback({ kind: "copied", text: t.copied });
    } catch {
      setFeedback({ kind: "error", text: t.copyFailed });
    }
  }

  // `shareBase` is this page in a browser and the public site inside the
  // native shell, where the page's own origin is a private scheme nobody
  // else could open.
  const links = state ? linksFor(state, isRange ? "" : panel, shareBase()) : null;

  function onTrigger(): void {
    if (!links) return;
    if (shape === "a") void shareSite(links.site);
    else {
      setFeedback(null);
      setOpen((o) => !o);
    }
  }

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // On a phone the tray is a band across the bottom of the screen, and the
  // verse being shared often sits right there: the page is told where the band
  // starts so it moves the verse up clear of it (owner, 2026-09-30, choosing C:
  // "keep the verse visible"). The same path the commentary note uses.
  useLayoutEffect(() => {
    if (!onCover) return;
    const sheet = sheetRef.current;
    if (!open || !sheet) {
      onCover(null);
      return;
    }
    const report = () => onCover(window.matchMedia(WIDE).matches ? null : sheet.getBoundingClientRect().top);
    report();
    window.addEventListener("resize", report);
    // The tray grows a row for the look-alike chips once they come down onto
    // it, and its top moves up with it: say so, or the chips sit a row low.
    const seen = new ResizeObserver(report);
    seen.observe(sheet);
    return () => {
      seen.disconnect();
      window.removeEventListener("resize", report);
    };
  }, [open, onCover]);
  useEffect(() => () => onCover?.(null), [onCover]);

  // A sheet that is open takes the focus, and Escape gives it back.
  useEffect(() => {
    if (!open) return;
    const first = sheetRef.current?.querySelector<HTMLElement>("input, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  if (!state || !links) return null;

  const panels: { id: SharePanel; label: string }[] = [
    { id: "", label: t.shareAsIs },
    { id: "lookalikes", label: t.shareLookalikes },
    { id: "roots", label: t.shareRoots },
    ...(pitch ? [{ id: "commentary" as const, label: t.shareCommentary }] : []),
  ];

  const sheet =
    open &&
    createPortal(
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-label={ariaLabel}>
        <div className={styles.sheetHead}>
          <span className={styles.sheetTitle}>{ariaLabel}</span>
          <button type="button" className={styles.close} onClick={close} aria-label={t.close}>
            ×
          </button>
        </div>
        {shape === "c" && !isRange && (
          <div className={styles.panels} role="radiogroup" aria-labelledby={legendId}>
            <span id={legendId} className={styles.legend}>
              {t.shareOpenWith}
            </span>
            {panels.map((p) => (
              <label key={p.id} className={styles.panel}>
                <input
                  type="radio"
                  name="share-panel"
                  value={p.id}
                  checked={panel === p.id}
                  onChange={() => setPanel(p.id)}
                />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
        )}
        <div className={styles.links}>
          <button
            type="button"
            className={styles.link}
            onClick={() => void shareSite(links.site)}
            aria-label={t.shareSiteAria}
          >
            <span className={styles.glyph} aria-hidden="true">
              ⇪
            </span>
            <span>{t.shareSite}</span>
          </button>
          <button
            type="button"
            className={styles.link}
            onClick={() => void shareApp(links.app)}
            aria-label={t.shareAppAria}
          >
            <span className={styles.glyph} aria-hidden="true">
              ⧉
            </span>
            <span>{t.shareApp}</span>
          </button>
        </div>
        <span className={styles.feedback} role="status" data-kind={feedback?.kind}>
          {feedback?.text}
        </span>
      </div>,
      document.body,
    );

  return (
    <div className={styles.wrap}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.share}
        onClick={onTrigger}
        aria-label={ariaLabel}
        aria-expanded={shape === "a" ? undefined : open}
      >
        <span className={styles.glyph} aria-hidden="true">
          ⇪
        </span>
        <span className={styles.label}>{hasTrail ? t.shareLabelTrail : t.shareLabel}</span>
      </button>
      {shape === "a" && feedback && (
        <span className={styles.feedback} role="status" data-kind={feedback.kind}>
          {feedback.text}
        </span>
      )}
      {sheet}
    </div>
  );
}
