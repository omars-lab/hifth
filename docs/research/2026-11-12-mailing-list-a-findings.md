# The "tell me when the Mac app is out" list: what we found (researcher A, findings)

Written 2026-11-12 by researcher A. A second researcher answered the same questions separately;
a checker will merge the two. The recommendation built on this is in
`2026-11-12-mailing-list-a-design.md`.

How to read the tags:

- **fetched** means the page itself was opened and read today (2026-11-12).
- **snippet only** means only a search-result summary was seen, not the page.
- **looked up today** means a public DNS lookup run from this laptop today.
- **not checked** means we did not look, so the point is open.
- Page dates are given where the page shows one.

## The short version

- **Cloudflare cannot send the launch email for free, and says it should not send it at all.**
  Its sending service (Cloudflare Email Service, "Email Sending") is still in public beta. Sending
  to any address needs the paid Workers plan. Its FAQ says it is for transactional mail only, "No"
  to marketing mail [1.3-1.6].
- **Cloudflare's mail forwarding (Email Routing) cannot run on hifth.app while iCloud holds the
  mail records.** It refuses to start while another provider's MX records exist [1.7].
- **iCloud+ is for personal mail.** It allows 1,000 messages a day and 500 recipients a message,
  and its terms forbid bulk or unsolicited mail [2.3-2.4].
- **Resend is the best free fit for "we keep the list, they send it".** Its free plan allows
  3,000 emails a month and 100 a day through the sending API. Its sending records sit on a
  subdomain, so iCloud's records stay as they are. Tracking is off unless turned on [3.1].
- **Supabase pauses a free project after about a week of low use.** A sign-up form that gets no
  visits for a week will not keep it awake [4.1].
- **The sign-up promises one email.** The form says "We'll write once", and the privacy page
  says the address is used for one thing. "A few updates a year" is not covered by that [6.1].
- **The leave link deletes on a plain page visit.** Mail scanners open links on their own, and
  the one-click unsubscribe rule needs a POST [5.6, 6.2].
- **hifth.app has no DMARC record today** [2.6].

## 1. Can Cloudflare keep a mailing list or send bulk mail?

1.1 **Cloudflare Email Service has two halves.** "Email Sending" sends mail and "Email Routing"
receives it. Sending is marked Beta. The intended use is "account emails, order confirmations,
and alerts".
Source: https://developers.cloudflare.com/email-service/ (fetched; last updated Oct 15, 2026).

1.2 **The changelog shows it is still in beta.** Its entries say "Email Sending now in public
beta" (Apr 16, 2026) and "Authenticated SMTP submission now available in beta" (Jun 8, 2026). No
entry marks it generally available.
Source: https://developers.cloudflare.com/changelog/product/email-service/ (fetched).

1.3 **Free sending needs the paid plan.** There are 3,000 outbound emails a month, per account,
"included with the Workers Paid plan". Then $0.35 per 1,000. "Workers Free doesn't include
outbound sending." Sends to verified destination addresses, meaning the owner's own inboxes, are
free on all plans. Hard bounces count toward the quota.
Source: https://developers.cloudflare.com/email-service/platform/pricing/ (fetched; last updated
Jun 9, 2026).
The Workers Paid plan price itself is not checked here.

1.4 **Cloudflare publishes no fixed daily quota.** New accounts start on "a conservative quota"
that rises with good sending. Each email can have 50 recipients and be 25 MiB at most. Before a
sending domain is onboarded, it can send only to verified addresses; after, to anyone. "All email
sending must follow applicable anti-spam laws", and it names CAN-SPAM, GDPR and CASL.
Source: https://developers.cloudflare.com/email-service/platform/limits/ (fetched; last updated
Oct 30, 2026).

1.5 **Marketing mail is not allowed.** "Can I use Email Service for marketing emails? No. Email
Service supports transactional email only."
Source: https://developers.cloudflare.com/email-service/reference/faq/ (fetched; last updated Oct
15, 2026). A search summary said Cloudflare plans bulk tooling later (snippet only).

