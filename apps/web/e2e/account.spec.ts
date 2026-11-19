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

/**
 * `invite`: "none" never asks for a code; "kept" says the device keeps one;
 * "needed" refuses a sign-in until a code is sent with it, then keeps it.
 */
function standInApp(page: Page, start: "off" | "signed-out" | "signed-in", invite: "none" | "kept" | "needed" = "none") {
  return page.addInitScript(([first, code]) => {
    let state = first;
    let kept = code === "kept";
    let text: string | undefined;
    const asked: string[] = [];
    const sent: (string | undefined)[] = [];
    const reply = (id: string, answer: unknown) =>
      setTimeout(() => (window as unknown as { __HIFTH_ANSWER__?: (i: string, a: unknown) => void }).__HIFTH_ANSWER__?.(id, answer), 30);
    const answers: Record<string, () => unknown> = {
      account: () => ({ ok: true, value: state }),
      "invite-kept": () => ({ ok: true, value: kept ? "yes" : "no" }),
      "forget-invite": () => ((kept = false), { ok: true, value: "forgotten" }),
      "sign-in": () => {
        if (code === "needed" && !kept && !text) return { ok: false, error: "invite-needed" };
        if (code === "needed") kept = true;
        state = "signed-in";
        return { ok: true, value: "signed-in" };
      },
      "sign-out": () => ((state = "signed-out"), { ok: true, value: "signed-out" }),
      "delete-account": () => ((state = "signed-out"), { ok: true, value: "deleted-cut" }),
    };
    Object.assign(window, {
      __HIFTH_NATIVE__: Object.freeze({ platform: "ios", publicBase: "https://example.test/hifth/" }),
      __standInAsked: asked,
      __standInSent: sent,
      webkit: {
        messageHandlers: {
          hifth: {
            postMessage: (m: { type?: string; id?: string; name?: string; text?: string }) => {
              if (m.type !== "ask" || !m.id || !m.name) return;
              asked.push(m.name);
              if (m.name === "sign-in") sent.push(m.text);
              text = m.text;
              reply(m.id, answers[m.name]?.() ?? { ok: false, error: "unknown-question" });
            },
          },
        },
      },
    });
  }, [start, invite] as const);
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

  const says = sheet.getByText("تسجيل الدخول يرسل إلى hifth.app شيئين من Apple", { exact: false });
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

const INVITE_BOX = "رمز الدعوة";
const INVITE_KEPT = "يحتفظ هذا الجهاز برمز دعوتك، فلا تكتبه من جديد.";
const FORGET_INVITE = "انسَ رمز الدعوة";
const MADE_UP_CODE = "MADE-UP-7Q2K";

test("a tester types the invite code once: the box appears, the code goes to the app, and leaves the page", async ({ page }) => {
  await standInApp(page, "signed-out", "needed");
  const sheet = await openPanel(page);
  await expect(sheet.getByText(INVITE_KEPT)).toHaveCount(0);

  await sheet.getByRole("button", { name: SIGN_IN }).click();
  const box = sheet.getByRole("textbox", { name: INVITE_BOX });
  await expect(box).toBeVisible();
  await box.fill(MADE_UP_CODE);
  await sheet.getByRole("button", { name: SIGN_IN }).click();

  await expect(sheet.getByText("أنت مسجّل الدخول في هذا الجهاز.")).toBeVisible();
  // The first try carries no code; the second carries the one typed.
  const sent = await page.evaluate(() => (window as unknown as { __standInSent: (string | undefined)[] }).__standInSent.map((s) => s ?? ""));
  expect(sent).toEqual(["", MADE_UP_CODE]);
  expect(await page.content()).not.toContain(MADE_UP_CODE);
});

test("a kept invite code is said, and the reader can forget it", async ({ page }) => {
  await standInApp(page, "signed-out", "kept");
  const sheet = await openPanel(page);
  const line = sheet.getByText(INVITE_KEPT);
  await line.scrollIntoViewIfNeeded();
  await expect(line).toBeVisible();

  await sheet.getByRole("button", { name: FORGET_INVITE }).click();
  await expect(line).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: FORGET_INVITE })).toHaveCount(0);
  const asked = await page.evaluate(() => (window as unknown as { __standInAsked: string[] }).__standInAsked);
  expect(asked).toContain("forget-invite");
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
