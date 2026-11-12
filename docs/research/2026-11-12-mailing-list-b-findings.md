# Who keeps the "tell me when the Mac app is out" list, and what sends the email? (raw findings, researcher B)

Searched on 2026-11-12, for the sign-up form on the new hifth.app front page.
This file is the raw record: one entry per source, its address, whether the page itself was opened ("fetched") or only a search result was seen ("snippet only"), the page's own date where it shows one, and what it says that matters here.
The design note built on it is the sibling file, the mailing-list-b design note.

**The short version.**

- Cloudflare can send mail to anyone only on its paid Workers plan ($5 a month, 3,000 emails included), and that sending service is still a public beta. Cloudflare's receiving service cannot be switched on for hifth.app at all while Apple's iCloud holds the domain's incoming mail.
- iCloud+ can send 1,000 messages a day from a hifth.app address, but its terms are for personal use, and one message to many people cannot carry each person's own leave link.
- Of the free sending services, Resend lets us keep the list in Supabase and send through its API, with tracking off by default; its free plan stops at 100 emails a day.
- The newsletter services (Kit, EmailOctopus, Brevo, MailerLite, Mailchimp, Buttondown) all want to hold their own copy of the list, and most put their own name in the footer on the free plan.
- Supabase pauses a free project after about a week with little use, and a paused project refuses every request until the owner resumes it by hand.
- No law we read requires a confirmation email (double opt-in). US law needs a postal address in each marketing email and a working way to leave. The UK regulator wants a record of who agreed, when and how.

A few words, once:

- **MX record**: the DNS entry that says which server receives a domain's mail. hifth.app's points at Apple.
- **SPF**: a DNS entry listing which servers may send mail for a domain. A domain may have only one, and checking it may take at most 10 further lookups.
- **DKIM**: a signature a sending service adds to each message, checked against a public key it asks you to publish in DNS. Each service brings its own key under its own name, so keys from different services do not clash.
- **DMARC**: a DNS entry telling inboxes what to do when a message fails both checks above, and where to send reports.
- **Double opt-in**: after signing up, the person gets an email and must click a link before they count as signed up.
- **Bounce address**: the hidden return address that failed deliveries go back to. Sending services usually put it on a subdomain of their own choosing.

## What does hifth.app's mail setup look like today? (looked up live, 2026-11-12)

Looked up with `dig` from this laptop, not from any web page.

- **Incoming mail**: two MX records, both Apple's iCloud mail servers. So incoming mail for hifth.app goes to iCloud.
- **Name servers**: Cloudflare. So the domain's DNS is on Cloudflare, which Cloudflare's own mail services require.
- **SPF at the root**: one record. It includes iCloud's list and also a leftover include for the domain registrar's own mail-forwarding servers. The forwarding can no longer receive anything, because the MX records point at Apple, so that include is very likely left over from before iCloud was set up.
- **SPF lookups used**: 6 of the 10 allowed. The registrar include costs 1 and holds only plain addresses. The iCloud include costs 1, redirects once (1 more) and then pulls in three more lists (3 more), each holding only plain addresses.
- **DKIM**: iCloud's key is published under the name Apple asks for.
- **DMARC**: **none.** There is no DMARC record for hifth.app today.
- **Apple's domain-ownership TXT record**: present (its value is not copied here).

## 1. Can Cloudflare send a mailing list?

### What is Cloudflare's mail product called now, and is it finished?

- <https://developers.cloudflare.com/email-service/> — **fetched**, last updated 2026-10-15.
  - It is called **Cloudflare Email Service**, in two parts: **Email Sending** (outgoing) and **Email Routing** (incoming, the older product).
  - "Email Sending Beta sends outbound transactional emails." The examples are account emails, order confirmations and alerts. Bulk or marketing mail is not mentioned either way.
  - "Sending to arbitrary recipients requires the Workers Paid plan." On the free plan you can send only to *verified destination addresses*: addresses you have proved you own, set up through Email Routing.