1.6 **The older Email Workers send_email binding has the same limits.** It allows up to 50
recipients, a 25 MiB message, and a binding can be held to a list of allowed recipients. Its
error codes include a sending rate limit and a daily quota.
Source: https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/
(fetched; last updated Oct 30, 2026).

1.7 **Email Routing cannot share the root domain with iCloud.** Onboarding fails with error
2008, "Non-Cloudflare MX records exist", and the page says "Cannot use Email Routing with external
mail servers". The old provider's MX records must be deleted first. Email Routing also wants its
own SPF include and a DKIM record at `cf2024-1._domainkey`.
Source: https://developers.cloudflare.com/email-routing/setup/email-routing-dns-records/
(fetched; last updated Oct 30, 2026).

1.8 **Email Sending's records sit on a `cf-bounce` subdomain.** They are an MX, an SPF and a
DKIM key on `cf-bounce`, plus a DMARC record at `_dmarc`. The page does not say outright that
sending works while the root MX points elsewhere. Since none of its records touch the root MX, it
very likely does, but that is our inference, not the page's.
Source: https://developers.cloudflare.com/email-service/configuration/domains/ (fetched; last
updated Oct 30, 2026).

1.9 **Scheduled jobs are free on Cloudflare Workers.** The Workers Free plan allows 5 cron
triggers per account and 100,000 requests a day.
Source: https://developers.cloudflare.com/workers/platform/limits/ (fetched; last updated Oct 29,
2026).
The cron page documents a `scheduled()` handler on a Worker. It does not mention Pages Functions,
so a Pages project on its own cannot be assumed to run on a timer.
Source: https://developers.cloudflare.com/workers/configuration/cron-triggers/ (fetched; last
updated Oct 17, 2026).

## 2. What does iCloud+ Custom Email Domain set, and what does it allow?

2.1 **Apple's setup changes MX, TXT and CNAME records.** They are:
- a personal verification TXT at the root;
- SPF `v=spf1 include:icloud.com ~all`, or the include added to an existing SPF record;
- two MX records at priority 10, for Apple's two mail servers;
- a DKIM CNAME at `sig1._domainkey`, pointing at Apple.

Apple's step 3 is "Delete your existing MX records". The page says nothing about using a second
sending service alongside.
Source: https://support.apple.com/en-us/102374 (fetched; published November 03, 2026).

2.2 **A domain can have up to 10 addresses.** One person can use up to five custom domains, and
can share a domain with up to five other people.
Source: https://support.apple.com/en-us/102540 (fetched; published November 11, 2026).

2.3 **Sending limits.** iCloud allows 1,000 messages a day, 1,000 recipients a day, 500 recipients
per message, and 20 MB per message. The service is for personal use, and "Sending unsolicited
bulk email messages through iCloud email servers is prohibited."
Source: https://support.apple.com/en-us/102198 (fetched; published March 17, 2025).

2.4 **iCloud's terms.** Users may not send "unsolicited or unauthorized email ... promotional
materials, junk mail, spam ... including, without limitation, bulk commercial advertising". The
terms also say "the Service is designed and intended for personal use on an individual basis".
Source: https://www.apple.com/legal/internet-services/icloud/ (fetched; last revised September
14, 2026).
Reading this, a one-off launch note to a few dozen people who asked for it is not obviously
forbidden. A list of hundreds sent from iCloud is outside "personal use", and iCloud cannot add
the unsubscribe headers that Gmail expects (item 5.5).

2.5 **hifth.app's mail records today** (looked up today; record values not copied here because
they include verification codes):
- **Who answers for the domain's records:** Cloudflare.
- **MX:** the two Apple mail servers.
- **DKIM:** Apple's key at `sig1._domainkey`.
- **SPF:** one record with two includes. One is `icloud.com`. The other is the registrar's
  email-forwarding service, which looks left over from before iCloud took the mail.

