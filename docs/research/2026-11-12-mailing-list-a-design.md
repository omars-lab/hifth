# The "tell me when the Mac app is out" list: what to build (researcher A, design)

Written 2026-11-12 by researcher A. The evidence behind each line is in
`2026-11-12-mailing-list-a-findings.md`; numbers in brackets point there. A second researcher
answered the same question separately, and a checker will merge the two.

## The short version

- **Where the list lives:** in Supabase, as decided. The front page's sign-up code writes to it
  through two small database functions. The code can add a row or remove one, and cannot read the
  list. Only the owner's laptop can read the list.
- **What sends the mail:** Resend's free plan, from `news.hifth.app`. Replies go to the owner's
  iCloud address. A small script on the owner's laptop reads the list and sends it in batches of
  100.
- **iCloud keeps hifth.app's mail.** Resend's records all sit under the `news` subdomain, so
  iCloud's records are not touched [3.1, 2.8].
- **DNS changes:** three records for Resend, plus a DMARC record at the root, which is missing
  today [2.6].
- **Cost:** nothing, as long as the launch goes to 100 people a day or fewer. If the list is in
  the hundreds or thousands on launch day, one paid month of Resend ($20) sends it all at once,
  then cancel [3.1].
- **Supabase must be kept awake.** A free project pauses after a week of low use, and the form
  alone will not keep it awake. A free Cloudflare timer job pings it once a day [4.1, 1.9].
- **Three things to fix before the first email**, whichever sender is chosen:
  1. **The leave link** must not delete on a plain visit [6.2].
  2. **The privacy page** must say where the list now lives [6.3].
  3. **The sign-up wording** promises one email, so "a few updates a year" needs its own tick
     box [6.1].

```mermaid
flowchart LR
  F[Front page form] -->|spam check passes| P[Sign-up code on hifth.app]
  P -->|"add me" or "remove me" only| S[(List in Supabase)]
  T[Daily timer on Cloudflare] -->|tiny ping| S
  L[Script on the owner's laptop] -->|reads the list| S
  L -->|batches of 100| R[Resend]
  R -->|from news.hifth.app| I[Reader's inbox]
  I -->|reply| A[Owner's iCloud inbox]
  I -->|unsubscribe button| P
```

## What gets decided here, and what does it change for a reader?

- **What is decided:** where the sign-up addresses are kept, and what sends the few emails to
  them.
- **For a reader:** the email arrives from Hifth, in their language, with a working "leave" link.
  Nobody else uses their address. Nothing tracks whether they opened it.
- **What happens if nobody decides:** sign-ups keep going into a table that the page says is in
  Cloudflare. Nothing can send the launch email on the day.

## Where does the list live, and how does a sign-up reach it?

**The table.** One table in its own schema, not the public one, so the shared web API never lists
it. It holds:
- the email (unique) and the date it was added;
- the leave code, already in the design;
- **the language the reader signed up in**, which is new [6.5];
- **when they confirmed**, which is new and empty until they click the confirm link (see the
  double opt-in section below);
- **whether they also want occasional updates**, which is new and off unless they tick it [6.1].

**Two small database functions** do the writing:
- one adds an address (or says it was already there);
- one removes the row that matches a leave code.

The sign-up code on hifth.app calls them with Supabase's public ("publishable") key, kept as a
Pages secret anyway. Row-level security, meaning per-row rules in the database, is on, and the
public key has no direct right to the table, so it can never read an address [4.3, 4.4].

**Why not the "secret" key in the sign-up code?** That key skips every per-row rule in the whole
project, and this project also holds the privately kept Qur'an library [4.3]. A leak from the
website should be able to add a row and nothing else. The secret key stays on the owner's laptop,
for the send script only.

**Why functions and not a plain insert?** A plain insert either needs read rights to say "already
on the list", or has to stop saying it [4.4]. The function answers yes or no without handing out
read rights.

**Changes to today's code.** The handler in `apps/landing/lib/notify.mjs` (landing worktree) swaps
its Cloudflare database call for a call to each function. The Turnstile check, the answers in
both languages, and "the leave link says the same whether or not it matched" all stay as they are
[4.5].

## How does Supabase stay awake until the launch?

**The problem.** Supabase pauses a free project after about a week of low use. A paused project
fails new writes until the owner presses "resume" [4.1]. A sign-up form that gets no visitors
for a week is exactly that low use.

**The fix.** A tiny Cloudflare Worker with a daily timer calls a do-nothing database function
once a day. The free Workers plan allows five such timers [1.9]. A Pages project is not shown to
run on a timer, so this is a separate small Worker [1.9].

