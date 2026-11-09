import type { BrowserContext, Page } from "@playwright/test";
import { MARK_TOOLS_KEY } from "../src/mark-tools";

/**
 * Ask for Note, Harakat and Word as three buttons, for a test about one of
 * those tools on its own (docs/design/notes-style-toolbar.md, ②).
 *
 * The owner made the one button the default on 2026-11-08; the specs that tap
 * Harakat or Word by name, or count the bar's buttons, were written for three
 * and test that layout, which stays a setting. The one-button default has its
 * own tests in mark-tools.spec.ts.
 *
 * Only when nothing is saved yet, so a test that picks the setting itself, or
 * reloads after picking it, keeps its own choice.
 */
export async function threeButtons(target: Page | BrowserContext): Promise<void> {
  await target.addInitScript((key) => {
    try {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, "three");
    } catch {
      /* private mode: the app falls back to its default */
    }
  }, MARK_TOOLS_KEY);
}