- <https://developers.cloudflare.com/changelog/product/email-service/> — **fetched**. Newest entry 2026-09-25. "Email Sending now in public beta" on 2026-04-16; sending through a mail program (SMTP) in beta from 2026-06-08. **No general-availability entry** as of today.
- Search for "general availability" — **snippet only**. No source says it has left beta. One outside changelog (dated 2026-08-21) shows another company already offering it as a provider, which shows use, not maturity.

### What does Cloudflare's sending cost, and how much can it send?

- <https://developers.cloudflare.com/email-service/platform/pricing/> — **fetched**, last updated 2026-06-09.
  - Email Sending on Workers Free: "Not available."
  - On Workers Paid: "3,000 included per month, then $0.35 per 1,000 emails." The allowance is per account and resets each billing month.
  - Sends to verified destination addresses are free on all plans and do not count.
  - Bounced mail counts toward the quota. Mail refused at the API (for example, to someone on the "do not send" list) does not.
- <https://developers.cloudflare.com/workers/platform/pricing/> — **fetched**, last updated 2026-10-02. Workers Paid is "a minimum charge of $5 USD per month for an account."
- <https://developers.cloudflare.com/email-service/platform/limits/> — **fetched**, last updated 2026-10-30.
  - Daily limit: no number. "New accounts start with a conservative daily quota and scale up over time." Higher limits by request form.
  - 50 recipients per message (to, cc and bcc together).
  - Nothing bans marketing or announcement mail. "All email sending must follow applicable anti-spam laws and regulations," naming CAN-SPAM, GDPR and CASL, and asking for working leave links honoured promptly.

### What does Cloudflare's sending add to DNS, and does it clash with iCloud?

- <https://developers.cloudflare.com/email-service/configuration/domains/> — **fetched**, last updated 2026-10-30.
  - Sending puts its records on a `cf-bounce` subdomain: an MX record there for bounces, an SPF record there, and a DKIM key under that subdomain's name. Plus a DMARC record at the root (`p=none` recommended to start).
  - The page does not say sending needs or changes the root MX records. So, read from what it adds, **sending does not touch iCloud's records**. The page does not mention iCloud by name.
- <https://developers.cloudflare.com/email-service/get-started/send-emails/> — **fetched**, last updated 2026-06-25. "You must be using Cloudflare DNS to use Email Service." hifth.app is (see above).

### Can a Worker's own send-mail tool reach anyone?

- <https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/> — **fetched** (no date read).
  - The sender's domain must be verified ("Sender domain not verified" is an error).
  - A sending binding can be limited to a list of allowed recipients. The page does not itself say recipients must be verified. The pricing page above says reaching arbitrary recipients needs Workers Paid.
  - 50 recipients per message, 25 MiB per message, rate and daily limits exist but are not given here.

### Can Cloudflare Email Routing (receiving) be used while iCloud holds the MX records?

- <https://developers.cloudflare.com/email-routing/troubleshooting/> — **fetched**. Turning on Email Routing where another provider's MX records exist fails with error 2008, "Non-Cloudflare MX records exist." Email Routing needs the root domain's MX records to itself.
- <https://developers.cloudflare.com/email-service/configuration/domains/> — **fetched** (above): "Cannot use Email Routing with external mail servers."
- <https://developers.cloudflare.com/email-routing/setup/subdomains/> — **fetched**. Subdomains are switched on *from* the root domain's Email Routing settings ("a zone-level feature that applies to the apex domain"). The page does not say a subdomain can be turned on while the root's MX points elsewhere.
- **So:** no Email Routing on hifth.app while iCloud receives its mail. That also rules out the free "send to a verified address" path, which hangs off Email Routing. **Not tested in the dashboard**; this rests on the error the docs name.

### Can a Pages Function run on a timer (for keeping Supabase awake)?

- <https://developers.cloudflare.com/pages/functions/> — **fetched**, last updated 2026-04-21. Says nothing about schedules.
- Search — **snippet only**. Timed runs ("cron triggers") are a Workers feature with a `scheduled` handler. No source found saying Pages Functions have them; the pattern people describe is a separate small Worker on a timer.
- <https://developers.cloudflare.com/workers/platform/limits/> — **fetched**, last updated 2026-10-29. Workers Free allows **5** timed triggers per account and 100,000 requests a day.

