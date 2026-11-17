# What will Hifth's App Store listing say?

*Started 2026-11-16 for item ⑬ on the [launch page](app-store-launch.md), "nothing yet shows
Apple's reviewers the app is more than a website". The rest of the store's questions (privacy
labels, age questions, the export answer, the EU trader answer, the description) join this page
under item ㉚. Nothing here is sent anywhere yet; the owner pastes it into Apple's site at upload.*

## The short version

- **What this page is:** the words for Apple's forms, drafted where they can be checked against
  the app.
- **Done so far:** the notes for Apple's reviewer; the name, subtitle, keywords, short promotion
  and description in English; the category; the privacy answer; the age answers (4+); the export
  answer; the support and privacy addresses.
- **Still to come:** the EU trader answer (the owner's), the price and copyright line (the
  owner's), the "rights to the content" answer (waits on the permissions), the listing in
  Arabic, and a test account once sign-in exists.
- **What keeps it honest:** a test checks every field against Apple's length limits and against
  the app's own settings (`make app-store-listing` prints the counts).

## Words used here

- **Mus'haf:** a printed copy of the Qur'an, page for page.
- **Hafiz** (plural *huffaz*): someone who has memorised the Qur'an.
- **Review notes:** a box in Apple's upload form where we tell the reviewer how to try the app.
  It holds up to 4,000 characters.

## What will the reviewer read?

The text below goes into the review notes box as it is. Each claim in it is held by a test or a
check, listed after it, so the notes cannot drift from the app.

<!-- field: review-notes -->
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
| The recitation is the only outside fetch, and it can be turned off | The same browser test counts exactly one outside request after a tap, for that verse's sound. The setting "The next verses in a recitation" (`apps/web/src/run-ahead.ts`) is in the info panel, and set to Off it stops the early fetch; the privacy policy names it by the app's own words, held by `apps/landing/lib/pages.test.mjs`. |
| The store fields fit Apple's limits; the name, category, privacy and export answers agree with the app | `make app-store-listing` (`.claude/skills/understanding-processes/scripts/check-store-listing.mjs`), held by its test, which breaks one thing at a time in a made-up copy of this page. |
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

## What will a reader see on the store page?

Each box below is pasted into Apple's form as it is. Apple's limit for each is in the heading.
Every line in the description is something the reviewer notes above already prove; nothing new
is claimed here.

**Name** (30 characters)

<!-- field: name -->
```text
Hifth
```

**Subtitle** (30 characters), shown under the name in search results:

<!-- field: subtitle -->
```text
For huffaz: look-alike verses
```

**Keywords** (100 characters, commas between them). Apple already searches the name and
subtitle, so these leave out the words in them.

<!-- field: keywords -->
```text
quran,mushaf,hifz,hafiz,memorize,revision,mutashabihat,similar,muraja'a,mistakes,juz,page
```

**Promotional text** (170 characters), the line at the top that can change without a new build:

<!-- field: promotional-text -->
```text
Revise on the printed page you memorised from, with the verses that read almost the same one tap away. Works with no connection from the first launch.
```

**Description** (4,000 characters)

<!-- field: description -->
```text
Hifth is a study companion for people who have memorised the Qur'an.

It shows the printed page of the mus'haf, all 604 pages. On any verse it shows the other places in the Qur'an that read almost the same, which is where people who have memorised it slip, and the words where each one starts to differ.

What you can do:

- Tap a verse to see the verses that look like it, and turn straight to any of them.
- Mark your own slips by writing on the page with your finger or an Apple Pencil. On an iPad, double-tap or squeeze the pencil to change tools.
- Keep bookmarks, and save them as a file to take with you.
- Hear a verse recited. This is the one thing that needs a connection.
- Open a verse from another app or from Shortcuts with a link.
- Use the buttons in English or Arabic. The app follows your device, and one switch changes it.

It works with no connection from the first launch: the pages and the look-alike verses are inside the app.

No account, no ads, no tracking. Nothing you write leaves your device.
```

**Category:** Education first, Reference second. (The Mac app's own settings already say
Education, and a test keeps the two the same.)

**Support address:** `https://hifth.app/support.html` · **Privacy policy:**
`https://hifth.app/privacy.html` · **Website:** `https://hifth.app`. A test checks both pages
are in the site's files.

## What does the app tell Apple about the reader's data?

Apple's form asks whether the app "collects" data, which Apple defines as sending it off the
device where we, or code from another company built into the app, can keep it longer than it
takes to answer the request. ([Apple's page](https://developer.apple.com/app-store/app-privacy-details/),
read 2026-11-17.)

<!-- field: privacy-answer -->
```text
Data Not Collected
```

Why that answer is true, case by case:

| What leaves the device | Why it is not "collected" |
|---|---|
| Nothing the reader writes: notes, marks, bookmarks, progress | It stays in the app's own storage on the device. No code sends it. |
| A verse's recitation is fetched from verses.quran.com | The app asks for a public sound file. That site is not code inside our app, so Apple's word "partner" does not cover it, and we keep nothing from the request. The privacy policy names the fetch and how to turn the early fetch off. |
| A problem report, if the reader sends one | The reader sees the whole report first and sends it from their own mail app, with their own address on it, each time they choose to. Apple lists exactly this kind of "customer service request", given by the reader and shown in full, as one that need not be declared. |

The app's privacy file says the same (tracks nobody, collects nothing), and a test refuses a
listing whose answer disagrees with it. **This answer changes when sign-in ships:** an account
stores an Apple sign-in id and the reader's copy, so the form then lists those, "linked to
you", for "app functionality".

## How old must a reader be?

Apple's age questions, answered for the app as it is. The result is **4+**.
([Apple's list](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/),
read 2026-11-17.)

| Apple's question | Answer | What holds it |
|---|---|---|
| Parental controls; age checks | No | The app has neither. |
| Can a reader open any website inside the app? | No | Only the app's own pages load inside it; anything else goes to the system browser or nowhere. The shell's tests try mail, file, data and script addresses and other sites (`native/HifthTests/OutsideLinkTests.swift`). |
| Do readers' own posts reach other people? | No | Marks and notes stay on the device. |
| Social media; messaging and chat; advertising | No | None in the app. |
| Swearing, horror, alcohol or drugs, medical or health topics, sexual themes, violence, weapons | None | The app shows the Qur'an's pages and our own buttons. |
| Gambling, contests, loot boxes | None | None in the app. |

## Does the app use encryption Apple must be told about?

No. The app's only encryption is the system's own secure connection when it fetches a
recitation, which Apple exempts. Both the iPad and iPhone settings and the Mac settings say so
(`ITSAppUsesNonExemptEncryption` is off), so Apple's form does not ask at each upload. A test
keeps both set.

## What is still the owner's to fill in?

- **EU trader status.** In the EU, Apple must show whether the seller is a "trader", meaning
  someone doing this as a business. A trader's address, phone and email are shown on the store
  page to everyone. A free app made by one person, with no sales, can usually say "not a
  trader"; the owner decides.
- **Price** (assumed free; the app has nothing to buy) and the **copyright line**, which shows
  the owner's name on the store page.
- **"Does the app show content made by others, and do you have the rights?"** Yes, it does: the
  page artwork, the word-root data, the tajweed colours and the recitation. The answer "we have
  the rights" waits on the two permission emails and the two terms readings (launch items ③ ④
  ⑤ ⑥); it is the same lock as the upload.
- **The listing in Arabic.** Apple shows the listing in the reader's language. The Arabic
  version is drafted after the English one is settled, and read by a native reader before it
  goes in.
