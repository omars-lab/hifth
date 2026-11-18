# design.md (researcher B, 2026-11-17)

Saved by the main session from researcher B's hand-back; B could not write report files itself.

## Summaries

**Question 1, the Complex's mus'haf pages shipped in the app: allowed, with small changes.**
1. The Complex's own rights page lets anyone use its free digital mus'haf, which is the Illustrator files our pages come from. It is free of charge, for "software" and "computer programs", by private bodies, inside and outside Saudi Arabia. Read in English (Dec 2021 archive) and in Arabic (Dec 2024 and Jan 2026 archives).
2. The page asks for no approval and no set credit wording. It does not ban selling. The only limit is a footnote about printing paper copies inside Saudi Arabia or importing them there for sale. It says nothing at all about changing the files.
3. Changes needed: reword the credit so it does not say "commercial printing reserved". Say the pages were adapted, and do not suggest the Complex approved Hifth. Fix the repo record: quran-svg's own layer has been CC BY 4.0 since 2026-09-12, not CC0, and credit is waived inside a product. Keep archived copies of the Complex's page, because Apple can ask for proof.
4. Why not fully sure: the Complex's site was relaunched as a trial and has no live rights page now ("coming soon"). The terms are silent on changes, while its font terms forbid them. quran-svg had already removed the frame and redrawn the verse markers before Hifth got the pages.
5. Fairly sure, about 75%. Quran for iOS on the App Store also uses the Complex's page images, credited by name: a close example but not the same thing.

**Question 2, streaming Minshawi from Quran.com: needs permission.**
1. Quran.com's site terms allow "personal, non-commercial use only". Beyond that, copying or distributing "without the prior written consent of Quran.com" is barred. Hifth is free, so "non-commercial" fits, but serving other people is not "personal". The open door is Quran Foundation's developer terms. They cover audio, allow free and paid apps, and ban taking content "outside the API responses".
2. That route needs an account, a small server holding a secret key, approval for live use, a privacy policy and terms, a credit to Quran Foundation, and no keeping the audio longer than a week. Playing the CDN addresses directly with no account is not licensed today. Not a proven breach. Apple's rules 5.2.2 and 5.2.3 ask for permission under the service's terms.
3. New find: the file is the same, byte for byte, as EveryAyah's file (full SHA-256 compared, verse 2:255 only). Its built-in tag reads "VerseByVerseQuran.com Minshawy" and "MP3s from QuranicAudio.com". VerseByVerseQuran.com is now EveryAyah. QuranicAudio says personal use only, no commercial use, and that many files have "rules and regulations that prevent their sale except by the publishing companies".
4. The rights in the recording itself (Egyptian Radio and the Sono Cairo label, by search snippets) are unclear for every source. No source has a clean written licence for this recitation. Switching to EveryAyah would not help. Credit change: drop "Free to listen", because no source backs it.
5. Fairly sure, about 80%, that the current setup lacks permission. Who owns the recording is unclear. Options: register with Quran Foundation, turn recitation off in the store build until approved (the private pitch build keeps it), or ask Quran.com in writing. The owner would have to send that request.

## Question 1. Can Hifth ship the King Fahd Complex pages inside a free App Store app?

**Answer: allowed, with small changes.** It needs no permission. The changes are to wording and records, not to the app's code.

### What to change

1. **Credit wording.** The current second line, "commercial printing reserved to the Complex", says more than the Complex does. Its footnote is only about printing paper copies inside Saudi Arabia, and importing them there for sale, under two Royal Decrees. Suggested wording:
   - Line 1: "Mus'haf pages: the digital Mus'haf al-Madinah of the King Fahd Glorious Qur'an Printing Complex, Madinah (KFGQPC). Converted to SVG and adapted by the quran-svg project (Quran.ws)."
   - Line 2: "The Complex offers this digital copy free of charge for use in software and digital publishing. Printing it for sale in Saudi Arabia is reserved to the Complex."
   - Do not write anything that reads as approval by the Complex. "Adapted" is honest: quran-svg dropped the frame, header and page number, re-cropped each page and redrew the verse markers. The letters are the Complex's.
2. **Repo record.** quran-svg's own layer is CC BY 4.0 since commit 3ac54591 on 2026-09-12, not CC0. Credit is waived when used inside a product, so the app needs no extra credit, but the record should say CC BY 4.0. Also record:
   - The Complex's site was relaunched as a trial. The digital mus'haf page and its terms are "coming soon", and the old addresses give 404.
   - The terms we rely on are the archived pages: https://web.archive.org/web/20260119105728/https://dm.qurancomplex.gov.sa/rights/ (Arabic) and https://web.archive.org/web/20211206122921/https://dm.qurancomplex.gov.sa/en/copyright-2/ (English).
   - The owner's 2026-09-08 reading was probably of the old site.
3. **Keep proof.** Check saved copies of those two archived pages into the repo's notice, or link them. Apple can ask for proof under rule 5.2.1, and there is no live page to point to.
4. **Keep the letters untouched.** Hifth's own changes are making coordinates shorter and repairing a few broken shapes and ids. They are fine, and quran-svg's notice asks that the text is "never altered". Keep a test or note that no letter shape is redrawn.
5. **Optional, the owner's call:** a short note to the Complex saying the app exists and offering it for their review. Its digital research centre reviews third-party Qur'an apps and can issue certificates.
   - Pros: goodwill, a written yes, and a review of the text.
   - Cons: slow, and it may get no answer.
   - Implications: once asked, a "no" would bind us.
   - Not required by anything found.

