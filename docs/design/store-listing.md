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
> The app's buttons are in Arabic, because its readers use it in Arabic.
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
> 1. Open the app. It opens on a page of the mus'haf.
> 2. Tap any verse. A row of links appears under it, showing how many look-alike verses there
>    are in the same chapter and in the whole Qur'an.
> 3. Tap one of those links, then a verse in the list, to jump to it.
> 4. Swipe sideways to turn the page.
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
| The marks stay on the device | No code sends them; when "Report a problem" is built (item ⑱) it must keep them out, as its design says. |

## What would change these notes?

- **Sign-in ships:** the account sentence names the test account and what it unlocks.
- **The recitation is switched off in the store build** (one answer to item ⑥): the
  recitation paragraph goes, and the notes say the app asks nothing of the internet.
- **"Report a problem" ships:** add a line saying the reader sees the whole report and sends it
  by mail themselves.