2.6 **No DMARC record exists at `_dmarc.hifth.app`** (looked up today).

2.7 **The root SPF uses about 6 of its 10 allowed lookups.** It is one each for the two
includes. iCloud's include then redirects once and expands into three more includes (looked up
today). Adding one more service at the root, such as Amazon SES's include, would make about 7.
Dropping the leftover registrar include would save one. A service whose SPF sits on its own
subdomain, as Resend's and Cloudflare's do, adds nothing to the root count.

2.8 **How a second sender shares the domain.**
- **DKIM:** each service gets its own key under its own name (Apple uses `sig1`, Resend uses
  `resend`), so two can live side by side.
- **SPF:** there is only one SPF record per name. A second service either merges its include into
  the root record (counting toward the 10 lookups) or uses its own bounce subdomain.
- **DMARC:** DMARC passes when the From domain lines up with either the SPF domain or the DKIM
  domain. Gmail states that rule for bulk senders (item 5.5). So a service that signs DKIM as
  hifth.app passes DMARC even when its SPF sits on a subdomain.

Sources for this item:
- the Apple and Cloudflare pages above (fetched);
- Resend's DNS guide (item 3.1, fetched);
- the 10-lookup rule, as stated on Cloudflare's DNS page (item 1.7, fetched). RFC 7208 itself
  was not opened.

## 3. Which free services could send the announcement?

### 3.1 Resend

**Free plan.**
- **Sending API:** 3,000 emails a month, "limited to 100 emails per day", 3 custom domains,
  30 days of logs.
- **Marketing (Broadcasts):** "not limited by the number of emails sent, only by the number of
  contacts", up to 1,000 contacts a month.

Source: https://resend.com/pricing (fetched).

**The two quotas count separately.** The daily and monthly quotas apply to the sending API only,
and they include received emails. Broadcasts count against contacts instead. The free plan allows
10 requests per second.
Source: https://resend.com/docs/knowledge-base/account-quotas-and-limits (fetched).

**Paid plans.** The sending API's paid plan is $20 a month for 50,000 emails with "No limit"
per day. Marketing's paid plan is $40 a month for 5,000 contacts. "Self-serve plans are billed
monthly only." The pricing page says nothing about a footer or branding on free mail.
Source: https://resend.com/pricing (fetched). Free-plan branding is **not checked**.

**Batches.** One call can carry up to 100 emails, each with its own headers.
Source: https://resend.com/docs/api-reference/emails/send-batch-emails (fetched).

**Unsubscribing.**
- For mail sent through the API, "Resend doesn't manage contact lists for transactional
  emails". The sender adds its own `List-Unsubscribe` header.
- For bulk mail, add `List-Unsubscribe-Post: List-Unsubscribe=One-Click` too. The address
  should answer a POST with a blank 200 or 202, show the normal page on a visit, and stop
  sending within 48 hours.

Source: https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails
(fetched). The Broadcasts page says contacts must be in Resend, in a segment, before a Broadcast
can go out.
Source: https://resend.com/docs/dashboard/broadcasts/introduction (fetched; no date).
Resend's "Handle unsubscribes" guide for Broadcasts could not be opened (404), so how Broadcasts
add the unsubscribe link is **not checked**.

**DNS records.** Resend asks for an MX and an SPF TXT on `send`, and a DKIM TXT at
`resend._domainkey`. "None of these sit at the root domain." It recommends "sending your emails
from one or more subdomains".
Sources: https://resend.com/docs/dashboard/domains/cloudflare (fetched) and
https://resend.com/docs/dashboard/domains/introduction (fetched).

**Tracking.** "Open and click tracking is disabled by default for all domains."
Source: https://resend.com/docs/dashboard/domains/tracking (fetched).