## 2. iCloud+ Custom Email Domain

### What DNS does Apple ask for?

- <https://support.apple.com/en-us/102374> ("Set up an existing domain with iCloud Mail") — **fetched**, published 2026-11-03.
  - Two MX records at the root, Apple's two mail servers, priority 10 each.
  - SPF at the root: `v=spf1 include:icloud.com ~all`. "If you already have an SPF record," add `include:icloud.com` to it before `~all`, rather than making a second one.
  - DKIM: a CNAME at `sig1._domainkey`, pointing at Apple's key host with your domain in its name.
  - A personal TXT record proving you own the domain.
  - Delete existing MX records before adding Apple's. Nothing on sharing the domain with other mail services.
- <https://support.apple.com/en-us/102540> — **fetched**, published 2026-11-11. Points to the guide above; no records itself.

### How much can iCloud send?

- <https://support.apple.com/en-us/102198> ("Mailbox size and message sending limits in iCloud") — **fetched**, published 2025-03-17.
  - 1,000 messages a day; 1,000 recipients a day; 500 recipients per message; 20 MB per message (5 GB with Mail Drop).
  - "Sending unsolicited bulk email messages through iCloud email servers is prohibited."

### Do Apple's terms allow announcement mail from iCloud?

- <https://www.apple.com/legal/internet-services/icloud/> — **fetched**, last revised 2026-09-14.
  - Section V.B.7 bars sending "any unsolicited or unauthorized email, messages, advertising, promotional materials, junk mail, spam, or chain letters ... including, without limitation, bulk commercial advertising and informational announcements." The ban is on **unsolicited or unauthorized** mail; people who asked to hear about the launch did ask. So this is not a flat ban on our case.
  - Section IV.A: the service is "designed and intended for personal use on an individual basis."
  - Section V.B.10 bars "accessing the Service through any automated means, like scripts or web crawlers." So a script sending one email per person through iCloud's mail server is on the wrong side of this.
  - Not legal advice; this is what the page says.

### How can a second sending service share hifth.app with iCloud?

- <https://www.rfc-editor.org/rfc/rfc7208#section-4.6.4> (the SPF standard) — **fetched**.
  - At most 10 lookup terms (`include`, `a`, `mx`, `ptr`, `exists`, `redirect`) per check; going over fails the check outright. `ip4`, `ip6` and `all` do not count.
  - Section 3.2: only one SPF record per name. Two at the root break SPF for both services.
- <https://www.rfc-editor.org/rfc/rfc7489#section-3.1> (the DMARC standard) — **fetched**.
  - In the default ("relaxed") mode, a DKIM signature from a subdomain such as `news.hifth.app` lines up with a From address at `hifth.app`, and the other way round, because both belong to the same organisation domain.
  - SPF lines up using the hidden bounce address's domain, not the visible From. A bounce address on `send.hifth.app` lines up with a From at `hifth.app` in relaxed mode.
  - A subdomain with no DMARC record of its own falls back to the root's record (its `sp` setting, or `p` if there is none).
- **What this means in practice** (my reading of the two standards plus the live lookups above):
  - Services that put their SPF on their own subdomain (Cloudflare on `cf-bounce`, Resend on `send`) do not touch the root SPF at all, so the 10-lookup limit is not at stake.
  - Each service's DKIM key has its own name (`sig1` for Apple, `resend` for Resend, a Cloudflare-managed name under `cf-bounce`), so the keys sit side by side.
  - One DMARC record at the root covers everything, including subdomains.
  - Sending from a subdomain (for example `news.hifth.app`) keeps any reputation damage from a bulk send away from the owner's own day-to-day iCloud mail at the root.

## 3. Free sending services

### Resend

- <https://resend.com/pricing> — **fetched** (no date shown).
  - Free plan, one-to-one ("transactional") mail: 3,000 a month, "limited to 100 emails per day", 3 domains.
  - Free plan, newsletter ("marketing") mail: 1,000 contacts, no cap on sends ("not limited by the number of emails sent — only by the number of contacts").
  - Cheapest paid: one-to-one Pro $20 a month for 50,000 emails; marketing Pro $40 a month for 5,000 contacts.
  - Forced footer on free: not stated.
