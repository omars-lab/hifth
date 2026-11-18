import { useEffect, useId, useRef, useState } from "react";
import { ayahLabelAt, digits } from "../format";
import { useT } from "../i18n";
import { type SharePanel, type ShareShape } from "../share-links";
import { savedShareLook, shortAddress } from "../share-look";
import { SHARE_SHAPE, useShare, type Share, type ShareSheetProps } from "./ShareSheet";
import styles from "./ShareSheet.module.css";

/*
 * What the share sheet holds, loaded the first time a sheet opens (item ㉔).
 *
 * The Share button is in every verse's drawer, so it loads with the first page
 * (./ShareSheet.tsx). What the button opens (the choices and the two links) is
 * only wanted once someone shares, so it lives in the rarely-used file, reached
 * through ./later.tsx. e2e/lazy-tools.spec.ts fails if it slips back.
 */

/** A sign for each thing a link can open, drawn on the tiles. */
const SIGN: Record<SharePanel, string> = { "": "¶", lookalikes: "≈", roots: "√", commentary: "❝" };

/**
 * What the sheet holds below its title: what the link should open, the two
 * links, and what happened. The same in the card and in the drawer, drawn in
 * the look chosen in the info panel (share-look.ts), read each time it opens.
 * Every look has the same choices and buttons under the same names.
 *
 * `focusFirst`: the card puts the focus on its first control when it opens.
 * The first time, this part is still on its way and the focus lands on the
 * card's close button; once it arrives it takes the focus, as it would have.
 */
export function ShareBody({
  share,
  shape,
  pitch,
  focusFirst = false,
}: {
  share: Share;
  shape: ShareShape;
  pitch: boolean;
  focusFirst?: boolean;
}): JSX.Element | null {
  const { t, lang } = useT();
  const legendId = useId();
  const [look] = useState(savedShareLook);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { state, links, panel, setPanel, isRange, feedback, shareSite, shareApp } = share;
  useEffect(() => {
    const body = bodyRef.current;
    if (!focusFirst || !body) return;
    const card = body.closest('[role="dialog"]');
    // Only while the focus is still on the card's own head: never take it from
    // somewhere the reader has since moved it.
    if (card && card.contains(document.activeElement) && !body.contains(document.activeElement)) {
      body.querySelector<HTMLElement>("input, button")?.focus();
    }
  }, [focusFirst]);
  if (!links) return null;
  const panels: { id: SharePanel; label: string }[] = [
    { id: "", label: t.shareAsIs },
    { id: "lookalikes", label: t.shareLookalikes },
    { id: "roots", label: t.shareRoots },
    ...(pitch ? [{ id: "commentary" as const, label: t.shareCommentary }] : []),
  ];
  const sel = state?.select;
  const title = !sel
    ? t.shareTitle
    : "toAyah" in sel && sel.toAyah !== sel.ayah
      ? `${ayahLabelAt(sel.surah, sel.ayah, lang)}–${digits(sel.toAyah, lang)}`
      : ayahLabelAt(sel.surah, sel.ayah, lang);
  const opens = panels.find((p) => p.id === panel) ?? panels[0]!;
  const tiles = look === "tiles";
  return (
    <div ref={bodyRef} className={styles.body} data-share-look={look}>
      {look === "preview" && (
        <div className={styles.preview} data-share-preview="">
          <span className={styles.previewSite}>{t.shareTitle}</span>
          <span className={styles.previewTitle}>{title}</span>
          {shape === "c" && !isRange && (
            <span className={styles.previewOpens}>
              <span aria-hidden="true">{SIGN[opens.id]}</span> {opens.label}
            </span>
          )}
          <span className={styles.previewUrl}>
            <bdi dir="ltr">{shortAddress(links.site)}</bdi>
          </span>
        </div>
      )}
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
              {tiles && (
                <span className={styles.sign} aria-hidden="true">
                  {SIGN[p.id]}
                </span>
              )}
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      )}
      <div className={styles.links}>
        <button
          type="button"
          className={styles.link}
          data-main=""
          onClick={() => void shareSite(links.site)}
          aria-label={t.shareSiteAria}
        >
          <span className={styles.glyph} aria-hidden="true">
            ⇪
          </span>
          <span className={styles.linkText}>
            <span>{t.shareSite}</span>
            {tiles && <span className={styles.hint}>{t.shareSiteHint}</span>}
          </span>
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
          <span className={styles.linkText}>
            <span>{t.shareApp}</span>
            {tiles && <span className={styles.hint}>{t.shareAppHint}</span>}
          </span>
        </button>
      </div>
      <span className={styles.feedback} role="status" data-kind={feedback?.kind}>
        {feedback?.text}
      </span>
    </div>
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
  shape = SHARE_SHAPE,
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
