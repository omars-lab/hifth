import { useT } from "../i18n";
import { JUMPER_KEY } from "@hifth/core";
import styles from "./DesktopChrome.module.css";

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
export function DesktopChrome(): JSX.Element {
  const { t, lang, setLang, other } = useT();

  return (
    <div className={styles.extras}>
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
       * Two radios rather than one toggle, for the reason Colophon spells out
       * and which does not change with width: a single "switch to English"
       * button is unreadable to exactly the half of its audience that cannot
       * read the label it is currently wearing. Each option is written in its
       * own script and marked `lang`, so a screen reader changes voice for the
       * option it is offering.
       */}
      <div className={styles.langRow} role="radiogroup" aria-label={t.langSectionTitle}>
        <button
          type="button"
          role="radio"
          className={styles.lang}
          aria-checked={lang === "ar"}
          aria-label={lang === "ar" ? undefined : t.langSwitchTo(other.langName)}
          lang="ar"
          onClick={() => setLang("ar")}
        >
          ع
        </button>
        <button
          type="button"
          role="radio"
          className={styles.lang}
          aria-checked={lang === "en"}
          aria-label={lang === "en" ? undefined : t.langSwitchTo(other.langName)}
          lang="en"
          onClick={() => setLang("en")}
        >
          EN
        </button>
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