**Where data is kept.** "All account data, including email metadata, logs, and API records, is
stored in the United States". The sending region (North Virginia, Ireland, Sao Paulo, Tokyo)
only changes where mail leaves from.
Source: https://resend.com/docs/dashboard/domains/regions (fetched; no date). A search summary
said non-US sending regions may need a paid plan, while a changelog said free users can use any
region (snippet only).

**Double opt-in:** Resend has no built-in double opt-in for API sends. We would send the
confirmation ourselves (our reading of the unsubscribe page above; **not checked** further).

### 3.2 Brevo

**Free plan.** "Once we approve your account for sending, you can start sending up to 300 emails
per day." Removing the "Sent with Brevo" footer is a feature of the paid plans; the Starter plan
starts at $9 a month for 5,000 emails.
Source: https://www.brevo.com/pricing/ (fetched in a browser; plain fetch returned only the
title).

**Contacts.** The free contact limit could not be read on the page. Search summaries disagree
between "unlimited" and "100,000" (snippet only).

**Not checked:** the sending API on the free plan, double opt-in, and where data is kept.

### 3.3 Buttondown

**Free plan.** Free for "your first 100 subscribers". Sending from a custom domain is included.
Pricing assumes "at most one email a day to your entire subscriber base". Whitelabeling is a
paid add-on at $79 a month.
Source: https://buttondown.com/pricing (fetched).

**API.** The API can add subscribers and send emails.
Source: https://docs.buttondown.com/api-introduction (fetched). The page does not say whether the
API is on the free plan.

**Not checked:** branding on free mail, and where data is kept. Buttondown keeps the list
itself.

### 3.4 MailerLite

**Free plan.** "Up to 250 subscribers", "2,500 monthly emails". "On Free, API and MCP access is
limited and doesn't include sending." Logo removal appears only in the paid plans, so free mail
very likely carries it.
Source: https://www.mailerlite.com/pricing (fetched).

**List.** MailerLite keeps the list. Sending through its API with our own list is not possible
on the free plan.

### 3.5 Kit (formerly ConvertKit)

**Free plan.** "Up to 10,000" subscribers, "no sending limits on any of our plans". The API is
included on the free plan. Removing Kit branding needs a paid plan.
Source: https://kit.com/pricing (fetched).

**List.** Kit keeps the list. Its API can import subscribers, so a copy from Supabase is
possible.

**Not checked:** double opt-in, and where data is kept.

### 3.6 EmailOctopus

**Free plan.** "2,500 subscribers", "10,000 emails per month", "EmailOctopus branding on
emails".
Source: https://emailoctopus.com/pricing (fetched).

**Not checked:** the API and own-domain sending on the free plan. The help page tried returned
only a note on API keys.
Source: https://help.emailoctopus.com/article/165-free-plan-limits (fetched; off topic).

### 3.7 Mailchimp

**Free plan.** "Limit of 250 contacts", "Max of 500/mo or 250/day". "Remove Mailchimp Branding"
is not included on free.
Source: https://mailchimp.com/pricing/marketing/ (fetched).

**Not checked:** the API on the free plan.

### 3.8 Amazon SES

**Price.** Pay-as-you-go ("a la carte") is $0.10 per 1,000 emails, or $0.16 per 1,000 on the
"Essentials" plan. New accounts start on Essentials from July 21, 2026, and can switch. New AWS
customers get up to $200 in free credits, used within 12 months. The page lists no separate SES
free email allowance.
Source: https://aws.amazon.com/ses/pricing/ (fetched).

**Sandbox.** New accounts are in a "sandbox":
- they can send only to verified addresses;
- at most 200 messages in 24 hours, 1 a second.

Getting out means a request naming "Marketing" or "Transactional" and the website. It also means
agreeing to "only send email to individuals who've explicitly requested it" and to having a way
to handle bounces and complaints. AWS replies within 96 hours.
Source: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html (fetched).

