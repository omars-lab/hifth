import { useT, type Strings } from "../i18n";
import type { AudioPhase } from "../audio";
import styles from "./PlayTrigger.module.css";

/**
 * PlayTrigger — the ▶ in the trail bar that recites the selected verse.
 *
 * It renders nothing until a single ayah is selected (a word or a range has no
 * one file to play). The glyph mirrors the audio's real phase: ▶ to start, ⏸
 * while it sounds, a turning ↻ while the CDN opens the file, and it dims to a
 * warning if the file will not load. The label toggles with the phase so a
 * screen reader hears "Play …" become "Pause …". Audio itself is streamed, not
 * held — see `audio.ts`.
 */
/**
 * The word under the listen glyph. Once a recitation will not load it says
 * why, on the button the reader just pressed: the files are streamed, so with
 * no connection (a meeting room without wifi) nothing can sound, and a caption
 * that still read "Listen" looked as if the tap had been missed.
 */
export function listenCaption(phase: AudioPhase, t: Strings): string {
  if (phase === "playing") return t.vdPause;
  if (phase === "error")
    return typeof navigator !== "undefined" && navigator.onLine === false
      ? t.vdListenOffline
      : t.vdListenFailed;
  return t.vdListen;
}

export function PlayTrigger({
  selectedKey,
  label,
  phase,
  onToggle,
  caption,
}: {
  /** The selected ayah key, or null (nothing selected, or a word/range). */
  selectedKey: string | null;
  /** The ayah's own label, for the control's accessible name. */
  label: string | null;
  /** What the audio for this verse is doing right now. */
  phase: AudioPhase;
  /** Start or pause this verse. */
  onToggle: (key: string) => void;
  /** A word under the glyph, shown when the button sits in the verse drawer. */
  caption?: string;
}): JSX.Element | null {
  const { t } = useT();
  if (!selectedKey || !label) return null;

  const playing = phase === "playing";
  const loading = phase === "loading";
  const glyph = playing ? "⏸\uFE0E" : loading ? "↻" : "▶\uFE0E";

  return (
    <button
      type="button"
      className={styles.trigger}
      data-phase={phase}
      aria-label={playing ? t.pauseAyah(label) : t.playAyah(label)}
      aria-pressed={playing}
      aria-busy={loading || undefined}
      onClick={() => onToggle(selectedKey)}
    >
      <span aria-hidden="true" className={loading ? styles.spinning : undefined}>
        {glyph}
      </span>
      {caption && <span data-caption="">{caption}</span>}
    </button>
  );
}
