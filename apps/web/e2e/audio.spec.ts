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
    await expect.poll(() => requested).toContain("/Minshawi/Murattal/mp3/002048.mp3");
  });
});