- <https://resend.com/docs/knowledge-base/account-quotas-and-limits> — **fetched** (no date). 100 a day counted by UTC calendar day; 3,000 a month; sent **and received** mail both count; API limit 10 requests a second.
- <https://resend.com/docs/api-reference/emails/send-batch-emails> — **fetched**. Up to 100 emails per batch call, each with its own recipient and body. Custom headers can be set on each email; `List-Unsubscribe` is not named.
- <https://resend.com/docs/dashboard/broadcasts/introduction> — **fetched**. Newsletter sends ("broadcasts") go to contacts held at Resend, added by hand, API or CSV upload.
- <https://resend.com/docs/dashboard/audiences/managing-unsubscribe-list> — **fetched**. For broadcasts, Resend runs the leave flow itself through a placeholder link. For one-to-one mail, where Resend does not manage the contacts, you add your own leave link.
- <https://resend.com/docs/dashboard/domains/tracking> — **fetched**. "Open and click tracking is disabled by default for all domains." Turning it on needs an extra DNS record.
- <https://resend.com/docs/dashboard/domains/introduction> — **fetched**. "We recommend sending your emails from one or more subdomains (e.g., updates.example.com) instead of your root domain."
- <https://resend.com/docs/add-a-domain> — **fetched**. Bounce address defaults to the `send` subdomain; copy record values from the dashboard.
- <https://resend.com/docs/knowledge-base/cloudflare> — **fetched**. Records to add in Cloudflare: an MX record and an SPF TXT record (`v=spf1 include:amazonses.com ~all`), both on the `send` name; a DKIM TXT record at `resend._domainkey`, set to "DNS only". Nothing at the root. For a subdomain sender, the same names go under the subdomain.
- Search on Resend's records — **snippet only**. Several of Resend's provider guides agree on the same three records, and one says to leave an existing root SPF alone.
- <https://resend.com/security/gdpr> — **fetched**, updated 2026-11-05. "Resend stores customer data in the United States", covering message content, delivery logs, webhooks and account records. "There is no setting today that moves stored data to the EU." The sending region changes only where mail leaves from. Contacts are not named specifically.
- Search on Resend's privacy framework — **snippet only**. EU-to-US transfers are covered by standard contract clauses and the EU-US Data Privacy Framework, certified March 2025.
- Double opt-in: not looked at.

### Brevo

- <https://www.brevo.com/pricing/> — **fetched** (page downloaded and the text read; the summary tool could not see it).
  - "Once we approve your account for sending, you can start sending up to 300 emails per day." So a new account is checked before it can send.
  - "No Brevo logo" is listed as a feature of Starter, the cheapest paid plan, with the line "Remove the 'Sent with Brevo' footer". So **the free plan carries Brevo's footer.**
  - Prices are drawn by script and did not come through.
- Search — **snippet only**. Free plan is 300 a day with no roll-over; contacts unlimited by most accounts, one source says 100,000; sources disagree on which paid tier removes the footer.
- <https://developers.brevo.com/docs/send-a-transactional-email> — **fetched**. One example requires that the recipient "must be a Brevo contact assigned to a contact list"; the plain example does not say. Whether the 300-a-day cap covers API mail: not stated.
- <https://help.brevo.com/hc/en-us/articles/208580669> — refused (403), not read.
- Double opt-in, data location: not looked at.

### Buttondown

- <https://buttondown.com/pricing> — **fetched** (page downloaded and read). "Absolutely nothing for your first 100 subscribers." Includes "Send from a custom domain" and "Privacy-first". White-labelling is a $79-a-month add-on, which suggests free mail carries Buttondown's name (not stated outright).
- Search — **snippet only**. About $9 a month near 1,000 subscribers, $29 near 5,000.
- API on free, double opt-in, data location: not looked at.

### MailerLite