**Whether Supabase allows it.** Supabase's terms and use policy say nothing about this. Its own
pausing page says "a few user requests to the database each day" is enough [4.2]. So it is not
forbidden today, but Supabase could change that.

**The backstop.** If the write fails, the form says "try again in a few minutes", as it already
does for the spam check. Supabase emails the owner a week before a pause [4.1].

**The way out if it fails.** Supabase's paid plan never pauses [4.1].

## What sends the launch email?

### Which ways are there?

The options, side by side. "Holds the list" means a copy of the addresses lives somewhere
besides Supabase.

| | **A. Resend, list stays in Supabase** | **B. Amazon SES, list stays in Supabase** | **C. A newsletter service (Kit, Brevo, Buttondown)** | **D. Cloudflare's own sending** | **E. Send from iCloud by hand** | **F. Run Listmonk yourself** |
| --- | --- | --- | --- | --- | --- | --- |
| **Free limit** | 100 a day, 3,000 a month [3.1] | none free; about 10 cents per 1,000 [3.8] | Kit 10,000 people; Brevo 300 a day; Buttondown 100 people [3.2-3.5] | none on the free plan; paid plan gives 3,000 a month [1.3] | 1,000 a day [2.3] | the software is free; the machine is not [3.9] |
| **Pros** | Ten-minute setup. List stays ours. Tracking off by default. Records on a subdomain, so iCloud is untouched [3.1] | Cheapest at any size; no daily cap once approved [3.8] | Editor, archive, built-in unsubscribe and double opt-in; Kit free to 10,000 [3.5] | Same company as the site; records on a subdomain [1.8] | Nothing new to set up | Full control, double opt-in built in [3.9] |
| **Cons** | Over 100 on the day means spreading over days or one $20 month [3.1]. Data kept in the US [3.1] | An AWS account, a review that takes up to 96 hours, and more DNS records [3.8] | A second copy of the list, which goes out of step with Supabase. Their footer on free mail [3.2-3.7] | Paid plan needed; still beta; its FAQ says no marketing mail [1.3, 1.5] | Personal-use terms forbid bulk mail; no unsubscribe header; harms the owner's own mail if marked as spam [2.3, 2.4] | Needs a server that is always on, which is not free and not on Cloudflare [3.9] |
| **Commits us to** | A send script and a Resend key on the laptop | An AWS account to look after | Keeping two lists in step, and their privacy terms on our page | Cloudflare changing its rules, and $5 a month | Hand work, each time | Running a server |

**I recommend A, Resend with the list kept in Supabase.** It is the only option that is free at
our size, keeps the list in one place, leaves iCloud alone, and is allowed to send a launch
announcement.

### How big a list changes it?

| Addresses on launch day | With Resend | Cost |
| --- | --- | --- |
| Up to 100 | one batch, same day | $0 |
| 100 to 3,000 | either one batch a day over several days, or one paid month that sends it all at once, then cancel | $0, or $20 once |
| Over 3,000, or regular updates | switch the send script to Amazon SES (option B); the script and list do not change, only who it hands the mail to | about 10 cents per 1,000 |

Resend's free marketing tool would send to 1,000 people at once for free, but only from a copy of
the list held in Resend [3.1]. That is the second copy option C warns about, so it is not
recommended.

## How does it share hifth.app with iCloud?

- **iCloud keeps the root domain:** its MX, SPF and DKIM records stay exactly as they are [2.1,
  2.5].
- **Resend gets the `news` subdomain.** Mail goes out from a "news" address at news.hifth.app,
  and Resend's records sit under that name [3.1]. Resend itself recommends a subdomain. It also
  means a launch day with a few spam reports does not dent the owner's personal hifth.app mail.
- **Replies still reach the owner.** news.hifth.app has no mailbox, so every email sets
  "Reply-To" to the owner's iCloud address at hifth.app.
- **DMARC passes** because Resend signs as news.hifth.app, which lines up with the From address
  [2.8].
- **Root SPF stays at about 6 of its 10 lookups**, since Resend adds nothing there [2.7].

## What DNS changes does it need?

All are added in Cloudflare, which answers for hifth.app [2.5].

1. **MX on `send.news`**, value from Resend. This handles bounces [3.1].
2. **SPF TXT on `send.news`**, value from Resend [3.1].
3. **DKIM TXT on `resend._domainkey.news`**, value from Resend [3.1].
4. **DMARC TXT on `_dmarc`**, new and at the root: `p=none` to start (watch only), with reports
   to the owner's iCloud address. This covers iCloud's mail too. Tighten it after a few weeks of
   clean reports [2.6, 5.5].
