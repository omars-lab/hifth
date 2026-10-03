import type { ArrowShowing } from "@hifth/core";

/**
 * Which way the saved arrows show, on trial (docs/design/jump-arrows-options.md):
 * `?jumparrows=asked` for only while you ask, and stays when the address names
 * none. Read here rather than beside the jump record, whose own modules may
 * hold no way off the device, not even a reader of the address.
 */
export function arrowShowingFromUrl(search: string): ArrowShowing {
  return new URLSearchParams(search).get("jumparrows")?.toLowerCase() === "asked" ? "asked" : "stays";
}
