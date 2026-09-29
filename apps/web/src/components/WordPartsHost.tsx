import type { AssetManifest } from "@hifth/core";
import { pageUrl } from "../assets";
import type { WordRect } from "./PageStage";
import { WordParts, useWordParts } from "./WordParts";

/**
 * One word opened into its parts (harakah-pick = D): loads the word's box and
 * signs, then mounts the row. The word tool drops a note on the part picked;
 * the mistake tool's second tap says which part the slip was on.
 */
export function WordPartsHost({
  manifest,
  page,
  verseKey,
  word,
  label,
  anchor,
  mode,
  docked,
  chosen,
  onPick,
  onPickMany,
  onPickLetter,
  onClear,
  onClose,
}: {
  manifest: AssetManifest;
  page: number;
  verseKey: string;
  word: number;
  label: string;
  anchor: () => WordRect | null;
  mode: "note" | "mistake";
  /** Open in the verse drawer's place, on the bottom of the window (the word tool). */
  docked?: boolean;
  chosen?: number | null;
  /** The part picked, its name, and where on the page a note on it is pinned. */
  onPick: (mark: number | null, name: string | null, at: { x: number; y: number }) => void;
  /** Several signs picked for one note; it is pinned over the first of them. */
  onPickMany?: (marks: number[], at: { x: number; y: number }) => void;
  /** One letter picked, by its place from the right; the note is pinned over its top. */
  onPickLetter?: (letter: number, at: { x: number; y: number }) => void;
  onClear?: () => void;
  onClose: () => void;
}): JSX.Element | null {
  const data = useWordParts(manifest.edition, page, verseKey, word);
  if (!data) return null;
  const pinOver = (mark: number | null) => {
    const s = mark === null ? null : data.signs.find((x) => x.index === mark);
    return s ? { x: s.r[0] + s.r[2] / 2, y: s.r[1] } : { x: data.box.x + data.box.width / 2, y: data.box.y };
  };
  /** Over the middle of a letter, at the top of the word. */
  const pinOverLetter = (letter: number) => {
    const xs = (data.letters[letter] ?? []).map(([x]) => x);
    const mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : data.box.x + data.box.width / 2;
    return { x: Math.min(Math.max(mid, data.box.x), data.box.x + data.box.width), y: data.box.y };
  };
  const [, , w, h] = (manifest.pages.find((p) => p.page === page)?.viewBox ?? "0 0 345 550")
    .split(/\s+/)
    .map(Number);
  return (
    <WordParts
      label={label}
      data={data}
      pageSrc={pageUrl(manifest.edition, page)}
      pageSize={{ w: w || 345, h: h || 550 }}
      anchor={anchor}
      mode={mode}
      docked={docked}
      chosen={chosen}
      onPick={(mark, name) => onPick(mark, name, pinOver(mark))}
      onPickMany={
        onPickMany && ((marks) => onPickMany(marks, pinOver(Math.min(...marks))))
      }
      onPickLetter={onPickLetter && ((letter) => onPickLetter(letter, pinOverLetter(letter)))}
      onClear={onClear}
      onClose={onClose}
    />
  );
}