5. **Optional:** drop the registrar's forwarding include from the root SPF, after checking
   nothing still forwards through it. It looks left over from before iCloud [2.5, 2.7].

## Is a confirmation email (double opt-in) needed?

**Not by law, but it is recommended.** No law found requires it in so many words [5.4]. It is how
we can show that each person asked [5.3], and it stops someone signing up an address that is not
theirs.

**How it works here.** The sign-up code sends one confirmation email through Resend, a one-to-one
message the reader asked for, which counts as transactional [5.1]. Only confirmed rows get the
launch email. Unconfirmed rows are deleted after 30 days. At tens of sign-ups a day, this fits
the free 100 a day [3.1].

**The cost.** Some people never click. It is the owner's call (see the decisions below).

## What must each email carry?

- **A one-click unsubscribe.** Two headers, `List-Unsubscribe` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, pointing at the leave address [5.6, 3.1].
  The leave address changes [6.2]:
  - a POST removes the row;
  - a plain visit shows a page with a "Take me off" button, so a mail scanner opening the link
    removes nobody.
- **A visible leave link** in the body.
- **A postal address.** A launch email promotes a product, so CAN-SPAM wants one in each message.
  A US Post Office box or a registered private mailbox both count [5.1]. Their prices were not
  checked.
- **Both languages,** or the reader's own once the language column exists [6.5].
- **No tracking.** Resend's open and click tracking stays off, as it is by default [3.1].

## What does the TestFlight invite look like?

**Recommended: a public link in our own email.** TestFlight's public link needs no addresses
handed to Apple. We put it in an email to the list [6.4].

**The other way.** Adding testers by email means uploading addresses to App Store Connect. The
privacy page would then have to say Apple holds them [6.3].

## What does it cost?

| Item | Cost |
| --- | --- |
| Supabase free plan, kept awake by the timer | $0 |
| Cloudflare timer Worker | $0 (free plan, 1 of 5 timers) [1.9] |
| Resend free plan | $0 up to 100 a day [3.1] |
| A launch over 100 sent in one day | $20 for one month [3.1] |
| Postal address for the footer | a PO box or mailbox service; price not checked [5.1] |

## What does the owner have to do?

1. **Decide two things** (see the decisions below).
2. **Make a Resend account** and add news.hifth.app as its domain.
3. **Add the four DNS records** above in Cloudflare.
4. **Run the table and function setup** in the Supabase project.
5. **Put two values in the Pages project's secrets:** the Supabase address and the publishable
   key. Put the Resend key there too, for the confirmation email.
6. **Keep the Supabase secret key and a second Resend key on the laptop only**, in the usual
   encrypted secrets file, for the send script.
7. **Get a postal address** for the email footer.
8. **Approve the new privacy page wording.** It should say:
   - the list is kept in Supabase, in the United States;
   - Resend sees each address when sending, also in the US [3.1];
   - what the confirmation email is.

Nothing here needs a card, unless the launch day is over 100 people and the owner wants it sent
at once.

## Which decisions are the owner's?

- **Ask for a confirmation click (double opt-in)?**
  - **Yes:** proof of consent, and no pranks.
  - **No:** a few more people get the launch.
  - Recommended: yes.
- **Allow "a few updates a year"?**
  - **Yes:** an unticked box on the form, its own column, and a line on the privacy page. Only
    people who tick it get updates [6.1].
  - **No:** the list is deleted after the launch and the TestFlight invite.

## What would change the answer?

- **More than 1,000 confirmed people on launch day, or regular updates:** move the send script
  to Amazon SES (option B). It is cheaper at volume and has no daily cap.
- **Cloudflare drops "transactional only" and leaves beta:** Cloudflare sending (option D)
  becomes a fair choice, for $5 a month on the paid plan.
- **Supabase forbids daily pings, or the project pauses anyway:** pay for Supabase, or keep
  sign-ups somewhere that does not sleep and copy them into Supabase.
- **Resend changes its free plan:** the send script hands mail to SES instead. The list does not
  move.
- **The owner wants a newsletter with an archive and an editor:** Kit or Buttondown (option C),
  accepting a second copy of the list.

## What is this not settling?

- The words of the launch email.
- The timing of the launch.
- Whether the iPhone app gets the same list. The privacy page already mentions both apps [6.1].