**DNS and the list.** SES's DNS records (DKIM keys and a custom bounce subdomain) were **not
checked** today. SES keeps no list; we would keep it and send.

### 3.9 Listmonk (run it yourself)

**What it is.** A "Self-hosted newsletter and mailing list manager", a "single binary alongside a
Postgres database". It sends through one or more mail servers (SMTP) with rate limiting, and
handles single and double opt-in lists.
Source: https://listmonk.app/ (fetched).

**Not checked:** the licence name. Listmonk needs a machine that is always on, and it would keep
its own subscriber tables. Pointing it at the Supabase database is not covered by its page.

## 4. Supabase in practice

4.1 **Pausing.**
- "Supabase pauses Free Plan projects that show low activity over a 7-day period".
- "Typically a few user requests to the database each day over the previous week is enough".
- Visiting the project in the dashboard, or API calls, count as activity.
- The owner gets an email about a week before and again at the pause.
- A paused project can be resumed from the dashboard for up to 1 year. "Paid projects cannot be
  paused".

The page does not say what a write to a paused project gets back.
Source: https://supabase.com/docs/guides/platform/free-plan-pausing (fetched; no date).
A third-party guide says a paused project answers with a server error or times out (snippet
only).

4.2 **Keep-alive pings.** Supabase's pausing page neither allows nor forbids them.
- **Terms of service:** no rule on getting around limits or pausing, and no "circumvent".
  Supabase may apply "usage caps, or throttling".
  Source: https://supabase.com/terms (fetched; no date shown).
- **Acceptable use policy:** forbids "an excessive number of accounts as a single user" without
  permission, proxy farms that dodge rate limits, and use that "materially degrades" the service.
  It says nothing on pings.
  Source: https://supabase.com/aup (fetched; "Version 1, June 1, 2026").
- **Other people's practice:** third-party guides describe a daily scheduled ping as the usual
  workaround, and one warns that a timer inside the database stops when the project pauses
  (snippet only).

4.3 **Keys.**
- The new "publishable" key is safe in a browser and limited by row-level security, meaning
  per-row rules in the database.
- The new "secret" key is for backends only, and "A secret key bypasses every Row Level Security
  policy you have."
- The old "anon" and "service_role" keys are being retired "by the end of 2026".
- The page advises a separate secret key per backend part, kept in the platform's secret store.

Source: https://supabase.com/docs/guides/api/api-keys (fetched; no date).

4.4 **Row-level security.** "once RLS is enabled, no data is accessible through the API when
using a publishable key, until you create policies." Insert rules use `with check`.
Source: https://supabase.com/docs/guides/database/postgres/row-level-security (fetched; no date).
An insert that asks for the new row back also needs read permission. Asking for no reply
("return=minimal") avoids that (snippet only, from PostgREST discussion threads).

4.5 **This project's sign-up code today.** The form code is in the landing worktree on the
`mistake-kinds` branch, not on main. The files are `apps/landing/functions/api/notify.js` and
`unsubscribe.js`, which call `apps/landing/lib/notify.mjs`, plus `schema.sql`. They are
JavaScript, not the `.ts` file named in the brief (read today in that tree, not changed).
The code:
- checks Turnstile once;
- inserts and ignores a duplicate, then answers "already on the list" or "you're on the list";
- the leave link deletes on a GET and says the same whether or not it matched.

The form also sends the reader's language (English or Arabic), and the leave link carries it.
The table has no column for language, so the launch email cannot know which language to write
in.

## 5. Rules for the mail itself

5.1 **CAN-SPAM's address rule.** Every commercial message "must include your valid physical
postal address". That can be a street address, "a post office box you've registered with the
U.S. Postal Service", or "a private mailbox you've registered with a commercial mail receiving
agency".
- **Opt-out:** the link must work for at least 30 days after sending, and requests must be
  honoured within 10 business days.
- **Penalty:** up to $53,088 per email.
- **Commercial or not:** a message is "commercial" when its primary purpose is advertising or
  promoting a commercial product or service. Transactional messages are read narrowly.