- <https://www.mailerlite.com/pricing> — **fetched**. Free: 250 subscribers, 2,500 emails a month. "Remove MailerLite logo" appears only from the paid Comfort plan (from $12 a month). "On Free, API and MCP access is limited and doesn't include sending." So we could not send our own list through its API on free.
- Double opt-in, data location: not looked at.

### Kit (formerly ConvertKit)

- <https://kit.com/pricing> — **fetched**. Free up to 10,000 subscribers; "There are no sending limits on any of our plans"; "Remove Kit branding" is not available on free; API available on free. Cheapest paid: Creator, $33 a month (1,000 subscribers).
- <https://developers.kit.com/> — **fetched**, no plan details.
- Kit sends to subscribers it holds; whether its API can send to addresses it does not hold: not looked at. Double opt-in, data location: not looked at.

### EmailOctopus

- <https://emailoctopus.com/pricing> — **fetched**. Free: 2,500 subscribers, 10,000 emails a month, EmailOctopus branding on free mail. Cheapest paid: Pro from $9 a month billed yearly.
- Custom domain, API on free, double opt-in, data location: not stated or not looked at.

### Mailchimp

- <https://mailchimp.com/pricing/marketing/> — **fetched** (copyright 2026). Free: 250 contacts; "Max of 500/mo or 250/day"; "Remove Mailchimp Branding" not included on free; "Sending will be paused if contact or email send limit is exceeded."
- API, double opt-in, data location: not looked at.

### Amazon SES

- <https://aws.amazon.com/ses/pricing/> — **fetched** (copyright 2026). "$0.10 / 1,000 emails" for outgoing mail bought one by one. New AWS customers get "up to $200 in AWS Free Tier credits", the free plan lasting 6 months. The old "3,000 free a month for 12 months" offer is not on the page.
- <https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html> — **fetched**.
  - New accounts start in a "sandbox": only to verified addresses, 200 messages a day, 1 a second.
  - To leave it you tell AWS whether the mail is marketing or one-to-one, give the website, and tick that you will "only send email to individuals who've explicitly requested it" and have a way to handle bounces and complaints. First answer within 96 hours.
