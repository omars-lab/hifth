# What will the privacy page and the App Store privacy label say once a reader can sign in?

*Written 2026-11-18 for the owner to approve.
This is step 19 of the sign-in plan ([sign-in.md](sign-in.md)).
It is a draft: the live privacy page, the store answers and the app's privacy file are all unchanged, and sign-in is still switched off.
Every sentence below was checked against the sign-in server code as it stood on 2026-11-18, after steps 6 to 10, 12 and the server halves of steps 13 and 14.
Step 15 was being built in the app the same day and is not yet read here.*

> [!tip] Short version
> **The privacy page.** The "Accounts" section stops saying "Hifth has no accounts yet".
> It says sign-in is optional, lists the few things an account stores, who can see them and how to delete them.
> **What an account stores today.** A number Apple gives us for the reader, a random account number of our own, the date the account was made, for each signed-in device a scrambled copy of its sign-in key with a start and an end date, and Apple's cancel ticket, locked.
> **No email and no name.** The app asks Apple for neither, and the server keeps neither, so the draft says so plainly.
> **Built since, so marked as built.** The "Delete my account" button in the app (step 14), staying signed in after the app closes (step 15), the place that says what leaves the device (step 16) and the limit on tries (step 17) were all built on 2026-11-18 and tried with a stand-in app; none has been seen in the real app on an iPad yet.
> **Not built yet, so marked.** The copy of the reader's marks (step 21).
> **Step 13 landed while this was written.** The server now keeps the cancel ticket and acts on Apple's notices, so those sentences are marked as built on the server.
> **The store label.** "Data Not Collected" ends the day a store build can sign in.
> It becomes one data type, User ID, linked to the reader, for app functionality, not used for tracking.
> The copy of the marks adds a second type at step 21.
> **Seven questions are yours.** They are at the end, the one that holds up the most first.

## What do the words on this page mean?

- **Hafiz:** someone who has memorised the Qur'an, or is memorising it.
- **Your marks:** what the app keeps for one reader: mistakes, look-alike jumps, notes and bookmarks.
- **Apple's number for the reader:** a long code Apple hands us at sign-in. It is the same every time that reader signs in to Hifth, and it is not their Apple ID or their email.
- **The sign-in key:** a long random code the server hands the app after a sign-in. The app shows it on later requests to prove who it is.
- **A scrambled copy:** a one-way fingerprint of a code. The code cannot be worked back out of it.
- **The cancel ticket:** a long-lived code from Apple that lets our server ask Apple to cut the link between a reader's Apple account and Hifth.
- **The store label:** the "App Privacy" box on the app's App Store page, filled in from answers we give Apple.
- **The app's privacy file:** a small file inside the app that tells Apple the same things in a form its tools can read.

## What does this change for a hafiz?

> [!important] For a hafiz
> Nothing while reading and revising: no account is needed, and the page says so first.
> A reader who does sign in can read, in a few lines, exactly what we hold about them and how to remove it.
> The one thing close to their worship, the copy of where their memory slips, is not stored by sign-in at all.
> It arrives only with its own button at step 21, and the page will say plainly that we could read that copy.

## What does an account really store today?

This is what the code does, which is narrower than what the plan first imagined.

| Thing | Kept? | Detail |
| --- | --- | --- |
| Apple's number for the reader | yes | One per account. Accounts are found by it. |
| Our own account number | yes | A random code, so nothing else we store repeats Apple's number. |
| When the account was made | yes | A date and time. |
| Email | **no** | The app asks Apple for no email. Apple's note may still carry one, and the server reads past it and keeps nothing. |
| Name | **no** | The app asks Apple for no name. |
| The sign-in key, per device | scrambled copy only | With when it started and when it ends. It ends after 60 days, and signing out ends it on that device only. |
| The one-off value for a sign-in | scrambled copy only | Good once, for ten minutes, and not tied to any reader. |
| How many sign-ins were started in each ten minutes | yes, a number only | One count for everyone together, to limit how many can be started (step 17). Nothing about who asked, and counts for past stretches are deleted. |
| A tester's invite code | **no** | While sign-in is for invited testers (step 18), the code is checked when a sign-in starts and is not kept, tied to an account or logged. The server holds only scrambled copies of the codes it accepts. The app keeps the code the tester typed on that device only, in Apple's locked store, so it is typed once; it is not synced or backed up to another device. The tester can make the app forget it from the account section, and deleting the account forgets it too. |
| Apple's cancel ticket | yes, locked | At most one per account, with which of our apps the reader signed in to and when it was kept. The lock's key is not in the database. Kept only if the app sends Apple's one-time code and the key file is set; sign-in works without it. |
| A copy of the reader's marks | not yet | Step 21, behind its own button. |
| Which device, which internet address | **no** | The sign-in code writes no log and keeps no device name or address. |
| When the reader signed in | **yes, as a side effect** | Each device's sign-in row carries its start time and is tied to the account. Since 2026-11-18 a row that has run out is deleted the next time anyone signs in, so the database holds the start times of sign-ins still in use, not a history. |

