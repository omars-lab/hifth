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

/**
 * Where an element is once it has stopped moving: two reads a beat apart agree.
 *
 * A list opening beside the page used to throw the page into the middle of what
 * the list leaves in one frame; it glides there now (docs/PLAN.md, item 71), so
 * a box read the moment the list has landed can be the page on its way.
 */
export async function stillBoxOf(target: Locator): Promise<Box> {
  let last = "";
  let box: Box | null = null;
  await expect
    .poll(
      async () => {
        box = await target.boundingBox();
        const now = JSON.stringify(box);
        const still = box !== null && now === last;
        last = now;
        return still;
      },
      { message: "element is still moving", intervals: [100, 100, 100, 150, 200, 300] },
    )
    .toBe(true);
  return box!;
}
