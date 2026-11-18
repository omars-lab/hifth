# May the store app show the page artwork and play the recitation?

*Consolidated 2026-11-17. This is the doc to act on.* Two researchers looked at the same two
questions on their own, and a third pass re-opened the sources behind every claim that decides
something. Their raw work stays as the record:
[researcher A](2026-11-17-store-terms-a-report.md),
[researcher B's findings](2026-11-17-store-terms-b-findings.md) and
[B's design](2026-11-17-store-terms-b-design.md).

It answers launch items ⑤ (the page artwork's own terms) and ⑥ (the recitation audio) on
[the launch page](../design/app-store-launch.md).

## The short answers

| Question | Answer | How sure |
| --- | --- | --- |
| May a free App Store app show the Madinah mus'haf pages, from the King Fahd Complex by way of quran-svg? | **Yes, with a fairer credit and corrected records** | Fairly sure, about 75%. One open point could flip it (see "Could the artwork answer flip?") |
| May the app stream the Minshawi recitation verse by verse from Quran.com's audio server, with no account? | **Not without permission.** The credit line "free to listen" must go now | Sure about the host's terms, about 80%. Who owns the recording itself is unclear for every source |

**What it changes for a hafiz:** nothing on the page; the same mus'haf stays, credited more
fairly. Recitation is the real cost: until a route below is in place, the store app may have to
ship without listening along.

## Where the two researchers agree

- The Complex's terms allow free use in websites and computer programs, inside and outside Saudi
  Arabia. The only limit in the footnote is printing in the Kingdom, and importing for commercial
  sale.
- The Complex's terms say nothing about changing the artwork, asking for approval, or the exact
  credit wording.
- quran-svg's own licence covers only what it added (the tap areas, the data files and the
  tooling). The artwork stays the Complex's.
- Quran.com's terms allow personal, non-commercial use only. Other public display needs written
  consent.
- Quran Foundation's developer terms cover audio. They need registration, a server that holds
  the secret key, a cache of a week at most, and a privacy policy and terms of use.
- The Minshawi files trace back to QuranicAudio.com, which allows personal use only.

## Where they disagree, and which side the source supports

| Point | A says | B says | The source supports |
| --- | --- | --- | --- |
| Quran.com §2.2 items (vi), (vii), (xi) as a ban on streaming | They apply | Weak: they sit in old app-install wording | **B.** The list mentions Palm and BlackBerry and is about installing Quran.com's own app. The answer rests on §1.4 and §2.3 instead |
| Field names in the audio file's tag | artist / album / comment | title / artist / album | **A.** The tag reads artist "Minshawy (Murattal)", album "VerseByVerseQuran.com Minshawy", comment "MP3s from QuranicAudio.com" |
| The Complex's own recitation licence | Covers five full reciters | Covers translation recordings | **Both, about their own page.** Same licence wording on both. Neither covers Minshawi |
| Hifth's record that quran-svg is CC0 | Change it to CC BY 4.0 | Change it to CC BY 4.0 | **Neither, as stated.** See the first new finding |
| How quran-svg made the pages | "Traced to vector" | "Converted to SVG" | **B.** The source is already vector, so nothing was traced |

## What neither researcher found

1. **At the commit Hifth pins, quran-svg's licence was CC0.** Hifth pins commit 5fbcb1d4
   (2026-07-13), whose notice says "CC0 1.0 (public domain) ... no attribution required". The
   move to CC BY 4.0 (credit waived inside an app) came later, on 2026-09-12. CC0 cannot be
   withdrawn, so Hifth's record is right for the files it ships. It changes only if the pin moves.
2. **The pinned pages are not today's upstream pages.** Four later commits changed them (tap
   areas rebuilt, verse-marker rings re-centred, verse markers replaced twice), and quran-svg's
   note naming the Complex's Illustrator files as its source was written after the pin. So both
   researchers' claims about where the pages came from describe a later version than Hifth ships.
3. **The Complex's rights page is now only on archive.org.** The live address returns 404 as of
   2026-11-17. The last archive copy is from 2026-01-19, and it matches the 2024 copies word for
   word.
4. **alquran.cloud serves the same Minshawi audio** (same audio bytes for 2:255; only the tag
   differs). Its terms: no account or key; "You may stream, embed and download the recitations
   for personal and educational use"; "If you put them in a commercial product, the reciters may
   ask you to remove them". One verse compared.
5. **Quran.com's old keyless audio and data address is being retired.** Quran Foundation's
   migration guide calls it "the older unauthenticated API" and tells developers to move to a
   signed-in server.
6. **Quran Foundation's credit wording**, for apps that use it: "Quran data provided by
   Quran.Foundation", plus a credit for each recitation by name.

## The deciding claims, re-checked

"Full" means the whole saved or archived page was read; "snippet" means only a search result or
a page-reader summary.

| Claim | Result | Source |
| --- | --- | --- |
| The Complex allows free use in "websites and computer programs ... inside and outside the Kingdom" | Confirmed | Full: Arabic copies 2024-05-18, 2024-12-02, 2026-01-19 (identical); English 2021-12-06 |
| The footnote limits only printing in the Kingdom and importing for commercial sale | Confirmed | Full, same copies |
| The Complex disclaims technical and software errors | Confirmed | Full |
| The terms say nothing on changes, approval or credit wording | Confirmed | Full |
| The project page says the release is for "many computer applications" | Confirmed | Full, 2024-12 |
| The Complex's font licence forbids reproducing or modifying "without the express written approval" | Confirmed | Full |
| quran-svg is now CC BY 4.0, credit waived "inside an application ... free or commercial" | Confirmed | Full, current notice |
| quran-svg was CC0 until 2026-09-12, including at Hifth's pin | Confirmed | Full, notice at the pin and the commit list |
| Quran.com §1.4 "personal, non-commercial use only"; §2.3 written consent for other distribution or public display | Confirmed | Full, terms updated 2026-07-28 |
| Quran Foundation's content includes audio; no redistribution; no keeping it over a week except through its sync; a privacy policy and terms of use are needed | Confirmed | Full, developer terms 2026-10-11 |
| Quran Foundation's audio needs a server with a client id and secret | Confirmed | Full, audio docs |
| Quran Foundation promises nothing about the recording's own rights, and the developer covers third-party claims | Confirmed | Full, developer terms |
| The audio file's tag points to QuranicAudio.com, and the same file is on both Quran.com hosts | Confirmed for 2:255 and 114:6 | Full (the files) |
| QuranicAudio: personal use only, no commercial use, files "hand ripped from cds" | Confirmed | Full, about page |
| Apple 5.2.1: no protected third-party material without permission | Confirmed | Full, live page, updated 2026-10-16 |
| Apple 5.2.2: an app that "accesses ... or displays content from a third-party service" must be "specifically permitted ... under the service's terms"; "Authorization must be provided upon request" | Confirmed | Full, same |
| Apple 5.2.3: "Streaming of audio/video content may also violate Terms of Use" | Confirmed | Full, same |

## Flagged: rests on one researcher, a snippet or a page-reader summary

- Who owns the Minshawi recording (Egyptian Radio, 1965; Sono Cairo). **Snippet only.**
- Egyptian law 82 of 2002 and its 50-year term for recordings. **Snippet only.**
- The Complex's own App Store apps, and a 2017 news piece. **Snippets.**
- A request on Quran.com's feedback board that got no reply. **Page reader only (B).**
- Whether the reciters the Complex licenses exist as one file per verse. **Not checked.**

## Could the artwork answer flip?

One thing could. Hifth's pin file calls the pages "QCF V2 glyph outlines", shapes taken from the
Complex's font, and the Complex's fonts carry a stricter licence: no modifying without written
approval. The pinned files do not name their source. If the pinned pages were built from the
font's shapes, the answer becomes "needs permission". If they came from the Complex's
Illustrator files of the digital mus'haf, it stands.

Cheapest way to settle it: compare one pinned page with the same page in the Complex's
Illustrator bundle (a free download), or read quran-svg's history before 2026-07-13. Moving the
pin to a version whose source note names the Illustrator files would also settle it, and moves
the licence to CC BY 4.0 with credit waived, which is still fine.

## The artwork: what to change

- **The credit row** (the app's Arabic sources list):
  - what: صفحات مصحف المدينة النبوية (الإصدار الرقمي)
  - who: مجمع الملك فهد لطباعة المصحف الشريف · حوّلها إلى SVG وعدّلها مشروع quran-svg (Quranpedia)
  - licence: متاح مجانًا للاستعمال في البرامج الحاسوبية وفق شروط المجمع · لا يعني ذلك اعتماد المجمع لهذا التطبيق
  - In English: "Pages of the Madinah Mus'haf, digital edition: King Fahd Glorious Qur'an
    Printing Complex. Converted to SVG and adapted by quran-svg (Quranpedia). Free to use in
    software under the Complex's terms. This does not mean the Complex has approved this app."
  - Drop "commercial printing reserved to the Complex": it says more than the footnote does.
- **The records:** quran-svg's licence reads "CC0 1.0 at the pinned commit; upstream is CC BY 4.0
  (credit waived inside an app) since 2026-09-12". The status paragraph says the rights page is
  now only on archive.org, and links the copies. The pin file's licence pointer names the right
  file.

## The recitation: what to change

**Now, whatever route is chosen:** remove "free to listen, streamed from the Quran.com library"
from the credits. It claims a permission nobody gave. Two lines of reasoning in the sources
record also go: "Qul allows open access" was about a different resource, and "we only link it,
so there is nothing to license" does not hold under Apple 5.2.2 or Quran.com §2.3.

**Routes, side by side**

| Route | Pros | Cons | What it commits you to | For a hafiz |
| --- | --- | --- | --- | --- |
| **1. Recitation off in the store build until a route is approved; kept in the private build** (do now) | Clean for review today; no spend | The store app ships with no recitation at first | A switch per build, and a test that the store build carries no audio address | Store readers cannot listen along yet |
| **2. Register with Quran Foundation** (recommended next) | Written terms that cover audio; the supported path; its credit line is spelled out | Needs a server holding the secret key; cache a week or less; QF promises nothing about the recording's own rights | A small server or a scheduled sync, the credit line, the policy pages | The same Minshawi, verse by verse, once built |
| **3. Ask Quran.com in writing** | A direct yes satisfies Apple's "authorization on request" | Only the owner can send it; an earlier request reportedly got no reply; may point to route 2 | Waiting on a reply | The same Minshawi, if they say yes |
| **4. alquran.cloud** | No account or key; written terms allow streaming | "Personal and educational use" may not cover a store app; reciters "may ask you to remove them" | Its credit, caching on our side, a plan for a removal request | The same Minshawi, with a risk of removal later |
| **5. A reciter the Complex licenses** | Licensed for free use in apps, worldwide | Not Minshawi; one file per verse not checked | Finding a per-verse source, its own credit | A different voice; some huffaz revise with one reciter's pacing |
| **6. Other mirrors** | Easy | No clear written permission; the same chain of copies | The same open questions as today | No safer |

Recommended: route 1 now, route 2 as the way to ship recitation. Who owns the recording itself
stays an open question under every route.
