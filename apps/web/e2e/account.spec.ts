import { expect, test, type Page } from "@playwright/test";

/*
 * Sign-in step 16, in the built page. The account section asks the app what it
 * holds, so a plain browser shows no section at all, and inside the app the
 * reader sees what leaves the device before Apple's button, can sign in, sign
 * out, and delete the account after saying yes once more.
 *
 * The app is a stand-in written into the page before it loads: it answers the
 * page's questions the way the real one does (native/Hifth/Web/ShellModel.swift),
 * from a small state of its own. No real account or code is used.
 */

const TITLE = "الحساب";
const SIGN_IN = "تسجيل الدخول باستخدام Apple";

async function openPanel(page: Page) {
  await page.goto("/");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
  await page.getByRole("button", { name: /عن حِفظ/ }).click();
  const sheet = page.getByRole("dialog", { name: "عن حِفظ" });
  await expect(sheet).toBeVisible();
  // The report section is drawn whatever the app says: once it is there, the
  // account section has had its chance to be drawn above it.
  await expect(sheet.locator("#colophon-report")).toBeAttached();
  return sheet;
}

function standInApp(page: Page, start: "off" | "signed-out" | "signed-in") {
  return page.addInitScript((first) => {
    let state = first;
    const asked: string[] = [];
    const reply = (id: string, answer: unknown) =>
      setTimeout(() => (window as unknown as { __HIFTH_ANSWER__?: (i: string, a: unknown) => void }).__HIFTH_ANSWER__?.(id, answer), 30);
    const answers: Record<string, () => unknown> = {
      account: () => ({ ok: true, value: state }),
      "invite-kept": () => ({ ok: true, value: "no" }),
      "sign-in": () => ((state = "signed-in"), { ok: true, value: "signed-in" }),
      "sign-out": () => ((state = "signed-out"), { ok: true, value: "signed-out" }),
      "delete-account": () => ((state = "signed-out"), { ok: true, value: "deleted-cut" }),
    };
    Object.assign(window, {
      __HIFTH_NATIVE__: Object.freeze({ platform: "ios", publicBase: "https://example.test/hifth/" }),
      __standInAsked: asked,
      webkit: {
        messageHandlers: {
          hifth: {
            postMessage: (m: { type?: string; id?: string; name?: string }) => {
              if (m.type !== "ask" || !m.id || !m.name) return;
              asked.push(m.name);
              reply(m.id, answers[m.name]?.() ?? { ok: false, error: "unknown-question" });
            },
          },
        },
      },
    });
  }, start);
}

test("a plain browser shows no account section", async ({ page }) => {
  const sheet = await openPanel(page);
  await expect(sheet.getByRole("heading", { name: TITLE })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: SIGN_IN })).toHaveCount(0);
});

test("inside an app with sign-in off, there is no account section either", async ({ page }) => {
  await standInApp(page, "off");
  const sheet = await openPanel(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __standInAsked: string[] }).__standInAsked)).toContain("account");
  await expect(sheet.getByRole("heading", { name: TITLE })).toHaveCount(0);
});

test("signed out: what leaves the device sits above Apple's button, which keeps Apple's shape", async ({ page }) => {
  await standInApp(page, "signed-out");
  const sheet = await openPanel(page);
  const button = sheet.getByRole("button", { name: SIGN_IN });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();

  const says = sheet.getByText("تسجيل الدخول يرسل شيئًا واحدًا إلى hifth.app", { exact: false });
  await expect(says).toBeVisible();
  const [s, b] = await Promise.all([says.boundingBox(), button.boundingBox()]);
  expect(s && b).toBeTruthy();
  expect(s!.y + s!.height).toBeLessThanOrEqual(b!.y);

  // Apple's rules for a button an app draws: black or white, at least 140 by 30.
  expect(b!.width).toBeGreaterThanOrEqual(140);
  expect(b!.height).toBeGreaterThanOrEqual(30);
  const colours = await button.evaluate((el) => {
    const c = getComputedStyle(el);
    return [c.backgroundColor, c.color];
  });
  expect(colours).toEqual(["rgb(0, 0, 0)", "rgb(255, 255, 255)"]);
});

test("sign in, sign out, sign in again and delete the account after saying yes", async ({ page }) => {
  await standInApp(page, "signed-out");
  const sheet = await openPanel(page);

  await sheet.getByRole("button", { name: SIGN_IN }).click();
  await expect(sheet.getByText("أنت مسجّل الدخول في هذا الجهاز.")).toBeVisible();

  await sheet.getByRole("button", { name: "سجّل الخروج من هذا الجهاز" }).click();
  await expect(sheet.getByRole("button", { name: SIGN_IN })).toBeVisible();

  await sheet.getByRole("button", { name: SIGN_IN }).click();
  await sheet.getByRole("button", { name: "احذف حسابي" }).click();
  await expect(sheet.getByText("أتحذف حسابك؟", { exact: false })).toBeVisible();
  const asked = () => page.evaluate(() => (window as unknown as { __standInAsked: string[] }).__standInAsked);
  expect(await asked()).not.toContain("delete-account");

  await sheet.getByRole("button", { name: "نعم، احذفه" }).click();
  await expect(sheet.getByRole("status")).toHaveText("حُذف حسابك، وأزالت Apple حِفظ من حسابك لديها.");
  await expect(sheet.getByRole("button", { name: SIGN_IN })).toBeVisible();
  expect((await asked()).filter((n) => n === "delete-account")).toHaveLength(1);
});