## What will the "Accounts" section say, in English?

This replaces the two lines under "Accounts" on the privacy page.
A line that starts with a step in square brackets goes in when that step lands, and stays out until then.

### Accounts

Signing in is optional.
Hifth works in full without an account, and everything above on this page stays true for you if you never sign in.

You sign in with Apple's own "Sign in with Apple" panel.
We ask Apple for neither your name nor your email, and we keep neither.

**[goes in when step 21 lands]** Signing in is for one thing: so that your marks can follow you from one device to another, and only if you press the button that says so.

**What an account stores**

- A number Apple gives us for you. It is the same each time you sign in to Hifth, and it is not your Apple ID or your email. We keep it for one reason: to know it is you the next time you sign in.
- An account number of our own, picked at random, and the date your account was made.
- For each device you sign in on, a scrambled copy of the key that keeps that device signed in, with the date it started and the date it ends. The key cannot be worked back out of the scrambled copy, so a copy of our database could not be used to sign in as you.
- **[step 13, built on the server 2026-11-18]** A ticket from Apple that we use for one thing: to ask Apple to cut the link between your Apple account and Hifth when you delete your account. It is kept locked, and the key to the lock is not kept in the same database.
- **[goes in when step 21 lands]** If you press "Keep a copy of my marks on hifth.app", one copy of your marks, notes and bookmarks. This copy is not locked against us: the person who runs Hifth could read it. Without that button, your marks never leave your device.

We do not keep your name, your email, the name of your device or its internet address.
When a device's sign-in ends, its row is deleted the next time anyone signs in to Hifth, so we do not keep a history of when you signed in.

A device stays signed in for 60 days, and then asks you to sign in again.
Signing out ends the sign-in on that device only.

**[step 16, built 2026-11-18]** Before you sign in, the "About Hifth" panel says what leaves your device and what hifth.app keeps, above Apple's button. Once you are signed in, the same place lets you sign out or delete your account.
**[step 18, built 2026-11-18]** While sign-in is for invited testers, the app keeps your invite code on this device only, so you type it once. The same place says when a code is kept and lets you make the app forget it.

**[step 15, built 2026-11-18]** The app keeps its sign-in key in your device's locked store for passwords, and nowhere else.
**[step 15, built 2026-11-18]** Each time it opens, the app asks Apple whether you still allow Hifth to use Sign in with Apple, and signs you out if you do not.

**[step 17, built 2026-11-18]** So that nobody can wear out our database, hifth.app starts only a limited number of sign-ins every ten minutes, for everyone together, and keeps no note of who asked. If the limit is reached, the app asks you to try again shortly.

**Who can see it**

Accounts are stored in a database at Cloudflare, the company that hosts hifth.app.
Only the person who runs Hifth can open it.
We do not share it or sell it, and it is never used for advertising.
Like any visit to a website, Cloudflare sees each sign-in request arrive.
Apple knows that you use Sign in with Apple with Hifth, and shows Hifth in the list of apps in your Apple account's settings.

**How to delete your account**

**[step 14, built 2026-11-18]** Choose "Delete my account" in the app.
**[step 14, built 2026-11-18]** It deletes your account and signs out every device, and it asks Apple to cut the link between your Apple account and Hifth.
**[goes in when step 21 lands]** It also deletes the copy of your marks that we hold.
**[step 14, built 2026-11-18]** The marks on your own device are not touched.
**[step 14, built 2026-11-18]** If Apple cannot be reached, your account is still deleted, and the app tells you how to remove Hifth from your Apple account's settings yourself.

