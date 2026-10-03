/*
 * The tools that load the first time one of them is opened, all in one file.
 *
 * Only `./later.tsx` may import this module, and only with `import()`: a plain
 * import anywhere would pull every tool below back into the start-up script.
 * One file rather than one per tool because each small file compresses worse
 * on its own (eleven files weighed 6.6 KB more in all than one, 2026-09-29), and
 * the service worker downloads every file after the first visit anyway.
 */
export { Colophon } from "./Colophon";
export { RevisionMap } from "./RevisionMap";
export { BookmarkShelf } from "./BookmarkShelf";
export { NoteShelf } from "./NoteShelf";
export { EditionPicker } from "./EditionPicker";
export { RootLens } from "./RootLens";
export { NoteBox } from "./NoteBox";
export { VerseNotes } from "./VerseNotes";
export { CropSheet } from "./CropSheet";
export { WordPartsHost } from "./WordPartsHost";
export { BookmarkDrawer } from "./BookmarkDrawer";
export { DiffView } from "./DiffView";
