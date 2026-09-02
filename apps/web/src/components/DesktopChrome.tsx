import { useT } from "../i18n";
import { LOCALES } from "../lang";
import { LOCALE_IDS } from "../messages/locales.gen";
import { JUMPER_KEY } from "@hifth/core";
import { ZOOM_STEPS } from "./PageStage";
import styles from "./DesktopChrome.module.css";

/** One leaf or two. */
export type PageMode = "one" | "two";

/**
 * The nearest rung strictly past `z` going `step`, or null at the end of the
 * ladder.
 *
 * Not an index arithmetic on `indexOf`, because `z` is frequently on no rung at
 * all: it is whatever the stage last *applied*, and a hop frames its target at
 * `DEFAULT_HOP_ZOOM` — 1.55, deliberately between 1.5 and 2. Asking for the
 * nearest rung past where we are gets the reader onto the ladder with their
 * first press, in the direction they pressed, from wherever a hop left them.
 *
 * The epsilon is because that level has been through a clamp and a float
 * multiply: 0.9999999 must not count as being below the rung it is standing on,
 * or `−` would appear to do nothing.
 */
function rung(z: number, step: 1 | -1): number | null {
  const ladder = step > 0 ? ZOOM_STEPS : [...ZOOM_STEPS].reverse();
  for (const r of ladder) if (step > 0 ? r > z + 1e-3 : r < z - 1e-3) return r;
  return null;
}

interface DesktopChromeProps {
  /** Whether the book is open. Read, not owned — App holds the state. */
  pageMode: PageMode;
  onPageMode: (mode: PageMode) => void;
  /** What the paper is magnified to, as the stage last applied it. */
  zoom: number;
  /** Ask for a new level. What actually lands comes back through `zoom`. */
  onZoom: (z: number) => void;
}

/**
 * The header controls a phone has no room for, and the ones it has no *use* for.
 *
 * The governing rule for anything in this file (docs/design/desktop.md §1): **a
 * bigger screen is not a licence to add features, it is room to stop hiding the
 * ones that already exist.** Every control here names the mobile constraint that
 * put it out of reach. If a future addition cannot name one, it is a new feature
 * and belongs in the PLAN, not in a media query.
 *
 * Hidden by CSS below the breakpoint rather than unmounted, unlike the spread —
 * and the difference is the whole reason the two are gated differently. The
 * spread's second leaf costs a ~170 KB fetch and a Highlighter, so it must not
 * be *built*; these are a few spans, and `display: none` takes them out of the
 * accessibility tree and out of the header's intrinsic width, which is all that
 * was ever needed. `e2e/chrome-fit.spec.ts` measures that width from 320px up
 * and will say so if this stops being true.
 */
