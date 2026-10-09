import { expect, type Locator } from "@playwright/test";

export type Box = { x: number; y: number; width: number; height: number };

/**
 * Where an element is on screen, once it has a place there.
 *
 * A box read the moment after "it is visible" can still come back empty while
 * the page settles around it: a page arriving beside it, a list whose code
 * loads on first open. It failed one push in many, under the full run's load
 * and never alone (a dot's list on a two-page spread, 2026-10-09). So the read
 * waits for a box rather than failing on the first empty one.
 */
export async function boxOf(target: Locator): Promise<Box> {
  let box: Box | null = null;
  await expect
    .poll(async () => (box = await target.boundingBox()), { message: "element has no box" })
    .not.toBeNull();
  return box!;
}