### What would change the answer

- The Complex publishes new terms on its relaunched site, for example with its coming developer platform, that set rules for apps: approval, a credit line, or no changes.
- Something says changes to the Illustrator artwork are not allowed, the way the font terms say for the font.
- A Saudi rule making Complex approval required for a Qur'an app in the Saudi App Store. The Saudi media regulator's rules were not searched.
- The Complex objects to a specific page. The 2018 article says its committee can "prevent the publication or distribution of flawed texts".

### How sure, and why

Fairly sure, about 75%.

Supports it: three archived versions, in two languages, say the same thing; "software" and "computer programs" are named outright; the project page says the files were released for use "in many computer applications"; Quran for iOS uses the Complex's page images in a free App Store app and credits the Complex.

Caps it: the terms are only archived; they are silent on changes, and silence is not permission; the Complex's font terms show it does restrict changes to its other products; our pages went through upstream changes checked only from quran-svg's own description.

## Question 2. Can Hifth stream Minshawi Murattal from verses.quran.com in a free App Store app?

**Answer: needs permission.** As built today, no written permission covers it.

### Why

- **Quran.com's site terms** (updated July 28, 2026) cover sound recordings "FOR YOUR PERSONAL, NON-COMMERCIAL USE ONLY". They bar copying, distributing or publicly displaying content "without the prior written consent of Quran.com", except for personal, non-commercial use. Hifth is free with no ads, so "non-commercial" fits, but playing recordings to many people is not personal use.
- **Quran Foundation's developer terms** (updated 2026-10-11) are the written door. "QF Content" is defined as "Quran text, translations, metadata, audio, reflections, and any other content returned by the APIs". Showing it inside a free or paid app is allowed. The terms bind people who use the APIs. They bar taking content "outside the API responses" and keeping it longer than a week. A developer must also publish a privacy policy and terms of use.
- **Where Hifth sits.** It calls fixed CDN addresses with no account, so it sits outside that door. That makes it unlicensed, not a proven breach.
- **Apple.** Rule 5.2.2 says an app using a third-party service must be "specifically permitted to do so under the service's terms of use", with proof given on request. Rule 5.2.3 says streaming "may also violate Terms of Use". Today we could not show that proof.
- **The file's history.** The file is the same, byte for byte, as EveryAyah's 128 kbps Minshawy Murattal file. Its tag reads "VerseByVerseQuran.com Minshawy" (EveryAyah's old name) and "MP3s from QuranicAudio.com". QuranicAudio says its files are for personal use and not for commercial use, "as many of these files have rules and regulations that prevent their sale except by the publishing companies". EveryAyah publishes no terms.
- **The recording itself.** Search snippets say Minshawi's recordings were made for Egyptian Radio and are sold by the state label Sono Cairo. Nothing found from the family or the label. A secondary summary says Egypt protects sound recordings for 50 years, but there is no recording date and the law was not read. **Unclear for every source.**

### The routes, side by side

| Route | What it buys | What it costs or risks | What it commits us to |
|---|---|---|---|
| **A. Register with Quran Foundation** (recommended) | A written licence that covers audio in a free app. Proof for Apple. Same files, same sound. | The owner has to sign up. A small server holds the secret key and asks the API for verse addresses. A wait for approval of live use. The licence can be withdrawn, and it is under New York law. It does not settle who owns the recording. | Keep a public privacy policy and terms. Credit Quran Foundation. Keep no audio longer than a week (prefetching a little early is fine). A server to run. |
| **B. Store build ships with recitation off** until A is approved | Nothing unlicensed reaches the store. The private pitch build keeps recitation as it is. | Store users get no recitation for a while. | A switch in the store build, and turning it on later. |
| **C. Ask Quran.com in writing** to use the CDN directly | Could keep today's simple setup. | The owner has to send the message. One public permission request (2025-01-20) shows no reply. The answer will probably be "use the developer route". | Whatever conditions they set. |
| **D. Play from EveryAyah instead** | Nothing better: the same file, from the same source chain. | No terms at all. Same unclear recording rights. | Not recommended. |

Recommendation: do **B now and A next**. B costs almost nothing and keeps the store build clean. A is the only route with written permission.

### Credit wording

Drop "Free to listen". No source says that, and Quran.com's terms say the opposite for anything beyond personal use. Suggested wording: "Recitation: Sheikh Muhammad Siddiq al-Minshawi (Murattal), streamed from the Quran.com library by Quran Foundation." Under route A, add the credit to Quran Foundation that the developer terms expect.

### What would change the answer

- A written yes from Quran Foundation to play its CDN addresses without an account.
- Developer terms that plainly cover fixed CDN audio addresses, the way they already cover "documented CDN URLs" for fonts and page images.
- A claim, or a licence, from Sono Cairo or the Minshawi family.
- Finding that the old public API, which still answered without a key on 2026-11-17, is a supported, licensed path. Not checked.

### How sure, and why

Fairly sure, about 80%, that today's setup lacks permission. Not sure at all who owns the recording.
