# What will Hifth's App Store listing say?

*Started 2026-11-16 for item ⑬ on the [launch page](app-store-launch.md), "nothing yet shows
Apple's reviewers the app is more than a website". The rest of the store's questions (privacy
labels, age questions, the export answer, the EU trader answer, the description) join this page
under item ㉚. Nothing here is sent anywhere yet; the owner pastes it into Apple's site at upload.*

## The short version

- **What this page is:** the words for Apple's forms, drafted where they can be checked against
  the app.
- **Done so far:** the notes for Apple's reviewer.
- **Still to come:** the description, keywords, privacy labels, age answers, the EU trader answer
  (the owner's), and a test account once sign-in exists.

## Words used here

- **Mus'haf:** a printed copy of the Qur'an, page for page.
- **Hafiz** (plural *huffaz*): someone who has memorised the Qur'an.
- **Review notes:** a box in Apple's upload form where we tell the reviewer how to try the app.
  It holds up to 4,000 characters.

## What will the reviewer read?

The text below goes into the review notes box as it is. Each claim in it is held by a test or a
check, listed after it, so the notes cannot drift from the app.

> Hifth is a study tool for people who have memorised the Qur'an (huffaz). It shows the printed
> page of the mus'haf and, on any verse, the other places in the Qur'an that read almost the
> same, which is where people who have memorised it slip.
>
> The app follows the device's language: on an English device its buttons are in English, and
> the EN / ع switch at the top right changes it. The Qur'an pages are always in Arabic.
>
> What the app does beyond a web page:
>
> 1. It works with no connection, from the first launch. The pages, the fonts and the data that
>    finds look-alike verses are inside the app. You can turn on Airplane Mode before the first
>    launch and every page still opens.
> 2. It answers the Apple Pencil. On an iPad, double-tap or squeeze the pencil to change the
>    writing tool. The reader writes on the page to mark their own slips, and the marks stay on
>    the device.
> 3. Other apps can open it and get an answer back. A link such as
>    `hifth://x-callback-url/open?verse=2:255` opens that verse, and Shortcuts can use the same
>    links to ask the app what is on screen.
> 4. It saves files through the system's own save window: the reader's bookmarks, and a cropped
>    picture of part of a page.
>
> How to try it:
>
> 1. Open the app. It opens on page 7 of the mus'haf (chapter 2, Al-Baqarah).
> 2. Tap verse 40, in the middle of the page (each verse ends in a round mark with its number;
>    look for ٤٠). The verse is highlighted, and a bar comes up at the bottom of the screen
>    with the verse's name.
> 3. On that bar is a small round button with the sign ≈ and the number 2: two other verses in
>    this chapter read almost the same. Tap it. A list opens with verses 2:47 and 2:122, and
>    shows the words where each one starts to differ.
> 4. Tap the green arrow beside one of them. The app turns to that verse and highlights it.
> 5. Turn pages with a swipe, or with the arrows at each end of the slider at the bottom.
>
> If anything goes wrong, the ⓘ button on the top bar opens a panel with "Report a problem".
> It shows the reader the whole report first (the app's version, the device, recent errors,
> never their notes or marks), and only then opens their own mail app to send it.
>
> The one thing the app fetches from the internet is the sound of a verse being recited, from
> verses.quran.com. It fetches a verse's sound when the verse is selected, so Play starts at
> once; the reader can turn that off. With no connection the page still works and only the
> sound is missing.
>
> The app has no account, no ads, no tracking and no analytics. Nothing the reader writes leaves
> the device.

*The account sentence changes when sign-in ships (item ㉖ on the launch page): it then names
the test account for the reviewer.*

## What holds each claim

| Claim in the notes | What checks it |
|---|---|
| Works with no connection from the first launch | A browser test refuses every outside address and still sees a page drawn and a verse selected (`apps/web/e2e/offline.spec.ts`, "a first launch with no connection"). A fresh install in the iPad simulator, 2026-11-16: three pages drawn, every file the page refers to inside the app, and one outside request, the recitation fetched ahead. |
| Every page opens | All 604 pages are in the built web part the app carries (`apps/web/dist/assets/pages/hafs-kfqc/`). |
| Answers the Apple Pencil | The shell hands double-tap and squeeze to the page (`native/Hifth/Web/Pencil.swift`), held by `native/HifthTests/PencilTests.swift`. |
| Other apps can open it and get an answer | The `hifth` link scheme in `native/Hifth/Resources/Info-iOS.plist` and the actions in `native/Hifth/Route/XCallback.swift`, held by `XCallbackTests.swift`, `ShellCallbackTests.swift` and `RouteTests.swift`. |
| Saves through the system's save window | `native/Hifth/Web/Downloads.swift`, held by `DownloadTests.swift`. |
| The recitation is the only outside fetch, and it can be turned off | The same browser test counts exactly one outside request after a tap, for that verse's sound. The "fetch ahead" setting (`apps/web/src/run-ahead.ts`) is in the info panel. |
| No account, no ads, no tracking, no analytics | The privacy file says the app tracks nobody and collects nothing, and the store build's release check refuses one that says otherwise (launch page item ⑦). |
| The marks stay on the device | No code sends them, and the problem report leaves them out: a test writes made-up notes and marks to storage and checks the report has none of them (`apps/web/src/problem-report.test.ts`). |
| The buttons follow the device's language; it opens on page 7 | A fresh install on the reviewer iPad simulator, English device, 2026-11-17: English buttons, page 7, nothing announced (`.claude/skills/walk-app/scripts/first-open-walk.js`). |
| Verse 40 on page 7 has two look-alikes in its chapter, 2:47 and 2:122, behind a "≈ 2" button | Checked in the store web build, 2026-11-17, and held by `apps/web/e2e/store-review-steps.spec.ts`. |
| "Report a problem" shows the report before any mail | `apps/web/src/components/ReportProblem.test.tsx`; walked on the reviewer iPad with no mail account, 2026-11-17 (`.claude/skills/walk-app/scripts/report-problem-walk.js`). |

## What would change these notes?

- **Sign-in ships:** the account sentence names the test account and what it unlocks.
- **The recitation is switched off in the store build** (one answer to item ⑥): the
  recitation paragraph goes, and the notes say the app asks nothing of the internet.
- **The opening page or the look-alike button changes:** the "How to try it" steps name page 7,
  verse 40 and the "≈ 2" button, so they change with it. The test that walks those steps fails
  first.