Source: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
(fetched; August 2023, edited January 2024).
Our reading: a "the Mac app is out" email promotes a product, so treat it as commercial and
include an address. A confirmation email the reader asked for is transactional.

5.2 **UK (PECR).** You may email individuals marketing only if they "have specifically consented
to receiving emails". Each message must give "a valid contact address so they can opt out or
unsubscribe". The page does not mention double opt-in, and notes the guidance is under review
because of the Data (Use and Access) Act.
Source:
https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/
(fetched; no date).

5.3 **GDPR Article 7.**
- 7(1): "the controller shall be able to demonstrate that the data subject has consented".
- 7(3): withdrawing consent must be "as easy to withdraw as to give consent".

Source: https://gdpr-info.eu/art-7-gdpr/ (fetched).

5.4 **Is double opt-in required?** No law found requires it in so many words. It is the usual way
to prove consent (7(1)), and German courts are strict about consent, so it is close to expected
there. A law firm summary says it is not a "must" under the GDPR but recommended (snippet only:
Reed Smith via search). Vendor blogs claim it is required in Germany (snippet only, treat with
care).

5.5 **Gmail's rules.**
- **Every sender:** SPF or DKIM, a spam rate under 0.3%, and TLS.
- **Senders of more than 5,000 a day:** SPF and DKIM and DMARC, a From domain that lines up with
  one of them, and "must support one-click unsubscribe".

Source: https://support.google.com/a/answer/81126 (fetched; no date, in force since February 1,
2024).
We will be far below 5,000 a day, but meeting the bulk rules anyway costs little.

5.6 **One-click unsubscribe (RFC 8058).**
- The header must be `List-Unsubscribe=One-Click`.
- Mail apps unsubscribe with an HTTPS POST, which "MUST NOT include cookies".
- Both headers "MUST be covered by the signature" (DKIM).
- Why POST: "anti-spam software often fetches all resources in mail header fields automatically,
  without any action by the user."

Source: https://datatracker.ietf.org/doc/html/rfc8058 (fetched).
So a leave link that deletes on a plain visit can remove people who never clicked.

## 6. Other things that change the choice

6.1 **The consent on file is for one email.** The form's answers say "We'll write once, when the
Mac app is out." The privacy page (landing worktree, `apps/landing/privacy.html`) says the address
is used "for one thing: to write when the Mac and iPhone apps ship, and perhaps to invite you to
try them early", and "we do not add you to anything else". The brief's "a few updates a year" is
not covered, so for people already on the list it needs fresh consent. Read today in the landing
tree.

6.2 **The leave link needs to change.** Today a GET deletes the row. Mail scanners fetch links,
and one-click unsubscribe needs a POST to the same address. A visit should show a "you're off"
page with a button, or delete on POST only (items 5.6, 3.1).

6.3 **The privacy page is wrong now.** It says the list "is stored in Cloudflare's database". With
Supabase holding the list and a sender seeing every address at send time, it needs to name both.
If testers are added to TestFlight by email, Apple holds the addresses too.

6.4 **TestFlight invites.**
- Testers added by email "will receive an invitation email". The page does not say who sends it.
  Our reading is that it is App Store Connect, not us (inference).
- A public link sends no email; you share it yourself.
- Up to 10,000 external testers per app, and the first build needs TestFlight App Review.

Source:
https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers
(fetched; no date). So a TestFlight invite can be a public link inside our own launch email, with
no addresses given to Apple.

6.5 **Language.** The form is in two languages, and the table cannot say which one each reader
used (item 4.5). Without a language column, the launch email has to be in both languages.

6.6 **The Supabase project is on its own account.** The owner has other Supabase accounts. The
acceptable use policy's "excessive number of accounts" line (item 4.2) is worth knowing, though
two or three accounts for separate projects is unlikely to be "excessive" (our reading).
