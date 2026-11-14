import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "../i18n";
import { spokenName } from "../spoken-name";
import { watchCover } from "./short-band";
import styles from "./VerseDrawer.module.css";

/**
 * VerseDrawer — the verse's tools in one place (decision selection-drawer = D).
 *
 * In Verse mode a tap lights the verse and this drawer rises from the bottom
 * with everything a reader can do with that verse, each named in a word:
 * listen, the commentary, the words that share its roots, share, bookmark, and
 * the verse on QUL. Before it, those were loose glyphs strung along the bar
 * under the page, and on a phone they ran off its edge.
 *
 * It is not a dialog. The page stays live beneath it, so a tap on another verse
 * moves the light and the drawer follows; nothing is trapped. It rises over the
 * bar and the page slider, never over the page, so it cannot cover the verse it
 * is about — the cost the drawn options page found in a panel that sat on the
 * leaf. Escape, or its ×, puts it away and leaves the verse lit.
 */
/** The widest the drawer stands as a card, as its stylesheet's max-inline-size. */
const CARD_REM = 40;
/** The gap kept between the lit verse's last line and the drawer's top, in px. */
const CLEARANCE = 12;

/**
 * Where the lit verse stands on screen, top of its first line to the foot of
 * its last (null when none is lit), and the highest the page can lift its
 * first line.
 */
export type VerseClear = { span: { top: number; bottom: number } | null; riseTo: number };

