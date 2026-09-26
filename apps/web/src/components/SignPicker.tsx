import { useEffect, useRef, useState } from "react";
import { HARAKAH_PICK_DEFAULT, isMarkShard, type PickSign } from "@hifth/core";
import { loadMarkShard } from "../assets";
import { useT } from "../i18n";
import styles from "./SignPicker.module.css";

/**
 * What every sign picker is given, whichever option of the open "harakah pick"
 * decision it is (docs/decisions/harakah-pick.md). The mistake tool mounts one
 * behind this interface, so the option the owner chooses replaces it without
 * the tool changing.
 */
export interface SignPickerProps {
  /** The verse, as the reader reads it ("Al-Baqarah 38"). */
  label: string;
  /** Every sign on the verse, numbered as the sign data ships them. */
  signs: readonly PickSign[];
  /** The marked word. */
  word: number;
  /** The sign the mistake is on now; null for the whole word. */
  chosen: number | null;
  /** The page's drawing, and its size in its own units, for the enlarged crops. */
  pageSrc: string;
  pageSize: { w: number; h: number };
  /** The marked mistake, so the picker can stand beside its word. */
  mistakeId: string;
  onPick: (mark: number | null) => void;
  onClear: () => void;
  onClose: () => void;
}

/** A verse's signs from the page's sign data, as the pickers take them. */
export function useVerseSigns(edition: string, page: number, key: string): readonly PickSign[] | null {
  const [signs, setSigns] = useState<readonly PickSign[] | null>(null);
  useEffect(() => {
    let live = true;
    setSigns(null);
    const bare = key.slice(key.lastIndexOf("/") + 1).split("#")[0]!;
    void loadMarkShard(edition, page).then((shard) => {
      if (!live) return;
      const list = shard && isMarkShard(shard) ? (shard.marks[bare] ?? []) : [];
      setSigns(list.map((m, id) => ({ id, w: m.w, name: m.n, x: m.r[0], y: m.r[1], mw: m.r[2], mh: m.r[3] })));
    });
    return () => {
      live = false;
    };
  }, [edition, page, key]);
  return signs;
}

/** Room kept between the picker and the window's edge, and below the word. */
const MARGIN = 12;
/** One tile's side in pixels, and how much of the page (in its own units) it shows. */
const TILE_PX = 64;
const TILE_UNITS = 16;

/**
 * Option A — word, then sign: the marked word's signs as a tray of enlarged
 * crops of the print, each named underneath, in reading order. The list comes
 * from the decision's shared rules (`HARAKAH_PICK_DEFAULT.choices`), so the
 * app and the decision page offer the same buttons.
 */
export function SignPickerA({
  label,
  signs,
  word,
  chosen,
  pageSrc,
  pageSize,
  mistakeId,
  onPick,
  onClear,
  onClose,
}: SignPickerProps): JSX.Element {
  const { t } = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const choices = HARAKAH_PICK_DEFAULT.choices(signs, word);

  // Stand below the marked word, or above it when there is no room; measured a
  // frame late so the wash is drawn, as the note box does for its pin.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const box = boxRef.current;
      if (!box) return;
      const wash = [...document.querySelectorAll(`[data-mistake-word="${CSS.escape(mistakeId)}"]`)]
        .map((el) => el.getBoundingClientRect())
        .find((r) => r.width > 0);
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      const cx = wash ? wash.left + wash.width / 2 : window.innerWidth / 2;
      const below = wash ? wash.bottom + MARGIN : window.innerHeight / 2 - h / 2;
      const top =
        !wash || below + h + MARGIN <= window.innerHeight ? below : Math.max(MARGIN, wash.top - h - MARGIN);
      const left = Math.min(Math.max(MARGIN, cx - w / 2), window.innerWidth - w - MARGIN);
      setAt({ left, top });
    });
    return () => cancelAnimationFrame(frame);
  }, [mistakeId, choices.length]);

  // Focus the first button once, when the picker has found its place.
  const placed = at !== null;
  useEffect(() => {
    if (placed) boxRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [placed]);

  // A press anywhere else closes it, as the note box does.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onCloseRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  const scale = TILE_PX / TILE_UNITS;
  return (
    <div
      ref={boxRef}
      className={styles.box}
      role="dialog"
      aria-label={t.mistakePicker(label)}
      data-sign-picker=""
      style={at ? { left: at.left, top: at.top } : { visibility: "hidden" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className={styles.head}>{t.mistakePicker(label)}</div>
      {choices.length === 0 ? (
        <p className={styles.none}>{t.mistakeNoSigns}</p>
      ) : (
        <div className={styles.tray}>
          {choices.map((c) => {
            const s = signs[c.id]!;
            const cx = s.x + s.mw / 2;
            const cy = s.y + s.mh / 2;
            const left = (cx - TILE_UNITS / 2) * scale;
            const top = (cy - TILE_UNITS / 2) * scale;
            return (
              <button
                key={c.id}
                type="button"
                className={styles.sign}
                aria-pressed={chosen === c.id}
                data-sign={c.id}
                onClick={() => onPick(c.id)}
              >
                <span className={styles.crop} aria-hidden="true">
                  <img
                    src={pageSrc}
                    alt=""
                    draggable={false}
                    style={{ width: pageSize.w * scale, height: pageSize.h * scale, left: -left, top: -top }}
                  />
                  <span
                    className={styles.ring}
                    style={{
                      left: (s.x - 0.8) * scale - left,
                      top: (s.y - 0.8) * scale - top,
                      width: (s.mw + 1.6) * scale,
                      height: (s.mh + 1.6) * scale,
                    }}
                  />
                </span>
                <span className={styles.name}>{c.label}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.clear} onClick={onClear}>
          {t.mistakeClear}
        </button>
        <button
          type="button"
          className={styles.whole}
          aria-pressed={chosen === null}
          onClick={() => onPick(null)}
        >
          {t.mistakeWholeWord}
        </button>
      </div>
    </div>
  );
}

/**
 * The picker the mistake tool mounts: the open decision's default, A. B and C
 * are live on the decision page; whichever the owner chooses takes this place.
 */
export const SignPicker = SignPickerA;
