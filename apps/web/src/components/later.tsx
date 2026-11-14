import { Component, lazy, Suspense, useState, type ComponentType, type ReactNode } from "react";

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
const wide = () => import("./wide-screen");

// A screen bigger than a phone both ways (so not a phone on its side) fetches
// the wide-screen file once the page is up, without being asked. An iPad held
// upright draws no page-edge strips, so
// otherwise the first squeeze of the Pencil would wait for the file before its
// ring of pens showed. A phone never fetches it (e2e/wide-screen-later.spec.ts).
if (typeof window !== "undefined" && window.matchMedia?.("(min-width: 600px) and (min-height: 600px)").matches) {
  const fetchIt = () => void wide().catch(() => undefined);
  const whenIdle = () =>
    "requestIdleCallback" in window ? requestIdleCallback(fetchIt, { timeout: 2000 }) : setTimeout(fetchIt, 1000);
  if (document.readyState === "complete") whenIdle();
  else addEventListener("load", whenIdle, { once: true });
}

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
export const SharedWords = later(() => tools().then((m) => m.SharedWords));
export const HighlightMenu = later(() => tools().then((m) => m.HighlightMenu));
export const MovedCard = later(() => tools().then((m) => m.MovedCard));

/* Only on a computer-sized screen, or by an iPad's Pencil: a phone never fetches ./wide-screen.ts. */
export const PenHomeAt = later(() => wide().then((m) => m.PenHomeAt));
export const EdgeGrabRails = later(() => wide().then((m) => m.EdgeGrabRails));
export const PenHomeBottom = later(() => wide().then((m) => m.PenHomeBottom));
export const PenHomeFloat = later(() => wide().then((m) => m.PenHomeFloat));
export const PenHomeSide = later(() => wide().then((m) => m.PenHomeSide));

/**
 * Where a later-loaded part goes: nothing while its file is on the way, and
 * nothing if the file never comes.
 *
 * A file can fail to come: the reader is offline before the service worker has
 * it, or a publish renamed it while an old copy of the app was open. Without
 * this, the failed load would throw past every part of the app and leave a
 * blank screen; with it, only the one tool is missing, and the page still reads
 * and turns (e2e/lazy-tools.spec.ts aborts the request to check).
 */
export function Later({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Missing>
      <Suspense fallback={null}>{children}</Suspense>
    </Missing>
  );
}

class Missing extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

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
