/**
 * How the share menu looks (the owner, 2026-11-12, on the front page: the
 * share menu is too plain). The same choices and the same two links in every
 * look, so what a link opens never depends on it; only how they are drawn.
 *
 *   preview  a card shaped like what arrives in a message: the verse's name,
 *            what it opens with and the address, then the choices as one row
 *            and the website link as the main button (the default until a pick);
 *   tiles    the choices and the two links as tiles, each with a sign and a
 *            line saying where the link opens;
 *   plain    the menu as it was: rounded buttons in rows.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key.
 */

export type ShareLook = "preview" | "tiles" | "plain";

/** In settings order. */
export const SHARE_LOOKS: readonly ShareLook[] = ["preview", "tiles", "plain"];

/** Versioned: a choice that later changes what it does gets a new key. */
export const SHARE_LOOK_KEY = "hifth.share.look.v1";

export const DEFAULT_SHARE_LOOK: ShareLook = "preview";

export function savedShareLook(): ShareLook {
  try {
    const v = localStorage.getItem(SHARE_LOOK_KEY);
    return (SHARE_LOOKS as readonly string[]).includes(v ?? "") ? (v as ShareLook) : DEFAULT_SHARE_LOOK;
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember gets the default.
    return DEFAULT_SHARE_LOOK;
  }
}

export function rememberShareLook(choice: ShareLook): void {
  try {
    localStorage.setItem(SHARE_LOOK_KEY, choice);
  } catch {
    /* nothing to do — see savedShareLook */
  }
}

/**
 * The address as a message would show it under a link's title: no scheme, and
 * cut short in the middle of the path when long, so the start (whose site) and
 * the end (which verse) both stay.
 */
export function shortAddress(url: string, max = 44): string {
  const bare = url.replace(/^[a-z]+:\/\//i, "");
  if (bare.length <= max) return bare;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  return `${bare.slice(0, head)}…${bare.slice(bare.length - (keep - head))}`;
}
