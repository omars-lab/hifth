import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type AppState, type LeafSide } from "@hifth/core";
import { useT } from "../i18n";
import { nativeShare, shareBase } from "../native-bridge";
import { linksFor, shareShapeFromUrl, type SharePanel, type ShareShape } from "../share-links";
import { leafStyle, useOverLeaf } from "./over-leaf";
import { useSideCover, type CardSpan } from "./short-band";
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
  /**
   * Where the open sheet starts (window px) at any width, card or tray, or
   * null once it closes: a card in a sideways phone's corner covers no foot of
   * the page, but the look-alike chips ride its top row all the same.
   */
  onTop?: (top: number | null) => void;
  /**
   * Where the open card spans across the window, or null once it closes, so
   * a single page on a laptop moves aside for it as it does for the roots list.
   */
  onSide?: (span: CardSpan | null) => void;
  /**
   * Which side of a spread the card lies over, or null for its corner. The app
   * passes the leaf the verse is *not* on, as it does for the roots list: in
   * the corner the card covered the very verse being shared (look-alike rows ⑫).
   */
  side?: LeafSide | null;
  /**
   * Opened inside the verse's drawer instead of as a card of its own
   * (selection-drawer ③, a setting). The button only says whether the drawer
   * holds the links; `ShareInDrawer` draws them there. Absent: today's card.
   */
  inDrawer?: { open: boolean; onToggle: () => void } | undefined;
}

/** Wider than this, the tray is a small card in the corner, not a band across the page. */
const WIDE = "(min-width: 40rem)";

type Feedback = { kind: "copied" | "shared" | "error"; text: string } | null;

/** Read once: the shape is a property of the visit, not of any one sheet. */
const SHAPE = shareShapeFromUrl(window.location.search);

/**
 * What sharing a view needs, in a card or in the drawer: its name, its two
 * links (with the panel the sender picked written in), and the three ways out
 * (the shell's sheet, the browser's, the clipboard), with what happened.
 */
function useShare(state: AppState | null, hasTrail: boolean, variant: "ayah" | "range") {
  const { t } = useT();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [panel, setPanel] = useState<SharePanel>("");
  const isRange = variant === "range";

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

  return { ariaLabel, links, panel, setPanel, isRange, feedback, setFeedback, shareSite, shareApp };
}

type Share = ReturnType<typeof useShare>;

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
  onTop,
  onSide,
  side = null,
  inDrawer,
}: ShareSheetProps): JSX.Element | null {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const share = useShare(state, hasTrail, variant);
  const { ariaLabel, links, feedback, setFeedback, shareSite } = share;

  function onTrigger(): void {
    if (!links) return;
    if (shape === "a") void shareSite(links.site);
    else if (inDrawer) inDrawer.onToggle();
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
    if (!onCover && !onTop) return;
    const sheet = sheetRef.current;
    if (!open || !sheet) {
      onCover?.(null);
      onTop?.(null);
      return;
    }
    const report = () => {
      const top = sheet.getBoundingClientRect().top;
      onCover?.(window.matchMedia(WIDE).matches ? null : top);
      onTop?.(top);
    };
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
  }, [open, onCover, onTop]);
  useEffect(() => () => onCover?.(null), [onCover]);
  useEffect(() => () => onTop?.(null), [onTop]);
  // On a laptop the card stands in the corner beside the page, where the roots
  // list stands, and covered the start of the page's lines (look-alike rows ⑫).
  const place = useOverLeaf(open, side);
  useSideCover(open, side !== null, sheetRef, onSide);

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

  const sheet =
    open &&
    !inDrawer &&
    createPortal(
      <div
        ref={sheetRef}
        className={styles.sheet}
        style={leafStyle(place, "content")}
        data-side={side ?? undefined}
        role="dialog"
        aria-label={ariaLabel}
      >
        <div className={styles.sheetHead}>
          <span className={styles.sheetTitle}>{ariaLabel}</span>
          <button type="button" className={styles.close} onClick={close} aria-label={t.close}>
            ×
          </button>
        </div>
        <ShareBody share={share} shape={shape} pitch={pitch} />
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
        aria-expanded={shape === "a" ? undefined : inDrawer ? inDrawer.open : open}
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

/**
 * What the sheet holds below its title: what the link should open, the two
 * links, and what happened. The same in the card and in the drawer.
 */
function ShareBody({ share, shape, pitch }: { share: Share; shape: ShareShape; pitch: boolean }): JSX.Element | null {
  const { t } = useT();
  const legendId = useId();
  const { links, panel, setPanel, isRange, feedback, shareSite, shareApp } = share;
  if (!links) return null;
  const panels: { id: SharePanel; label: string }[] = [
    { id: "", label: t.shareAsIs },
    { id: "lookalikes", label: t.shareLookalikes },
    { id: "roots", label: t.shareRoots },
    ...(pitch ? [{ id: "commentary" as const, label: t.shareCommentary }] : []),
  ];
  return (
    <>
      {shape === "c" && !isRange && (
        <div className={styles.panels} role="radiogroup" aria-labelledby={legendId}>
          <span id={legendId} className={styles.legend}>
            {t.shareOpenWith}
          </span>
          {panels.map((p) => (
            <label key={p.id} className={styles.panel}>
              <input
                type="radio"
                name={`share-panel-${legendId}`}
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
    </>
  );
}

/**
 * The share links drawn inside the verse's drawer (selection-drawer ③, a
 * setting): the same body as the card, under the drawer's own heading, so the
 * verse stays in sight and one Escape folds it.
 */
export function ShareInDrawer({
  state,
  hasTrail,
  variant = "ayah",
  shape = SHAPE,
  pitch = false,
}: Pick<ShareSheetProps, "state" | "hasTrail" | "variant" | "shape" | "pitch">): JSX.Element | null {
  const share = useShare(state, hasTrail, variant);
  if (!state || !share.links) return null;
  return (
    <section className={styles.inDrawer} role="region" aria-label={share.ariaLabel}>
      <ShareBody share={share} shape={shape} pitch={pitch} />
    </section>
  );
}