**[step 13, built on the server 2026-11-18]** If you stop Hifth from using Sign in with Apple in your Apple account's settings, Apple tells us.
**[step 13, built on the server 2026-11-18]** We then sign out all your devices and throw away Apple's ticket; your account stays, so signing in again finds it.
**[step 13, built on the server 2026-11-18]** If you delete your Apple account itself, Apple tells us, and we delete everything we hold about you.

## What will the "Accounts" section say, in Arabic?

The same wording, sentence for sentence, with no vowel marks, in the words the Arabic page already uses.

### الحسابات

تسجيل الدخول اختياري.
يعمل حفظ كاملا بلا حساب، وكل ما سبق في هذه الصفحة يبقى صحيحا إن لم تسجل الدخول أبدا.

تسجل الدخول من لوحة Apple نفسها «تسجيل الدخول باستخدام Apple».
لا نطلب من Apple اسمك ولا بريدك، ولا نحتفظ بأي منهما.

**[يضاف حين تنجز الخطوة 21]** لتسجيل الدخول غرض واحد: أن تنتقل علاماتك معك من جهاز إلى آخر، وذلك فقط إن ضغطت الزر الذي يذكر ذلك.

**ما يحفظه الحساب**

- رقم تعطينا إياه Apple لك. هو نفسه في كل مرة تسجل فيها الدخول إلى حفظ، وليس هو Apple ID ولا بريدك. نحتفظ به لسبب واحد: أن نعرف أنه أنت حين تسجل الدخول في المرة التالية.
- رقم حساب من عندنا يختار عشوائيا، وتاريخ إنشاء حسابك.
- لكل جهاز تسجل الدخول منه، نسخة مموهة من المفتاح الذي يبقي ذلك الجهاز مسجلا، مع تاريخ بدايته وتاريخ نهايته. لا يمكن استخراج المفتاح من النسخة المموهة، فلا تنفع نسخة من قاعدة بياناتنا أحدا في الدخول باسمك.
- **[الخطوة 13، بنيت على الخادم في 2026-11-18]** تذكرة من Apple نستعملها لأمر واحد: أن نطلب من Apple قطع الصلة بين حسابك في Apple وحفظ حين تحذف حسابك. وهي محفوظة مقفلة، ومفتاح القفل ليس محفوظا في قاعدة البيانات نفسها.
- **[يضاف حين تنجز الخطوة 21]** إن ضغطت «احتفظ بنسخة من علاماتي على hifth.app»، نسخة واحدة من علاماتك وملاحظاتك ومواضع وقوفك. هذه النسخة غير مقفلة عنا: يستطيع الشخص الذي يشغل حفظ أن يقرأها. ومن دون ذلك الزر لا تغادر علاماتك جهازك أبدا.

لا نحتفظ باسمك ولا ببريدك ولا باسم جهازك ولا بعنوانه على الإنترنت.
أما تواريخ تسجيل دخول أجهزتك فتبقى في قاعدة بياناتنا، حتى بعد انتهاء الدخول، إلى أن يحذف حسابك.

يبقى الجهاز مسجلا ستين يوما، ثم يطلب منك تسجيل الدخول من جديد.
وتسجيل الخروج ينهي الدخول على ذلك الجهاز وحده.

**[يضاف حين تنجز الخطوة 16]** قبل أن يغادر جهازك أي شيء لك، يذكر زر ما الذي يخرج ومن يستطيع أن يراه، وفي التطبيق مكان ترى فيه ما أرسلته وتسترده.

**[يضاف حين تنجز الخطوة 15]** يحفظ التطبيق مفتاح الدخول في مخزن كلمات السر المقفل في جهازك، ولا يحفظه في مكان آخر.
**[يضاف حين تنجز الخطوة 15]** وفي كل مرة يفتح فيها، يسأل التطبيق Apple هل ما زلت تسمح لحفظ باستعمال «تسجيل الدخول باستخدام Apple»، ويسجل خروجك إن لم تعد تسمح.

**[يضاف حين تنجز الخطوة 17]** ولمنع البرامج الآلية من محاولة الدخول مرة بعد مرة، يستعمل تسجيل الدخول التحقق نفسه الذي يستعمله النموذج في الصفحة الأولى، وهو مذكور في قسم «التحقق من البريد المزعج» أدناه.

**من يستطيع أن يراه**