export function VerseDrawer({
  label,
  open,
  onClose,
  end,
  onWhole,
  onPointerRest,
  onPointerAway,
  panel,
  onPanelClose,
  onCover,
  keepClear,
  clearKey,
  panelKey,
  tabbed,
  tag,
  children,
}: {
  /** The verse's own name, "Al-Baqarah 2:48"; null when no verse is lit. */
  label: string | null;
  open: boolean;
  onClose: () => void;
  /** At the head's end, before its ×: the look-alike buttons, when this is the tool row they go to. */
  end?: ReactNode;
  /** Told whether the drawer covers the whole bar, so what lives in the bar can ride its head instead. */
  onWhole?: (whole: boolean) => void;
  /**
   * A pointer came to rest on the drawer, and left it (selection-drawer ②: the
   * lit verse glows meanwhile). Away is also told when the drawer goes, since a
   * drawer that slides off under a still pointer is never left.
   */
  onPointerRest?: (e: { pointerType: string }) => void;
  onPointerAway?: () => void;
  /**
   * A tool opened inside the drawer, under the row of tools (selection-drawer
   * ③, a setting): today, the roots list. Null or absent when none is open.
   */
  panel?: ReactNode;
  /** Folds the open tool away; Escape calls it before it puts the drawer away. */
  onPanelClose?: () => void;
  /** While a tool is open inside it, where the drawer starts, so the page can lift the verse above it. */
  onCover?: (top: number | null) => void;
  /**
   * The verse the drawer must leave room for. A tool open inside it is cut so
   * the verse fits above it once the page has lifted it.
   * Asked again when `clearKey` changes (another verse lit).
   */
  keepClear?: (() => VerseClear) | undefined;
  clearKey?: string | null;
  /** Which tool is open inside it (listen, share, roots, looks); a new one is cut afresh. */
  panelKey?: string | null;
  /** The tools below stand as tabs: the box keeps its height and the tab in front scrolls. */
  tabbed?: boolean;
  /** Name this drawer's level in its head (drawer-marks.ts, the tag setting). */
  tag?: boolean;
  /** The tool buttons, each with its caption. */
  children: ReactNode;
}): JSX.Element | null {
  const { t } = useT();
  const shown = open && label !== null;
  const ref = useRef<HTMLElement>(null);

  // On a phone the drawer covers the bar under the page whole, and needs to
  // know where that bar starts to do it: cut to its own height, it stopped a
  // few pixels short and a sliver of the bar's buttons showed above it.
  // Wider, it stays a card in the middle of the bar, unless a bar button would
  // be cut by it: on a large iPad upright the bar's far end was wider than the
  // room beside the card, and the verse's name slid half under it (plan item
  // 94). Which buttons the bar holds, and how long their words are, decide it,
  // not the width alone, so the card's place is worked out and checked.
  // A drawer that goes away under a still pointer never hears it leave.
  const away = useRef(onPointerAway);
  away.current = onPointerAway;
  useEffect(() => {
    if (!open) away.current?.();
  }, [open]);
  useEffect(() => () => away.current?.(), []);

  const cardHeight = useRef(0);
  const told = useRef(onWhole);
  told.current = onWhole;
  useLayoutEffect(() => {
    const el = ref.current;
    const bar = document.querySelector<HTMLElement>("footer[data-keep-clear]");
    if (!shown || !el || !bar) return;
    // Only a new window size can turn the card back: what leaves the bar to
    // ride the drawer's head narrows the bar, and a check that let that flip
    // the card back would send it straight back to the bar.
    const fit = (resized = true) => {
      el.style.setProperty("--reach", `${window.innerHeight - bar.getBoundingClientRect().top}px`);
      if (!el.hasAttribute("data-whole")) cardHeight.current = el.getBoundingClientRect().height;
      // The card's width in the stylesheet: at most 40rem.
      const width = Math.min(window.innerWidth, CARD_REM * parseFloat(getComputedStyle(document.documentElement).fontSize));
      const card = {
        left: (window.innerWidth - width) / 2,
        right: (window.innerWidth + width) / 2,
        top: window.innerHeight - cardHeight.current,
      };
      const cut = [...bar.querySelectorAll<HTMLElement>("button, a")].some((b) => {
        const r = b.getBoundingClientRect();
        if (!r.width || el.contains(b)) return false;
        const meets = r.left < card.right && r.right > card.left && r.bottom > card.top;
        const under = r.left >= card.left - 0.5 && r.right <= card.right + 0.5 && r.top >= card.top - 0.5;
        return meets && !under;
      });
      const whole = cut || (!resized && el.hasAttribute("data-whole"));
      el.toggleAttribute("data-whole", whole);
      told.current?.(whole);
    };
    const onResize = () => fit();
    fit();
    window.addEventListener("resize", onResize);
    const seen = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize);
    seen?.observe(bar);
    // A look-alike button moving into or out of the bar changes its far end
    // without changing the bar's own size.
    const moved = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => fit(false));
    moved?.observe(bar, { childList: true, subtree: true });
    // The card can grow after it first measured itself, and a short card
    // covers no bar button: the likely reason the chips once stayed in the
    // bar, half under it, until the window changed size (a full test run,
    // 2026-11-12). Its own size changing checks again, but
    // never turns it back, as for the bar's buttons. A frame later, so the
    // check's own change of shape is not seen inside the same notice.
    let frame = 0;
    const grown = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => fit(false));
        });
    grown?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      grown?.disconnect();
      moved?.disconnect();
      seen?.disconnect();
      window.removeEventListener("resize", onResize);
      told.current?.(false);
    };
  }, [shown]);

  // Grown by a tool opened inside it, the drawer reaches up over the page, so
  // it says where it starts, the way a sheet does, and the page lifts the verse
  // clear of it. Without a tool open it stands over the bar alone and says
  // nothing: the page already keeps clear of the bar.
  const hasPanel = panel !== undefined && panel !== null && panel !== false;
  const coverTo = useRef(onCover);
  coverTo.current = onCover;
  useLayoutEffect(() => {
    const el = ref.current;
    const tell = coverTo.current;
    if (!shown || !hasPanel || !el || !tell) return;
    const stop = watchCover(el, () => el.offsetHeight, (top) => coverTo.current?.(top));
    return () => {
      stop();
      tell(null);
    };
  }, [shown, hasPanel]);

  // The tool's list is cut so the lit verse fits above the drawer once the page
  // has lifted it (onCover, above), never below a floor a few rows tall. The
  // cut is worked out from the verse's height and the highest the page can
  // lift it, not from where the verse stands now: the drawer rises before the
  // lift, and a cut measured from the verse's place then grew 400 ms later into
  // the room the lift had made. The row of tools jumped up under a reader's
  // finger, and a press meant for Same roots landed on the list (2026-11-13).
  // So the list is measured as each tool opens (`panelKey`), and never grows
  // after that.
  //
  // The verse's wash is redrawn as a tool opens, and is not on the page at that
  // moment. So its height is noted while the drawer stands with the verse lit
  // (`noted`), and the tool's list is cut from that note. The drawer can rise
  // with the look-alikes already open, a frame before the wash is drawn; the
  // note then arrives a frame or two later, while the drawer is still rising,
  // and the list is measured that once more.
  const panelRef = useRef<HTMLDivElement>(null);
  const clear = useRef(keepClear);
  clear.current = keepClear;
  const [noted, setNoted] = useState<number | null>(null);
  useEffect(() => {
    setNoted(null);
    if (!shown) return;
    let raf = 0;
    const until = performance.now() + 2000;
    const note = () => {
      const span = clear.current?.().span;
      if (span) setNoted(span.bottom - span.top);
      else if (performance.now() < until) raf = requestAnimationFrame(note);
    };
    note();
    return () => cancelAnimationFrame(raf);
  }, [shown, clearKey]);
  const tallRef = useRef(noted);
  tallRef.current = noted;
  useLayoutEffect(() => {
    const el = ref.current;
    const box = panelRef.current;
    if (!shown || !hasPanel || !el || !box) return;
    const fit = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const most = Math.min(window.innerHeight * 0.4, 22 * rem);
      const floor = Math.min(most, 10 * rem);
      const rest = el.offsetHeight - box.offsetHeight;
      const verse = clear.current?.();
      const span = verse?.span;
      const tall = span ? span.bottom - span.top : tallRef.current;      if (!verse || tall === null) {
        box.style.maxBlockSize = `${Math.round(most)}px`;
        return;
      }
      // A verse too tall for the room is lifted until its first line stands
      // just under the hop chips, or the page's top, and no higher (aboveCover).
      const room = window.innerHeight - (verse.riseTo + tall) - CLEARANCE - rest;
      box.style.maxBlockSize = `${Math.round(Math.max(floor, Math.min(most, room)))}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [shown, hasPanel, clearKey, panelKey, noted]);

  const panelOpen = useRef(hasPanel);
  panelOpen.current = hasPanel;
  const foldPanel = useRef(onPanelClose);
  foldPanel.current = onPanelClose;
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // A sheet opened from the drawer answers its own Escape first.
      if (document.querySelector('[role="dialog"]')) return;
      // A tool open inside the drawer folds away first; the drawer stays.
      if (panelOpen.current && foldPanel.current) {
        foldPanel.current();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, onClose]);

  if (!shown) return null;
  return (
    <section
      ref={ref}
      className={styles.drawer}
      aria-label={t.verseTools(label)}
      data-verse-drawer
      onPointerEnter={onPointerRest}
      onPointerLeave={onPointerAway}
    >
      <header className={styles.head}>
        <span className={styles.title}>
          {tag && <span className={styles.level}>{t.levelVerse}</span>}
          {label}
        </span>
        {end}
        <button type="button" className={styles.close} aria-label={t.close} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className={styles.tools}>{children}</div>
      {hasPanel && (
        <div ref={panelRef} className={styles.panel} data-tabbed={tabbed || undefined}>
          {panel}
        </div>
      )}
    </section>
  );
}

/** A plain tool of the drawer's own, in the same shape as the others. */
export function DrawerTool({
  glyph,
  caption,
  label,
  onClick,
}: {
  glyph: string;
  caption: string;
  label: string;
  onClick: () => void;
}): JSX.Element {
  const { t } = useT();
  return (
    <button type="button" aria-label={spokenName(label, caption, t.sep)} onClick={onClick}>
      <span aria-hidden="true">{glyph}</span>
      <span data-caption="">{caption}</span>
    </button>
  );
}
