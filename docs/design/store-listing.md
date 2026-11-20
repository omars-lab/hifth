# What will Hifth's App Store listing say?

*Started 2026-11-16 for item ⑬ on the [launch page](app-store-launch.md), "nothing yet shows
Apple's reviewers the app is more than a website". The rest of the store's questions (privacy
labels, age questions, the export answer, the EU trader answer, the description) join this page
under item ㉚. Nothing here is sent anywhere yet; the owner pastes it into Apple's site at upload.*

## The short version

- **What this page is:** the words for Apple's forms, drafted where they can be checked against
  the app.
- **Done so far:** the notes for Apple's reviewer; the name, subtitle, keywords, short promotion
  and description in English, and a first draft in Arabic; the category; the privacy answer; the age answers (4+); the export
  answer; the support and privacy addresses.
- **Still to come:** the EU trader answer (the owner's), the price and copyright line (the
  owner's), the "rights to the content" answer (waits on the permissions), the listing in
  Arabic read by a native reader (drafted 2026-11-20), and a test account once sign-in exists.
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
> The app asks nothing of the internet. Every page, and everything a page needs, is inside the
> app, so it works the same with no connection.
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
| The app asks nothing of the internet | The store build leaves the recitation out (launch item ⑥): `make app-web FLAVOUR=public` builds without it, and the copy into the app refuses any file holding the recitation server's address (`native/Makefile.native`, tested by `scripts/native-golden-public.test.mjs`). With the switch off, no listen control, play setting or recitation credit shows (`apps/web/src/no-recitation.test.tsx`). The website still streams it (item ㊻). |
| The store fields fit Apple's limits; the name, category, privacy and export answers agree with the app | `make app-store-listing` (`.claude/skills/understanding-processes/scripts/check-store-listing.mjs`), held by its test, which breaks one thing at a time in a made-up copy of this page. |
| No account, no ads, no tracking, no analytics | The privacy file says the app tracks nobody and collects nothing, and the store build's release check refuses one that says otherwise (launch page item ⑦). |
| The marks stay on the device | No code sends them, and the problem report leaves them out: a test writes made-up notes and marks to storage and checks the report has none of them (`apps/web/src/problem-report.test.ts`). |
| The buttons follow the device's language; it opens on page 7 | A fresh install on the reviewer iPad simulator, English device, 2026-11-17: English buttons, page 7, nothing announced (`.claude/skills/walk-app/scripts/first-open-walk.js`). |
| Verse 40 on page 7 has two look-alikes in its chapter, 2:47 and 2:122, behind a "≈ 2" button | Checked in the store web build, 2026-11-17, and held by `apps/web/e2e/store-review-steps.spec.ts`. |
| "Report a problem" shows the report before any mail | `apps/web/src/components/ReportProblem.test.tsx`; walked on the reviewer iPad with no mail account, 2026-11-17 (`.claude/skills/walk-app/scripts/report-problem-walk.js`). |

## What would change these notes?

- **Sign-in ships:** the account sentence names the test account and what it unlocks.
- **The recitation comes back to the store build** (route 2 for item ⑥, through Quran
  Foundation): the notes then say again what the app fetches, from where, and how to turn the
  early fetch off. (Switched off on 2026-11-17; these notes already say so.)
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

## What will a reader see on the store page in Arabic?

Apple shows the store page in the reader's language, so each box above has an Arabic twin. This
is a first draft, written from the English boxes with the app's own Arabic words (العلامات for
bookmarks, استمع for listen, احفظ في ملف for saving to a file). **A native reader reads it
before it goes in** (the owner's, on the waiting list). The same check holds it to Apple's limits.

- **The name stays "Hifth"**, the word under the icon, since the app has no Arabic name under
  its icon. The app's own Arabic calls it حفظ ("ثبّت حفظ ليعمل دون إنترنت"). Writing حفظ on the
  store page too would need the same name under the icon on Arabic phones; that is the owner's
  call, and the check will follow it.
- **The description names it once as «حفظ» (Hifth)**, as the app's Arabic does, so a reader
  who searches either finds it.

<!-- field: name-ar -->
```text
Hifth
```

<!-- field: subtitle-ar -->
```text
للحُفّاظ: الآيات المتشابهة
```

<!-- field: keywords-ar -->
```text
قرآن,مصحف,حفظ,حافظ,مراجعة,متشابهات,تثبيت,أخطاء,جزء,صفحة,تسميع,تلاوة
```

<!-- field: promotional-text-ar -->
```text
راجع على الصفحة المطبوعة التي حفظت منها، والآيات التي تكاد تُقرأ مثلها على بُعد لمسة. يعمل دون إنترنت من أول تشغيل.
```

<!-- field: description-ar -->
```text
«حفظ» (Hifth) رفيقٌ في المراجعة لمن حفظ القرآن الكريم.

يعرض صفحات المصحف المطبوعة كلها، وعددها ٦٠٤ صفحات. وعند أي آية يعرض المواضع الأخرى في القرآن التي تكاد تُقرأ مثلها، وهي حيث يزلّ الحافظ، والكلمات التي يبدأ عندها كل موضع بالاختلاف.

ما يمكنك فعله:

- المس آية لترى الآيات التي تشبهها، وانتقل إلى أيٍّ منها مباشرة.
- علّم زلّاتك بالكتابة على الصفحة بإصبعك أو بقلم Apple Pencil. وعلى iPad، انقر القلم مرتين أو اضغط عليه لتغيير الأداة.
- ضع العلامات، واحفظها في ملف تأخذه معك.
- استمع إلى تلاوة آية. هذا وحده يحتاج إلى اتصال.
- افتح آية من تطبيق آخر أو من الاختصارات برابط.
- استخدم الأزرار بالعربية أو الإنجليزية. يتبع التطبيق لغة جهازك، ويغيّرها مفتاح واحد.

يعمل دون اتصال من أول تشغيل: الصفحات والآيات المتشابهة داخل التطبيق.

لا حساب، ولا إعلانات، ولا تتبّع. ولا يغادر جهازك شيء مما تكتبه.
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
| Nothing the reader writes: notes, marks, bookmarks, progress | It stays in the app's own storage on the device. The only code that can send it is the copy of the marks (sign-in step 21), and the app offers that only when sign-in is on, which it is not in any build yet. |
| One small file at each launch, and nothing while reading | The store build leaves the recitation out (launch item ⑥). Its only request is the launch check (launch item ㉑): one public file from hifth.app, asked for with no cookies, no identifiers and nothing about the reader, compared on the device, and kept by us nowhere. Apple counts data as collected only when it is kept longer than it takes to answer the request, so this is not collected. If the recitation comes back, the fetch is of a public sound file from a site that is not code inside our app, so Apple's word "partner" would not cover it either. |
| A problem report, if the reader sends one | The reader sees the whole report first and sends it from their own mail app, with their own address on it, each time they choose to. Apple lists exactly this kind of "customer service request", given by the reader and shown in full, as one that need not be declared. |

The app's privacy file says the same (tracks nobody, collects nothing), and a test refuses a
listing whose answer disagrees with it. **This answer changes when sign-in ships:** an account
stores Apple's number for the reader (User ID) and, only if the reader presses its button, one
copy of their marks, including the mistakes they marked (Other User Content, and Sensitive Info
if the owner says yes). The form then lists those, "linked to you", for "app functionality".
The full new answer is drafted in [the privacy draft](sign-in-privacy-draft.md).

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

No. The store build fetches only the launch file, and the only encryption it uses is the
system's own secure connection, which Apple exempts. Both the iPad and iPhone settings and the Mac settings say so
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
  page artwork, the word-root data and the tajweed colours (the store build leaves the
  recitation out, item ⑥). The answer "we have the rights" waits on the two permission emails
  and the artwork question (launch items ③ ④ ㊺); it is the same lock as the upload.
- **The listing in Arabic** is drafted (above, 2026-11-20) and checked against Apple's limits.
  Before it goes in, a native reader reads it, and the owner says whether the Arabic store name
  is "Hifth" or حفظ.
