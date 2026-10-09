import { test, expect } from "@playwright/test";
import { boxOf } from "./box";

/*
 * The shared box read waits for an element to have a place on screen. The
 * copies it replaced read once and failed on an empty box; under the full
 * run's load that happened one push in many (2026-10-09).
 */
test("a box read waits for an element that gets its place a moment late", async ({ page }) => {
  await page.setContent(
    `<div id="late" style="display:none;width:40px;height:30px">x</div>
     <script>setTimeout(() => { document.getElementById("late").style.display = "block"; }, 300);</script>`,
  );
  const late = page.locator("#late");
  // Read once, as the old copies did, it has no box yet.
  expect(await late.boundingBox()).toBeNull();
  const box = await boxOf(late);
  // A phone's page scale leaves a few millionths of a pixel either way.
  expect(box.width).toBeCloseTo(40, 2);
  expect(box.height).toBeCloseTo(30, 2);
});
