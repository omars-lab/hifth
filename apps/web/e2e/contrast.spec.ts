import { test, expect, type Page } from "@playwright/test";
import { FIELDS, type FieldId } from "@hifth/core";
import { tapAyah } from "./ayah";
import { COACH_STORAGE_KEY } from "../src/coach";
import { formatFailures, measureContrast } from "./contrast";

/*
 * Contrast, on every surface — PLAN follow-up ⑥.
 *
 * Two gates already claimed to cover this and both were blind to it. The axe
 * pass in `share-a11y.spec.ts` opens two states — the base view and one hop
 * popover — and Lighthouse audits a single URL in a single state; meanwhile
 * `--ink-faint` sat at 2.67:1 for a whole loop, because the text carrying it
 * lives in the sheets and popovers neither one ever opened. (Why axe still
 * returned green on the surface it *did* open is its own finding — see the
 * header of `./contrast.ts`.)
 *
 * So this spec is the traversal itself: every surface that renders chrome text
 * gets opened and measured, and a surface added later without a row in
 * `SURFACES` is a surface nobody is checking.
 *
 * Scoped to contrast deliberately. Roles, names and focus order are asserted
 * where they belong — in each feature's own spec, where a failure says which
 * control broke. This one answers the single question the others cannot: can
 * the text be read on the paper it sits on.
 */

/** Open the app as a returning reader with storage settled — no first-run chrome. */
async function settled(page: Page): Promise<void> {
  await page.addInitScript((coachKey: string) => {
    try {
      localStorage.setItem(coachKey, "1");
    } catch {
      /* private mode — the strip stays hidden anyway */
    }
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
      },
    });
  }, COACH_STORAGE_KEY);
}

/** Select 2:48 (verse-55 on page 7) and wait for its rail. */
async function selectAyah(page: Page): Promise<void> {
  await tapAyah(page, "#verse-55");
  await expect(page.getByRole("group", { name: "روابط الآية" })).toBeVisible();
}

interface Surface {
  readonly name: string;
  readonly open: (page: Page) => Promise<void>;
}

/**
 * Put the stage's hint on screen, on a named field.
 *
 * The field is the largest surface in the app and, until this row existed, the
 * only one with no text on it — which made it the one surface a colour could be
 * chosen for by taste. It has exactly one piece of text: `.hint`, shown while a
 * page loads and when one fails. Aborting the page assets is how a test reaches
 * the second state deliberately, and it is also the honest state to measure —
 * the hint that says «تعذّر تحميل صفحة ٧» is the message a reader most needs to
 * be able to read, and the one they see when everything else has gone wrong.
 *
 * `contrast.ts` measures a gradient against *every* one of its stops, so a pass
 * here is a claim about the whole wash and not about the middle of it.
 */
function onField(field: FieldId): Surface["open"] {
  return async (page) => {
    await settled(page);
    await page.route("**/assets/pages/**", (route) => route.abort());
    await page.goto(`/#/hafs-kfqc/p7?field=${field}`);
    await expect(page.getByRole("alert").first()).toBeVisible();
  };
}

