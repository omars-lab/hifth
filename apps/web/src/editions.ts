/**
 * Edition proper names, per locale — an *override* table, not a translation.
 *
 * `hafs-kfqc` is «حفص» / "Hafs · King Fahd Complex": the name of a printed
 * edition, not a description of one. `@hifth/core` already carries the Arabic
 * names, so the Arabic UI overrides nothing and its table is empty on purpose.
 *
 * That is why this is not in `messages/*.json`. The catalogs enforce that every
 * locale has every key, and they have to — a key present in one locale and
 * absent in another is the failure the whole design exists to prevent. But an
 * override that is *deliberately absent* and a translation that is *missing by
 * accident* must not look alike, and inside a catalog they would. So the
 * partial table lives here, where partial is the declared shape.
 *
 * `Record<Lang, …>` still applies: a new locale must declare its table, even as
 * `{}`, so "this locale overrides nothing" stays a decision somebody made.
 *
 * The `reason` line rides with the name it belongs to rather than moving to the
 * catalog, because splitting one edition's row across two files is how the two
 * halves drift.
 */

import type { Lang } from "./lang";

/** An edition's proper names, when the UI language spells them differently. */
export interface EditionCopy {
  readonly label: string;
  readonly riwayah: string;
  readonly reason?: string;
}

export const EDITION_COPY: Readonly<Record<Lang, Readonly<Record<string, EditionCopy>>>> = {
  ar: {},
  en: {
    "hafs-kfqc": {
      label: "Hafs · King Fahd Complex",
      riwayah: "Riwayat Hafs 'an 'Asim",
    },
    "warsh-libya": {
      label: "Warsh · Libyan Endowments",
      riwayah: "Riwayat Warsh 'an Nafi'",
      reason: "Licensed for non-commercial use only — needs permission first",
    },
    "qalun-libya": {
      label: "Qalun · Libyan Endowments",
      riwayah: "Riwayat Qalun 'an Nafi'",
      reason: "Licensed for non-commercial use only — needs permission first",
    },
    "hafs-indopak": {
      label: "Hafs · Indo-Pak script",
      riwayah: "Riwayat Hafs 'an 'Asim",
      reason: "No licensed page source yet",
    },
  },
};