تخزن الحسابات في قاعدة بيانات عند Cloudflare، وهي الشركة التي تستضيف <span dir="ltr">hifth.app</span>.
لا يفتحها إلا الشخص الذي يشغل حفظ.
لا نشاركها ولا نبيعها، ولا تستعمل للإعلانات أبدا.
وكما في أي زيارة لموقع، يرى Cloudflare وصول كل طلب لتسجيل الدخول.
وتعرف Apple أنك تستعمل «تسجيل الدخول باستخدام Apple» مع حفظ، وتعرض حفظ في قائمة التطبيقات في إعدادات حسابك لديها.

**كيف تحذف حسابك**

**[يضاف حين تنجز الخطوة 14]** اختر «احذف حسابي» في التطبيق.
**[يضاف حين تنجز الخطوة 14]** يحذف ذلك حسابك ويسجل خروج كل جهاز، ويطلب من Apple قطع الصلة بين حسابك في Apple وحفظ.
**[يضاف حين تنجز الخطوة 21]** ويحذف أيضا نسخة علاماتك التي عندنا.
**[يضاف حين تنجز الخطوة 14]** أما العلامات التي على جهازك فلا تمس.
**[يضاف حين تنجز الخطوة 14]** وإن تعذر الوصول إلى Apple، فحسابك يحذف مع ذلك، ويخبرك التطبيق كيف تزيل حفظ من إعدادات حسابك في Apple بنفسك.

**[الخطوة 13، بنيت على الخادم في 2026-11-18]** وإن منعت حفظ من استعمال «تسجيل الدخول باستخدام Apple» من إعدادات حسابك في Apple، أخبرتنا Apple بذلك.
**[الخطوة 13، بنيت على الخادم في 2026-11-18]** فنسجل خروج كل أجهزتك ونتلف تذكرة Apple، ويبقى حسابك، فإن سجلت الدخول من جديد وجدته.
**[الخطوة 13، بنيت على الخادم في 2026-11-18]** وإن حذفت حسابك في Apple نفسه، أخبرتنا Apple، فنحذف كل ما نحتفظ به عنك.

## Which other sentences on the privacy page must change with it?

- **"What stays on your device"** says none of your marks are sent to us and we have no copy. That stays true through step 20. At step 21 it gains: "unless you sign in and press the button that keeps a copy on hifth.app, described under Accounts".
- **"A check for problems, each time the app opens"** says the request carries no account. That is true today. It stays true only if the app never attaches its sign-in key to that request, so step 15 should hold it with a test.
- **"Spam check"** says only the form uses it. Step 17 adds sign-in to that sentence.
- **"No tracking"** stays as it is. Sign-in adds no analytics, no advertising and no outside company beyond Cloudflare and Apple, both already named.

## What changes on the App Store privacy label?