- SES sends what you give it; the list stays wherever you keep it. No footer. AWS itself does not add tracking by default (**snippet only**, from AWS's metrics FAQ).

### Listmonk (run it yourself)

- <https://listmonk.app/> — **fetched**. "Free and open source self-hosted newsletter, mailing list manager." One program plus its own Postgres database. Single and double opt-in lists. "Multi-SMTP e-mail queues".
- <https://listmonk.app/docs/> — **fetched**. Licence AGPLv3; the only dependency is Postgres.
- It still needs a sending service behind it (such as SES) and a server that is always on. Not looked at further.

## 4. Supabase in practice

### Does the free plan pause a quiet project?

- <https://supabase.com/docs/guides/platform/free-plan-pausing> — **fetched** (no date). (The page also carried a note addressed to AI agents; ignored.)
  - "Free Plan projects with low activity over a 7-day period can be paused."
  - Warning email "roughly one week before the pause takes effect," and another once paused.
  - Activity: "Typically a few user requests to the database each day over the previous week is enough." API calls and dashboard visits count.
  - "You can restore a paused project for up to 1 year after it was paused," by pressing **Resume project** in the dashboard.
- <https://supabase.com/docs/guides/troubleshooting/http-status-codes> — **fetched**. Status 540: "The project the request was being made against has been paused." "The project cannot process requests until it is un-paused by the owner." **So a form writing to a paused project fails for every visitor until the owner resumes it.** A ping cannot wake it.
- <https://supabase.com/docs/guides/platform/billing-on-supabase> — **fetched**. Two free projects per account; paused projects do not count toward that; paid plans never pause.
- From this repository (the Supabase move design page on the `supabase-move` branch, not yet on main): the new project is set up but its library data is not loaded yet, and the only things that use it are three building scripts run by hand. **So nothing keeps it busy today**, and the owner already paused the old project once.

### Is a timed "keep awake" request allowed?

- <https://supabase.com/terms> — **fetched** (version label, no date). Nothing on free-plan pausing or keep-awake requests. General clauses only: no bypassing "any security device or protection"; Supabase may apply "usage caps, or throttling mechanisms" against "billing fraud and unauthorized usage".
- Search — **snippet only**. Many community posts and small tools run a weekly or daily request from GitHub Actions or similar to stop pausing. No Supabase page endorses or bans it.
- So: not forbidden by anything we read, not blessed either. It also matches the pausing page's own description of what counts as activity.

### How should a Cloudflare Pages Function write a row?

- <https://supabase.com/docs/guides/api/api-keys> — **fetched**. (Note to AI agents on the page; ignored.)
  - New-style **publishable key**: "Safe to expose online"; runs as the public role and obeys row rules.
  - New-style **secret key**: backend only; "full access to your project's data, bypassing Row Level Security."
  - The older public key and older service key are their legacy versions. **"Supabase is deprecating the anon and service_role keys by the end of 2026."** So new work should use the new secret or publishable key, not the old service key.
- <https://supabase.com/docs/guides/database/postgres/row-level-security> — **fetched**. (Note to AI agents ignored.)
  - Turn row rules on, take away the default table rights, give back only what each role needs: "Adding policies doesn't take those grants back."
  - With row rules on and no rules written, the publishable key reaches nothing.
  - Insert-only for the public role: grant insert only, plus an insert rule. Returning the new row would also need read rights, so ask the API for no row back.
- From this repository (the `supabase-move` branch, migration dated 2026-11-12): the new project already takes all rights on new tables, sequences and functions away from the public roles by default. **So a new sign-up table starts closed**, and anything the form may do has to be granted on purpose.
- The same project holds the privately held outside library. A secret key kept on Cloudflare would open that library too if it ever leaked. (My reading, not a fetched source.)

## 5. Rules for the mail itself

### United States (CAN-SPAM)

- <https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business> — **fetched**, dated August 2023, edited January 2024.
  - Each marketing email must carry "a valid physical postal address": a street address, "a post office box you've registered with the U.S. Postal Service," or "a private mailbox you've registered with a commercial mail receiving agency."
  - A clear way to leave; it must keep working at least 30 days after sending; honour it within 10 business days; no fee, no information beyond an address, no more than one step.
  - Consent is **not** required for ordinary commercial email (but people can always leave).
  - Whether a message is commercial depends on its main purpose: content that "advertises or promotes a commercial product or service." A launch announcement for an app is most safely treated as commercial, even a free one (my reading).
  - Up to $53,088 per email in breach.

### UK (PECR and UK GDPR) and EU (GDPR)

- <https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/> — **fetched** (no date; "under review" for the 2025 data act).
  - No marketing email to individuals unless they "have specifically consented to electronic mail from you," for example by "ticking an opt-in box."
  - Each message must not hide who it is from, and must "provide a valid contact address so they can opt out or unsubscribe."
- <https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/> — **fetched** (no date).
  - "You should keep a record of the consent (eg who, when, how) so that you can demonstrate it is valid."
  - "Must take a positive action to consent"; no pre-ticked boxes.
  - Double opt-in is **not mentioned**.
- <https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/> — **fetched**, updated 2026-04-28. No double opt-in.
- Search — **snippet only**. Outside guides say double opt-in is not legally required in the UK; one says the regulator recommends it as best practice, which could not be found on any regulator page.
- <https://gdpr-info.eu/art-7-gdpr/> — **fetched**. Article 7(1): the controller "shall be able to demonstrate that the data subject has consented." Article 7(3): consent can be withdrawn at any time, and "It shall be as easy to withdraw as to give consent."
- **So:** double opt-in is advised, not required, in all three places. What is required is a record of the agreement and an easy way out.

## 6. Other things that change the choice

### What do Gmail and Yahoo expect of senders?

- <https://support.google.com/a/answer/81126> — **fetched**, in force since 2024-02-01.
  - Everyone: SPF or DKIM, valid DNS, encrypted connection, spam reports under 0.3%.
  - Over 5,000 a day: SPF **and** DKIM, a DMARC record (`p=none` is enough), the From domain lined up with one of them, and one-click leaving for marketing mail plus a visible leave link.
  - We will be far below 5,000 a day, but the same steps help small senders reach the inbox, and hifth.app has no DMARC record today.
- <https://www.rfc-editor.org/rfc/rfc8058> (one-click leaving) — **fetched**.
  - Two headers: `List-Unsubscribe` with one HTTPS address, and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
  - The address must accept a POST and "MUST NOT return an HTTPS redirect."
  - The message "MUST" carry a DKIM signature that covers both headers.

### Does a TestFlight invite need our own email at all?

- <https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers> — **fetched**. Testers can join by email invitation or by a **public link** ("Anyone can join using the link"), with an optional cap from 1 to 10,000; up to 10,000 outside testers per app.
- <https://developer.apple.com/testflight/> — **fetched**. "Include a public link in your marketing communications — such as email ... you don't need to have anyone's contact information to invite them."
- This repository's TestFlight research note (2026-11-09): TestFlight covers macOS ("To use TestFlight for Mac, build your macOS apps with Xcode 13 or later").
- So a TestFlight invite can be a link inside our own launch email. Inviting by address instead would hand the addresses to Apple, which the privacy page's "only the owner sees it" does not cover (my reading).

### Is a leave link that deletes on a plain visit safe?

- My own reasoning, **not from a fetched source**: some mail systems open every link in a message to check it for danger before the person sees it. A leave link that deletes the row on a plain visit could then remove people who never clicked. The one-click standard above uses a POST for this reason. A leave page that asks "Leave the list?" with a button, plus a separate POST address for the one-click headers, avoids it.

## Every source, with how it was read

| Source | How read |
| --- | --- |
| Cloudflare Email Service overview | fetched |
| Cloudflare Email Service changelog | fetched |
| Cloudflare Email Service pricing | fetched |
| Cloudflare Email Service limits | fetched |
| Cloudflare Email Service domain records | fetched |
| Cloudflare Email Service get-started (sending) | fetched |
| Cloudflare Email Workers send-mail page | fetched |
| Cloudflare Email Routing enable page | fetched (silent on MX) |
| Cloudflare Email Routing troubleshooting | fetched |
| Cloudflare Email Routing subdomains | fetched |
| Cloudflare Workers pricing | fetched |
| Cloudflare Workers limits | fetched |
| Cloudflare Pages Functions overview | fetched (silent on timers) |
| Cloudflare "is it out of beta" search | snippet only |
| Pages Functions and timers search | snippet only |
| Apple: set up an existing domain with iCloud Mail | fetched |
| Apple: custom email domain overview | fetched |
| Apple: iCloud sending limits | fetched |
| Apple: iCloud terms | fetched |
| Apple: invite external testers | fetched |
| Apple: TestFlight overview | fetched |
| SPF standard (RFC 7208) | fetched |
| DMARC standard (RFC 7489) | fetched |
| One-click leaving standard (RFC 8058) | fetched |
| Google sender guidelines | fetched |
| Resend pricing, quotas, batch API, broadcasts, leave list, tracking, domains, add-a-domain, Cloudflare guide, GDPR page | fetched |
| Resend record values across provider guides; privacy framework | snippet only |
| Brevo pricing page | fetched (downloaded) |
| Brevo free plan details from reviews | snippet only |
| Brevo API sending page | fetched |
| Brevo help article | refused (403) |
| Buttondown pricing page | fetched (downloaded) |
| Buttondown paid prices | snippet only |
| MailerLite, Kit, EmailOctopus, Mailchimp pricing | fetched |
| Kit developer home | fetched |
| Amazon SES pricing, leaving the sandbox | fetched |
| Amazon SES no tracking by default | snippet only |
| Listmonk home and docs | fetched |
| Supabase pausing, status codes, billing, keys, row rules, terms | fetched |
| Supabase keep-awake practice | snippet only |
| FTC CAN-SPAM guide | fetched |
| UK regulator: electronic mail marketing (three pages) | fetched |
| UK double opt-in "best practice" claim | snippet only |
| GDPR Article 7 | fetched |
| hifth.app live DNS | looked up with dig |