export function DesktopChrome({
  pageMode,
  onPageMode,
  zoom,
  onZoom,
}: DesktopChromeProps): JSX.Element {
  const { t, lang, setLang } = useT();
  // The stepper works whether the book is open or closed: a spread magnifies
  // both leaves together, so the only thing that greys a button out is reaching
  // the end of the ladder. (It used to be off entirely while two pages showed;
  // the reader asked for the opposite, and the record that reversed it names why
  // the old finding no longer holds.)
  const out = rung(zoom, -1);
  const into = rung(zoom, 1);

  return (
    <div className={styles.extras}>
      {/*
       * One leaf or two — the control the whole desktop spread now hangs on.
       *
       * The mobile constraint it names is the bluntest one in this file: below
       * the breakpoint there is no second leaf to *have*, so a switch between
       * one page and two would be a switch between one page and one page.
       *
       * It exists at all because the answer used to be derived — zoom past fit
       * and the book closed itself, zoom back and it opened. Three distinct
       * desyncs came out of that one derivation, and the reader had no way to
       * say "keep it closed" or "keep it open" at any magnification. Asking is
       * the fix; the derivation is gone (docs/design/desktop.md §8 ②).
       *
       * A radiogroup and not a checkbox, copying `langRow` beside it down to the
       * markup: two mutually exclusive states are two radios, and a checkbox
       * labelled "two pages" would leave a listener guessing whether *checked*
       * means the box is ticked or the book is open.
       */}
      <div
        className={styles.modeRow}
        role="radiogroup"
        aria-label={t.spreadSectionTitle}
        data-page-mode={pageMode}
      >
        {(["one", "two"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            className={styles.mode}
            aria-checked={pageMode === mode}
            /* The visible word is «واحدة» / "One" because the header has room
               for a word and not for a phrase; the accessible name carries the
               phrase, exactly as `langRow` carries the full language name. */
            aria-label={mode === "one" ? t.spreadOneAria : t.spreadTwoAria}
            onClick={() => onPageMode(mode)}
          >
            {mode === "one" ? t.spreadOne : t.spreadTwo}
          </button>
        ))}
      </div>

      {/*
       * The magnifier, which is a button because it stopped being a wheel.
       *
       * The mobile constraint: a phone has a pinch, and a pinch is a better
       * magnifier than any pair of buttons. A trackpad's pinch is not available
       * to us — macOS encodes it as `ctrl`+wheel, indistinguishable from a real
       * `ctrl`+scroll — so on a laptop the gesture that everyone reaches for
       * either does nothing or does something violent, and the honest answer is
       * a control that says what it will do before it does it.
       *
       * A group, not a spinbutton. `role="spinbutton"` would promise arrow-key
       * increments across a continuous range; this is nine named rungs, and the
       * two buttons plus a readout describe that without lying about it.
       *
       * The readout is plain text and not a live region, which is a correction
       * rather than an omission: the app already has exactly one polite
       * announcer, and a second one in the header would compete with it for the
       * same reader at the same moment — a page turn and a zoom both speak. So
       * what landed is announced through `useAnnouncer` at the App level, where
       * every other outcome in this app is announced. This span is for the eye.
       */}
      <div className={styles.zoomRow} role="group" aria-label={t.zoomSectionTitle}>
        <button
          type="button"
          className={styles.zoomBtn}
          aria-label={t.zoomOut}
          disabled={out === null}
          onClick={() => out !== null && onZoom(out)}
        >
          −
        </button>
        <span className={styles.zoomLevel}>{t.zoomLevel(Math.round(zoom * 100))}</span>
        <button
          type="button"
          className={styles.zoomBtn}
          aria-label={t.zoomIn}
          disabled={into === null}
          onClick={() => into !== null && onZoom(into)}
        >
          +
        </button>
      </div>

      {/*
       * The language switch, in the header at last.
       *
       * On a phone it lives inside the colophon sheet, and `Colophon.tsx:113`
       * is candid about why: chrome-fit holds the header inside 320px with
       * seventeen pixels of slack, and a sixth control does not fit in seventeen
       * pixels. That is the correct answer to a phone and a poor one to a 1440px
       * window, where the only setting a bilingual reader might want on arrival
       * is two levels deep behind a wordmark.
       *
       * It is *added* here, not moved: the sheet keeps its copy. A control that
       * relocates as the window resizes is a control the reader has to re-find.
       *
       * One radio per language rather than one toggle, for the reason Colophon
       * spells out and which does not change with width: a single "switch to
       * English" button is unreadable to exactly the half of its audience that
       * cannot read the label it is currently wearing. Each option is written in
       * its own script and marked `lang`, so a screen reader changes voice for
       * the option it is offering.
       *
       * The visible text is `abbr` — «ع», "EN" — because the header has room for
       * a glyph and not for «العربية». That is a declared property of a locale
       * rather than a truncation: no rule shortens a language's name for it.
       *
       * The live option keeps its bare text as its accessible name, exactly as
       * before; the aria snapshots record it. Naming it too is a separate
       * question about this one abbreviation, not about the switch.
       */}
      <div className={styles.langRow} role="radiogroup" aria-label={t.langSectionTitle}>
        {LOCALE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            className={styles.lang}
            aria-checked={lang === id}
            aria-label={lang === id ? undefined : t.langSwitchTo(LOCALES[id].name)}
            lang={id}
            onClick={() => setLang(id)}
          >
            {LOCALES[id].abbr}
          </button>
        ))}
      </div>

      {/*
       * The keyboard map, said out loud for the first time.
       *
       * The mobile constraint here is stronger than headroom: a phone has no
       * keyboard, so `appKeyAction`'s whole map is *unreachable*, and a hint for
       * a key that does not exist would be worse than silence. The shortcuts
       * have therefore shipped since Loop 6a with no discovery surface at all.
       *
       * A row, not a dialog. There are three keys; a dialog to list three keys
       * is a dialog written to avoid writing three words — and a new sheet would
       * owe a row in `e2e/contrast.spec.ts`'s SURFACES (PLAN follow-up ⑥), which
       * three words should not have to buy.
       *
       * `aria-hidden`, deliberately. A screen-reader user navigating by keyboard
       * does not need a visual legend read out between the wordmark and the page
       * number, and every control it names is already reachable and labelled.
       * The hint is redundancy for the eye, not a second route to the feature.
       *
       * It is also the one thing in this file with a *second* gate. Everything
       * else here is hidden on a phone for want of room; this is hidden wherever
       * nothing can hover, because a landscape tablet has the room and not the
       * keyboard. The query and the reasoning are in `DesktopChrome.module.css`
       * beside `.keys` (docs/design/desktop.md §8 ③).
       */}
      <div className={styles.keys} aria-hidden="true">
        <span className={styles.keyGroup}>
          {/* `dir="ltr"` on the caps, and it is load-bearing rather than tidy.
              U+2190/U+2192 are Bidi_Mirrored, so inside the RTL chrome both
              arrows would silently flip and the hint would name the wrong keys —
              the same trap `PageSlider` sidesteps by drawing ▸ ◂ instead of ‹ ›.
              Here the glyphs must stay the ones printed on the keyboard, so the
              run is made LTR rather than the characters swapped. */}
          <kbd className={styles.key} dir="ltr">
            ←
          </kbd>
          <kbd className={styles.key} dir="ltr">
            →
          </kbd>
          <span className={styles.keyWhat}>{t.keyPages}</span>
        </span>
        <span className={styles.keyGroup}>
          <kbd className={styles.key} dir="ltr">
            {JUMPER_KEY}
          </kbd>
          <span className={styles.keyWhat}>{t.keyJump}</span>
        </span>
      </div>
    </div>
  );
}