Apple counts data as "collected" when it leaves the device and we can reach it for longer than it takes to answer the request.
The data type names below are Apple's own, read on [Apple's page](https://developer.apple.com/app-store/app-privacy-details/) on 2026-11-18.

### What changes the day a store build can sign in?

The answer "Data Not Collected" is no longer true, because Apple's number for the reader is kept on our server.

| Apple's data type | Collected? | Linked to the reader? | Used for tracking? | Purpose | Reason, in one line |
| --- | --- | --- | --- | --- | --- |
| Identifiers: User ID | **yes** | **yes** | no | App Functionality | Apple's number for the reader and our own account number are account-level IDs, kept to sign the reader in. |
| Contact Info: Email Address | no | | | | The app asks Apple for no email, and the server keeps none even when Apple's note carries one. |
| Contact Info: Name | no | | | | The app asks Apple for no name. |
| Identifiers: Device ID | no | | | | The sign-in key is random and new at each sign-in. It names a sign-in, not a device. |
| Everything else | no | | | | Unchanged from today's answer, for the reasons the store listing page already gives. |

"Used for tracking: no" is true because nothing is joined with another company's data for advertising, and nothing goes to a data broker.
The dates of a reader's sign-ins add no new line either: they are kept only as part of signing in, and are not used to study how the app is used.
Apple's cancel ticket (step 13) adds no new line: it is a sign-in credential tied to the same account, covered by User ID.

### What changes when the copy of the marks arrives (step 21)?

| Apple's data type | Collected? | Linked to the reader? | Used for tracking? | Purpose | Reason, in one line |
| --- | --- | --- | --- | --- | --- |
| User Content: Other User Content | **yes** | **yes** | no | App Functionality | The copy of the reader's marks, notes and bookmarks is kept with their account so it can follow them. |
| Sensitive Info | **your call**, recommended yes | yes | no | App Functionality | Apple's list for this type includes "religious or philosophical beliefs", and a record of Qur'an revision can show a reader's faith. Declaring it costs nothing and cannot be called an understatement later. |

### What has to change in the same commit as the label?

- The store listing page's privacy answer, and its line "No account, no ads, no tracking, no analytics", which becomes "No account needed".
- The app's privacy file, which gains one collected data type (User ID, linked, not tracking, for app functionality). Its tracking answer stays "no".
- The check that compares the two already refuses a listing that declares collected data while the privacy file lists none, and the other way round. So neither can change alone.
- Apple's exact spelling of the data type inside the privacy file should be read from Apple's page when that change is made, not from memory.

## What did reading the code turn up that the lead should know?

- **Expired rows were never removed; now they are (2026-11-18).** A one-off value that has run out is deleted each time a new one is handed out (step 17), and a sign-in that has run out is deleted each time anyone signs in, both tested. The clean-up runs on the next sign-in, not on a clock, so on a day nobody signs in an ended row waits a little longer; the draft says "the next time anyone signs in" for that reason.
- **The design page says a sign-in renews when used and ends after 60 days unused.** The code gives a fixed 60 days from sign-in, with no renewal. The draft follows the code. If step 15 adds renewal, the "60 days" sentence changes to "60 days after you last used it".
- **A history of sign-in times no longer builds up.** Each device's sign-in is kept with its start time and its account while it is in use, and is deleted after it runs out (see above). The draft's sentence that the dates stay until the account is deleted was replaced with one that says this.
- **Step 13 landed on the server while this was written** (2026-11-18). The draft follows it: removing Hifth in Apple's settings signs every device out and drops the ticket but keeps the account, and deleting the Apple account deletes everything. A ticket is kept only when the app sends Apple's one-time code, and the app's side of that was not read here.
- **The server half of step 14 landed the same day**, and it matches the draft: the account, every device's sign-in and the ticket are deleted whatever Apple answers, and the app is told whether Apple cut its side. The "Delete my account" button in the app followed the same day (step 16's account section), and it says how to remove Hifth in Apple's settings when Apple could not be reached, as the draft promises.
- **Step 15 landed in the app the same day.** Its two sentences match the code. It adds no renewal, so the "60 days" sentence stands.
- **Step 17 is not the front page's "are you a person" check**, which an earlier version of this draft said. That check runs in a web page, and sign-in is asked by the app, so the limit is one shared count instead; the sentence was rewritten to match.
- **The time an account was made is stored to the second.** The draft calls it "the date your account was made".

## Which questions can only the owner answer?

1. **The live page promises that the account wording and deleting from inside the app will be there "before it opens". Is "opens" the first reader other than you?** If yes, this wording goes live with steps 13 to 16 and before step 18's invitations, and your own trials in step 11 need no change to the page. This is first because it sets when everything else here is due.
2. **Is it true that only you can open the accounts database?** The draft says "only the person who runs Hifth can open it". That holds only if no one else has access to hifth.app's Cloudflare account.
3. **May the page name Cloudflare as where accounts are kept?** The page already names Cloudflare as the site's host and Supabase for the notify list, so the draft does the same.
4. **Should the label declare Sensitive Info for the copy of the marks?** Recommended yes. It is a judgment about how Apple's words apply to a record of Qur'an revision, and the answer is shown publicly on the store page.
5. **Should accounts never used again be cleaned up, and should the page promise it?** Sign-ins that have run out are now deleted at the next sign-in, and the draft promises that. An account whose devices have all signed out stays until it is deleted, holding only Apple's number for the reader and the date it was made.
6. **Before step 14 exists, what should a reader who wants their account gone be told?** No longer needed: the "Delete my account" button was built on 2026-11-18, so it exists before any reader other than you can sign in.
7. **Does the label change go to Apple with the first build that can sign in, even if the sign-in button is hidden?** Recommended yes, because the label describes what the build can do, and a tester build with an invite code can already make an account.

## What is this not settling?

- When sign-in opens, which the storage decision ties to the licensing question.
- The wording in the account section that says what leaves the device (step 16). It is built, in English and Arabic, and still yours to approve.
- Any legal advice. European data law treats religious data as a special kind, and this draft has not been read by anyone qualified.
- The wording for website sign-in and the email code (steps 23 to 25), which will add an email address to both the page and the label.