const SURFACES: readonly Surface[] = [
  {
    name: "the base view — header, rail, footer",
    open: async (page) => {
      await settled(page);
      await page.goto("/");
      await selectAyah(page);
    },
  },
  {
    name: "the hop popover, with a row's diff expanded",
    open: async (page) => {
      await settled(page);
      await page.goto("/");
      await selectAyah(page);
      await page
        .getByRole("group", { name: "روابط الآية" })
        .getByRole("button", { name: /متشابهات في السورة/ })
        .tap();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      // Expanding the row is the point: the diff's own labels ("here" /
      // "there", the context ellipsis) are the faintest text in the app.
      await sheet.getByRole("button", { name: /البقرة · ٢:١٢٣ شفاعة/ }).tap();
      await expect(sheet.getByText(/عَدْلٌ/).first()).toBeVisible();
    },
  },
  {
    name: "the range menu — merged hops, each naming its source",
    open: async (page) => {
      await settled(page);
      await page.goto("/#/hafs-kfqc/2:47-2:48");
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    name: "the root lens",
    open: async (page) => {
      await settled(page);
      await page.goto("/");
      await selectAyah(page);
      await page.getByRole("button", { name: /الجذور · / }).tap();
      await expect(page.getByRole("dialog", { name: /الجذور/ })).toBeVisible();
    },
  },
  {
    name: "the jumper, showing the juz list",
    open: async (page) => {
      await settled(page);
      await page.goto("/");
      await expect(page.locator("svg[role='group']").first()).toBeVisible();
      await page.keyboard.press("/");
      await expect(page.getByRole("dialog", { name: "اذهب إلى" })).toBeVisible();
    },
  },
  {
    name: "the mushaf picker, with its disabled rows and their reasons",
    open: async (page) => {
      await settled(page);
      await page.goto("/");
      await expect(page.locator("svg[role='group']").first()).toBeVisible();
      // `exact`: the page chip's name ends «… من المصحف», and a role name match
      // is a substring match unless told otherwise.
      await page.getByRole("button", { name: "المصحف", exact: true }).tap();
      await expect(page.getByRole("dialog", { name: "المصحف", exact: true })).toBeVisible();
    },
  },
  {
    name: "the colophon — the licence offer and five credits",
    open: async (page) => {
      await settled(page);
      await page.goto("/");
      await expect(page.locator("svg[role='group']").first()).toBeVisible();
      await page.getByRole("button", { name: /عن حِفظ/ }).tap();
      await expect(page.getByRole("dialog", { name: "عن حِفظ" })).toBeVisible();
    },
  },
  {
    name: "the tajweed legend, naming every rule family",
    open: async (page) => {
      await settled(page);
      await page.goto("/#/hafs-kfqc/2:38");
      await page.getByLabel("مفتاح ألوان التجويد").click();
      await expect(page.getByRole("dialog", { name: "مفتاح ألوان التجويد" })).toBeVisible();
    },
  },
  {
    name: "a restored trail — three beads and the current ayah",
    open: async (page) => {
      await settled(page);
      await page.goto("/#/hafs-kfqc/2:123?trail=2:40,2:47&via=2:48");
      await expect(page.getByRole("button", { name: /ارجع إلى البقرة · ٢:٤٨/ })).toBeVisible();
    },
  },
  {
    name: "first run — the coach strip",
    open: async (page) => {
      // Deliberately NOT `settled`: this is the one visit where the teaching
      // strip is on screen, and it is the first text a reader ever sees here.
      await page.goto("/");
      await expect(page.getByRole("region", { name: "كيف تتنقّل" })).toBeVisible();
    },
  },
  {
    name: "the storage notice, in its wordiest state",
    open: async (page) => {
      // A capped quota: the longest copy the notice can render, naming two
      // causes. The coach strip is seeded away so the notice is not held.
      await page.addInitScript((coachKey: string) => {
        try {
          localStorage.setItem(coachKey, "1");
        } catch {
          /* private mode */
        }
        Object.defineProperty(navigator, "storage", {
          configurable: true,
          value: {
            persist: async () => false,
            persisted: async () => false,
            estimate: async () => ({ usage: 1_000_000, quota: 100 * 1024 * 1024 }),
          },
        });
      }, COACH_STORAGE_KEY);
      await page.goto("/");
      await expect(page.locator("[data-notice]")).toBeVisible();
    },
  },
  {
    // The one row that has to change the viewport. Both projects that run this
    // file are phones, and the desktop spread is unreachable from a phone by
    // construction — so without the resize the surface it introduces would be
    // exactly the kind of unmeasured text this spec exists to prevent, and the
    // row would sit here looking like coverage.
    //
    // The absent facing leaf is `--ink-soft` and `--ink-faint` on `--paper-sunk`,
    // which is a pairing nothing else in the app makes: every other use of
    // `--paper-sunk` is a control, not running text. `--ink-faint` is also the
    // token that sat at 2.67:1 for a whole loop, and this is a new place to put
    // it — see this file's header.
    name: "the desktop spread — the hole where an un-vendored page would be",
    open: async (page) => {
      await settled(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/#/hafs-kfqc/p7");
      await expect(page.getByTestId("page-spread")).toBeVisible();
      await expect(page.getByRole("region", { name: "الصفحة المقابلة" })).toBeVisible();
    },
  },
  // One row per field, generated from `FIELDS` so a third option cannot ship
  // without a measurement: the list in core is the source of truth for this
  // file, for `styles/field.css` and for the table in docs/query-params.md.
  // There were five while the desk was an open question — `tan` won it and
  // `dark` stayed as a night desk (page-transition.md §7 ④).
  ...FIELDS.map((field) => ({
    name: `the field «${field}» — the desk, and the one sentence written on it`,
    open: onField(field),
  })),
  {
    // The same question asked of the *other* painter. On a phone the stage
    // paints the field; on a spread `PageSpread` paints it once across the desk
    // and tells the stages inside to stop. Two declarations reading one token is
    // only true until someone edits one of them, so `tan` — the default, and the
    // field whose ink had to change — is checked on both.
    name: "the field «tan» on the desktop spread, painted by the desk not the stage",
    open: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await onField("tan")(page);
    },
  },
];

test.describe("Hifth · contrast on every surface", () => {
  for (const surface of SURFACES) {
    test(`${surface.name} clears its WCAG floor`, async ({ page }) => {
      await surface.open(page);

      const report = await measureContrast(page);

      // A traversal that opens a surface and measures nothing there has failed
      // to open it — the assertion below would pass on a blank page otherwise,
      // which is the exact failure mode this whole spec exists to answer.
      expect(report.measured, `${surface.name}: nothing measured`).toBeGreaterThan(3);
      expect(report.failures, formatFailures(report)).toEqual([]);
    });
  }
});
