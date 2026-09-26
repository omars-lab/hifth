import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import styles from "./CropSheet.module.css";

/** A box on one page, in the page's own units. */
export interface CropBox {
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface CropSheetProps {
  box: CropBox;
  /** The page's drawing, and its size in its own units. */
  pageSrc: string;
  pageSize: { w: number; h: number };
  onClose: () => void;
}

/** Page units of paper kept round the box, and the widest the image is drawn, in pixels. */
const PAD = 3;
const MAX_PX = 1600;
/** The strip under the print that says where it came from, as a share of the image's width. */
const CAPTION_SHARE = 0.05;

/**
 * The crop tool's result (step 4 of docs/design/page-toolbar-plan.md): the box
 * the reader dragged, cut from the page's own drawing onto paper, with a line
 * under it naming the page and the print. Share hands the image to the phone's
 * share sheet where there is one; Save downloads it. Nothing leaves the device
 * unless the reader does one of those.
 *
 * The print's publisher allows free digital use, including sharing; only
 * printing copies for sale is reserved (SOURCES.md, hafs-kfqc). So a reader's
 * cut-out is theirs to send, and the caption says whose print it is.
 */
export function CropSheet({ box, pageSrc, pageSize, onClose }: CropSheetProps): JSX.Element {
  const { t } = useT();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const caption = t.cropCaption(box.page);
  const name = `hifth-page-${box.page}.png`;

  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      // The box, padded and kept on the page.
      const x0 = Math.max(0, box.x - PAD);
      const y0 = Math.max(0, box.y - PAD);
      const x1 = Math.min(pageSize.w, box.x + box.width + PAD);
      const y1 = Math.min(pageSize.h, box.y + box.height + PAD);
      const scale = Math.min(MAX_PX / (x1 - x0), 8);
      const w = Math.round((x1 - x0) * scale);
      const h = Math.round((y1 - y0) * scale);
      const strip = Math.max(44, Math.round(w * CAPTION_SHARE));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h + strip;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const css = getComputedStyle(document.documentElement);
      ctx.fillStyle = css.getPropertyValue("--paper").trim() || "#f4efe6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // The print is held to the box: the rest of the page must not run on
      // into the caption's strip.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      ctx.drawImage(img, -x0 * scale, -y0 * scale, pageSize.w * scale, pageSize.h * scale);
      ctx.restore();
      ctx.fillStyle = css.getPropertyValue("--ink-soft").trim() || "#5c5347";
      ctx.font = `${Math.round(strip * 0.45)}px ${getComputedStyle(document.body).fontFamily || "sans-serif"}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(caption, w / 2, h + strip / 2);
      canvas.toBlob((b) => {
        if (!live || !b) return;
        setBlob(b);
        setUrl(URL.createObjectURL(b));
      }, "image/png");
    };
    img.src = pageSrc;
    return () => {
      live = false;
    };
  }, [box, pageSrc, pageSize, caption]);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  useEffect(() => {
    boxRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [url]);

  const file = blob ? new File([blob], name, { type: "image/png" }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const canShare = file !== null && typeof nav.share === "function" && nav.canShare?.({ files: [file] }) === true;

  const share = async () => {
    if (!file) return;
    try {
      await nav.share({ files: [file], title: caption });
      setSaid(t.cropShared);
    } catch {
      // Cancelled, or refused: the Save button is still there.
    }
  };

  return (
    <div className={styles.scrim} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={boxRef}
        className={styles.sheet}
        role="dialog"
        aria-label={t.cropTitle(box.page)}
        data-crop-sheet
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <div className={styles.head}>{t.cropTitle(box.page)}</div>
        <div className={styles.frame}>{url && <img src={url} alt={caption} className={styles.image} />}</div>
        <div className={styles.actions}>
          {canShare && (
            <button type="button" className={styles.primary} onClick={() => void share()}>
              {t.cropShare}
            </button>
          )}
          {url && (
            <a className={canShare ? styles.secondary : styles.primary} href={url} download={name} data-crop-save>
              {t.cropSave}
            </a>
          )}
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t.cropClose}
          </button>
          {said && (
            <span className={styles.said} role="status">
              {said}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
