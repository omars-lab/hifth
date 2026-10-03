import { lazy, useState, type ComponentType } from "react";

/*
 * Tools that load the first time one is opened, not with the first page.
 *
 * Start-up on a slow phone is mostly download time (the optimizing-performance
 * skill), and these sheets are opened by few readers and never before the page
 * is up. They share one file (./rarely-used.ts), fetched the first time any of
 * them opens; after that every one of them opens at once. The service worker
 * keeps that file for offline use like every other.
 *
 * While the file is on its way the tool shows nothing (a `<Suspense
 * fallback={null}>` around it): no spinner, nothing that moves the page. The
 * sheets are overlays, so their arrival cannot shift what is under them.
 *
 * e2e/lazy-tools.spec.ts fails if any of these slips back into the start-up
 * script, or if opening one on a slow connection breaks anything.
 */

const tools = () => import("./rarely-used");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy's own bound
function later<T extends ComponentType<any>>(load: () => Promise<T>) {
  return lazy(async () => ({ default: await load() }));
}

export const Colophon = later(() => tools().then((m) => m.Colophon));
export const RevisionMap = later(() => tools().then((m) => m.RevisionMap));
export const BookmarkShelf = later(() => tools().then((m) => m.BookmarkShelf));
export const NoteShelf = later(() => tools().then((m) => m.NoteShelf));
export const EditionPicker = later(() => tools().then((m) => m.EditionPicker));
export const RootLens = later(() => tools().then((m) => m.RootLens));
export const VerseNotes = later(() => tools().then((m) => m.VerseNotes));
export const JumpList = later(() => tools().then((m) => m.JumpList));
export const JumpShelf = later(() => tools().then((m) => m.JumpShelf));
export const NoteBox = later(() => tools().then((m) => m.NoteBox));
export const CropSheet = later(() => tools().then((m) => m.CropSheet));
export const WordPartsHost = later(() => tools().then((m) => m.WordPartsHost));
export const BookmarkDrawer = later(() => tools().then((m) => m.BookmarkDrawer));
export const DiffView = later(() => tools().then((m) => m.DiffView));

/**
 * True from the first time `open` is true, and from then on.
 *
 * A sheet that stays mounted while closed keeps its own state between openings
 * (the revision record remembers its scope). Mounting it only once it has been
 * opened keeps that, and still leaves its file unfetched until it is wanted.
 */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}
