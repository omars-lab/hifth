import { test, expect } from "@playwright/test";
import { tapAyah } from "./ayah";

// The ▶ per-verse play control (task #67). The recitation is not ours — each
// ayah streams from Quran.com's public audio CDN — so the thing worth pinning in
// a runner is the wiring, not the sound: the control shows only when a verse is
// selected, and tapping it asks the CDN for *that verse's* file at the exact,
// zero-padded address `audio.ts` builds. Whether the mp3 then decodes is the
// browser's job and codec-dependent in a headless runner, so this test stops at
// the request and never waits on audio to actually play.
test.describe("Hifth · per-verse recitation (task #67)", () => {
  test("the play control appears on selection and asks the CDN for that verse", async ({ page }) => {
    let requested: string | null = null;
    // Catch the media request before it streams; fulfil it with an empty body so
    // nothing hangs on a real download, and record the URL the element reached
    // for. The handler runs whether or not the bytes ever decode, so the URL is
    // captured even though playback in a headless runner may not begin.
    await page.route("https://verses.quran.com/**", async (route) => {
      requested = route.request().url();
      await route.fulfill({ status: 200, contentType: "audio/mpeg", body: "" });
    });
    // WebKit fetches media outside Playwright's interception, so on the iPhone
    // project the route above never fires. Record, as well, the address the app
    // hands its player: the same fact (which file for which verse), read one
    // step earlier, where every engine can see it.
    await page.addInitScript(() => {
      const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src")!;
      Object.defineProperty(HTMLMediaElement.prototype, "src", {
        ...d,
        set(this: HTMLMediaElement, v: string) {
          (window as unknown as { __audioSrc?: string }).__audioSrc = String(v);
          d.set!.call(this, v);
        },
      });
    });

    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // Nothing selected → no play control at all (it renders null without a verse).
    await expect(page.getByRole("button", { name: /تشغيل/ })).toHaveCount(0);

    // Select 2:48 (verse-55 on page 7, vendored).
    await tapAyah(page, "#verse-55");
    const play = page.getByRole("button", { name: /تشغيل .*٢:٤٨/ });
    await expect(play).toBeVisible();

    // Tapping it reaches for exactly this verse's file — surah 002, ayah 048,
    // each padded to three digits. This is the whole point of `verseAudioUrl`.
    await play.tap();
    await expect
      .poll(
        async () =>
          requested ??
          (await page.evaluate(() => (window as unknown as { __audioSrc?: string }).__audioSrc ?? "")),
      )
      .toContain("/Minshawi/Murattal/mp3/002048.mp3");
  });

  // A pitch room may have no wifi, and the recitation is the one thing the app
  // fetches from outside. The screen-reader announcement alone left a sighted
  // reader with a button that looked exactly as it did before the tap (its
  // "warning" colour named a colour that was never defined), so the control
  // now says on its face why nothing sounds (docs/PLAN.md, item 55).
  test("with no connection, the play control says so on its face", async ({ browser }) => {
    // Our own service worker would answer from its cache; keep it out so the
    // only thing deciding is the network.
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await tapAyah(page, "#verse-55");
    const play = page.getByRole("button", { name: /تشغيل .*٢:٤٨/ });
    await expect(play).toBeVisible();
    const before = await play.evaluate((el) => getComputedStyle(el).color);

    await context.setOffline(true);
    await play.tap();

    await expect(play).toHaveAttribute("data-phase", "error");
    await expect(play).toContainText("بلا اتصال");
    expect(await play.evaluate((el) => getComputedStyle(el).color)).not.toBe(before);
    await expect(page.getByRole("status").filter({ hasText: "تعذّر تشغيل هذا التسجيل" })).toHaveCount(1);
    await context.close();
  });

  // The likelier room: joined to a wifi that has no internet behind it. The
  // device still believes it is online, so the caption cannot lean on that;
  // the file has no source but the network, so it names the network anyway.
  // Android only: the iPhone engine fetches media outside Playwright's reach,
  // so a blocked address cannot be staged there.
  test("on a wifi with no internet behind it, the caption still says offline", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "android", "media requests are only interceptable in Chromium");
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    await page.route("https://verses.quran.com/**", (route) => route.abort("internetdisconnected"));
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await tapAyah(page, "#verse-55");
    const play = page.getByRole("button", { name: /تشغيل .*٢:٤٨/ });
    await play.tap();
    await expect(play).toHaveAttribute("data-phase", "error");
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(play).toContainText("بلا اتصال");
    await context.close();
  });

  // The wifi comes back mid-meeting. A second tap on the same verse used to
  // ask the failed player to carry on, which never fetches the file again, so
  // the verse stayed silent until another one was chosen.
  test("once the connection is back, a second tap fetches the verse again", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const w = window as unknown as { __srcSets: number };
      w.__srcSets = 0;
      const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src")!;
      Object.defineProperty(HTMLMediaElement.prototype, "src", {
        ...d,
        set(this: HTMLMediaElement, v: string) {
          w.__srcSets += 1;
          d.set!.call(this, v);
        },
      });
    });
    await page.route("https://verses.quran.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "audio/mpeg", body: "" }),
    );
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await tapAyah(page, "#verse-55");
    const play = page.getByRole("button", { name: /تشغيل .*٢:٤٨/ });
    await context.setOffline(true);
    await play.tap();
    await expect(play).toHaveAttribute("data-phase", "error");
    const sets = () => page.evaluate(() => (window as unknown as { __srcSets: number }).__srcSets);
    const first = await sets();

    await context.setOffline(false);
    await play.tap();
    await expect.poll(sets).toBeGreaterThan(first);
    await context.close();
  });
});
