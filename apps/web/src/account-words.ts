/*
 * The account section's words (sign-in ⑳, docs/design/sign-in.md).
 *
 * Only the store apps show the account section, and only once a reader opens
 * the info panel, so its words are not packed with the words every reader
 * downloads when the app opens (i18n.tsx). They are a pack of their own,
 * `messages/account/*.json`, compiled like the start-up words and fetched the
 * first time the section is drawn. The service worker precaches them, so the
 * section still has its words offline.
 */
import { useEffect, useState } from "react";
import { longDay } from "./format";
import { localDay, useT } from "./i18n";
import type { Lang } from "./lang";
import type { Catalog } from "./messages/account/catalog.gen";
import { CATALOG_LOADERS } from "./messages/account/catalogs.gen";

/** What the account section reads: the pack, with its one dated line bound to the reader's calendar. */
export type AccountWords = Omit<Catalog, "accountCopyKept"> & {
  /** The day hifth.app last kept the copy of the reader's marks. */
  readonly accountCopyKept: (at: number) => string;
};

export function buildAccountWords(lang: Lang, m: Catalog): AccountWords {
  return {
    ...m,
    accountCopyKept: (at) => m.accountCopyKept({ dayText: longDay(localDay(at), lang) }),
  };
}

const READY: Partial<Record<Lang, AccountWords>> = {};
const PENDING: Partial<Record<Lang, Promise<AccountWords>>> = {};

/** Fetch (once) and build a language's account words. */
export function loadAccountWords(lang: Lang): Promise<AccountWords> {
  const ready = READY[lang];
  if (ready) return Promise.resolve(ready);
  return (PENDING[lang] ??= CATALOG_LOADERS[lang]()
    .then(({ default: catalog }) => (READY[lang] = buildAccountWords(lang, catalog)))
    .finally(() => delete PENDING[lang]));
}

/** A loaded language's account words. Throws for one never loaded, as `stringsFor` does. */
export function accountWordsFor(lang: Lang): AccountWords {
  const words = READY[lang];
  if (!words) throw new Error(`account words: "${lang}" read before loadAccountWords("${lang}") finished`);
  return words;
}

/**
 * The account words in the reader's language, or null while they are still
 * on their way. A language already fetched comes back at once, so switching
 * back and forth never blanks the section. A failed fetch leaves it null;
 * the section stays hidden rather than showing words in the other language.
 *
 * `wanted` is false until the section knows it will draw something: in a
 * browser, where sign-in is never offered, the words are never fetched.
 */
export function useAccountWords(wanted: boolean): AccountWords | null {
  const { lang } = useT();
  const [, loaded] = useState(0);
  useEffect(() => {
    if (!wanted || READY[lang]) return;
    let live = true;
    loadAccountWords(lang).then(
      () => live && loaded((n) => n + 1),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [lang, wanted]);
  return READY[lang] ?? null;
}
