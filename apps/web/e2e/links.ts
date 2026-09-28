import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Named links into the app, each with what it must show — the one list the
 * tests and the checks guide share. A test that needs the app in some state
 * opens it here instead of clicking its way there; a test *about* the button
 * that opens a panel still clicks the button.
 *
 * Every link the checks guide gives (docs/validation/ledger.json) must be in
 * this list; guide-links.spec.ts refuses one that is not. The link forms
 * themselves are documented, and checked on every commit, in
 * docs/query-params.md.
 */
export const LINKS = {
  "verse-2-48": {
    path: "#/hafs-kfqc/2:48",
    shows: (p: Page) => p.getByRole("region", { name: /البقرة · ٢:٤٨/ }),
  },
  "verse-2-48-lookalikes": {
    path: "#/hafs-kfqc/2:48?open=lookalikes",
    shows: (p: Page) => p.getByRole("dialog", { name: /^متشابهات/ }),
  },
  record: {
    path: "#/hafs-kfqc/p1?open=record",
    shows: (p: Page) => p.getByRole("dialog", { name: "ما فتحتَه من المصحف" }),
  },
  shelf: {
    path: "#/hafs-kfqc/p1?open=shelf",
    // The record at juz scope, the only scope the saved-offline shelf shows at.
    shows: (p: Page) =>
      p.getByRole("dialog", { name: "ما فتحتَه من المصحف" }).getByRole("radio", { name: "جزء", checked: true }),
  },
  tips: {
    path: "#/hafs-kfqc/p1?open=tips",
    shows: (p: Page) => p.getByRole("region", { name: "كيف تتنقّل" }),
  },
} as const satisfies Record<string, { path: string; shows: (p: Page) => Locator }>;

export type LinkName = keyof typeof LINKS;

/** Open the app at a named link and wait until it shows what the link names. */
export async function gotoLink(page: Page, name: LinkName): Promise<Locator> {
  const link = LINKS[name];
  await page.goto(`/${link.path}`);
  const shown = link.shows(page);
  await expect(shown, `${name} (${link.path})`).toBeVisible({ timeout: 20_000 });
  return shown;
}
