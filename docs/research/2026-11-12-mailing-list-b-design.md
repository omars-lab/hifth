# How should Hifth keep the Mac-app sign-up list, and what should send the launch email? (design, researcher B)

Written 2026-11-12 from the sibling file, the mailing-list-b findings, which holds every source and whether it was fetched.
The owner has already decided the list lives in Supabase. This note says how it gets there and what sends the mail.

## The short version

- **Where the list lives:** a Supabase table that the public cannot reach. The front page's form adds an address through one narrow database function that can only add, never read. No all-powerful Supabase key is kept on Cloudflare.
- **Keeping Supabase awake:** a tiny separate Cloudflare Worker runs once a day on a free timer. It clears out sign-ups nobody confirmed, which also counts as the activity that stops Supabase pausing the project.
- **What sends the mail:** **Resend, on its free plan**, from a subdomain such as news.hifth.app. A short script on the owner's laptop reads the list and sends one email per person, each with that person's own leave link. Open and click tracking stay off, which is Resend's default.
- **How it shares hifth.app with iCloud:** Resend's records all sit under the subdomain. Apple's incoming mail, Apple's SPF record and Apple's key are not touched.
- **DNS changes:** three records for Resend under the subdomain, plus one DMARC record at the root. hifth.app has no DMARC record today.
- **Cost:** $0, if the launch list is 100 people or fewer, or if it is fine for the launch email to go out over several days at 100 a day. For a bigger list sent in one day, pay one month of Resend Pro ($20), then drop back.
- **TestFlight:** put Apple's public TestFlight link in the launch email. Then no addresses go to Apple and no separate invite is needed.
- **What a sign-up notices:** a "confirm your address" email right after signing up, then one launch email. Each email has a leave link that asks "Leave the list?" before it removes anything.

**Recommendation in one line:** Resend free, with the list in Supabase behind add-only database functions and a daily Worker timer. It is the only option that is free for both the trickle of confirmation emails and a modest launch, leaves the list where the owner decided, and adds no tracking.

A few words, once: **MX**, **SPF**, **DKIM**, **DMARC**, **double opt-in** and **bounce address** are explained at the top of the findings file. **Row rules** means Supabase's row-level security: rules on a table about who may read or write which rows.

## What are the two jobs the sender has to do?

The sender has two jobs, and they pull in different directions.

1. **A steady trickle.** One "confirm your address" email for each sign-up (see the question on double opt-in below). It runs for months and must stay free the whole time.
2. **One burst.** The launch email to everyone at once, and perhaps two or three updates a year.

What decides the burst is **how many people are on the list on launch day**. Nobody knows that number yet, so the recommendation is given as sizes, not as one name.

| People on the list at launch | What sends the launch email | What it costs |
| --- | --- | --- |
| Up to 100 | Resend free, in one day | $0 |
| 100 to about 3,000 | Resend free spread over days (100 a day), **or** one month of Resend Pro sent in one day | $0, or $20 once |
| 101 to 1,000, sent in one day, for free | Resend's free newsletter side ("broadcasts"): no cap on sends for up to 1,000 contacts held at Resend | $0, but a copy of the list sits at Resend for the send (upload, send, then delete), and Resend runs its own leave list, which must be copied back to Supabase afterwards |
| 100 to about 3,000, if Cloudflare's sending is out of beta by then | One month of Cloudflare's paid Workers plan | $5 once |
| Over 3,000 | Amazon SES, or one month of Resend Pro (50,000 included) | about $0.10 per 1,000 on SES, or $20 |

## Which services could send it, side by side?

| Option | What it buys us | What it costs or risks | What it commits us to |
| --- | --- | --- | --- |
| **A. Resend free** (recommended) | Free forever for the trickle: 3,000 a month, 100 a day. Sends to our own list through its API, so the list stays only in Supabase. One email per person, so each carries that person's own leave link. Tracking off by default. Its records all live on a subdomain, so iCloud is untouched. Whether any part of it is still labelled beta: not looked at. | The 100-a-day cap is shared by confirmation emails and the launch. A list of 2,000 takes 20 days on free, or $20 for one month of Pro. Resend stores message content and delivery logs in the US. | One new account. The privacy page must name Resend as the service that sends the mail. We build the leave link and the one-click leave headers ourselves (we already have the leave link). |
| **B. Cloudflare Email Sending** | Same Cloudflare account and DNS as hifth.app; records added for us; 3,000 a month included; no new company. Can be called from a Worker's code (whether a Pages Function can call it directly: not looked at). | Not free: needs Workers Paid at $5 a month. **Still a public beta.** A new account's daily limit is "conservative" with no number given, so a launch-day burst could stall. Its pages speak only of one-to-one mail, and are silent on announcements. | $5 for every month we use it, including months of only confirmation emails, unless the trickle goes elsewhere. Hard to rely on before we have seen the real daily limit. |
| **C. Amazon SES** | Cheapest at any size: $0.10 per 1,000. List stays with us. No footer, no tracking added. | The most setup: an AWS account, a domain check, and a request to leave the "sandbox" (200 a day to verified addresses only), answered within 96 hours. A second cloud account to look after. | AWS billing and an AWS login kept alive for a few emails a year. Worth it only for a big list. |
| **D. A newsletter service** (Kit free to 10,000; EmailOctopus free to 2,500; Brevo free at 300 a day) | A ready editor, a hosted leave page, archives. (Whether each has double opt-in built in: not looked at.) | It holds **its own copy** of the list, with its own "has left" list that drifts from Supabase. Its name in the footer on some free plans (Mailchimp's, fetched; others not all checked). Whether open and click tracking is on by default: not looked at for these services, so it would need checking against our "no tracking" promise. | A second home for the addresses, which the owner decided should live in Supabase. Copying the list over before every send, and copying leavers back. |
| **E. iCloud+ itself** (the owner's hifth.app address) | Already set up; costs nothing; replies land in the owner's inbox. | 500 recipients per message and 1,000 a day. One message to many cannot carry each person's own leave link, and has no one-click leave headers. Apple's terms are for "personal use", and bar "automated means, like scripts", so one script-sent email per person is ruled out. Its ban on "unsolicited" bulk mail does not strictly cover people who asked, but the other two clauses still do. | Personal replies only. Fine for writing back to someone; wrong for the launch email. |

**What else was looked at, and why it is not in the table:**

- **MailerLite free** cannot send through its API, and holds only 250 people.
- **Mailchimp free** holds 250 people, sends 500 a month, and carries its branding.
- **Buttondown free** holds 100 people.
- **Listmonk** is free software, but needs a server that is always on, its own database and a sending service behind it anyway. That is a lot of running parts for one email a year.
- **Cloudflare's free "send to a verified address"** reaches only addresses the owner has proved they own. It also hangs off Cloudflare's receiving service, which cannot be switched on while iCloud holds hifth.app's mail.

## How does a sign-up get into Supabase?

The form's code on Cloudflare checks the spam token, then calls Supabase's web API. There are three ways to do the write.

| Way | What it buys us | What it costs or risks | What it commits us to |
| --- | --- | --- | --- |
| **1. Narrow database functions, called with the publishable key** (recommended) | The key on Cloudflare can do exactly three things: add an address, confirm it, remove it by its token. It cannot read the list or touch the outside library held in the same project. A leaked key leaks nothing. | A small migration with three functions to write and test. | The publishable key is still kept as a Cloudflare secret, never in the page, so nobody can skip the spam check by calling Supabase directly. |
| **2. Insert into the table with the secret key** | Simplest code: one web request. | The secret key bypasses every row rule. This project also holds the privately held outside library. If the Cloudflare secret ever leaked, that library would be readable too. | A powerful key living on a second company's servers. Supabase is also retiring the older version of this key by the end of 2026, so use the new secret key if this way is chosen. |
| **3. Insert with the publishable key and an add-only row rule** | No secret key, no functions. | Easy to get subtly wrong. Asking for the new row back would, as I understand general Postgres behaviour, need read rights too, which would open reading (not verified from a source). A duplicate address shows up as an error, which can tell a stranger that someone is already on the list. | Careful testing of rights on every change to the table. |

**How the recommended way looks** (detail for whoever builds it):

- A table in a schema the web API does not serve: email (unique, compared without regard to case), created_at, confirmed_at, and the leave token.
- This repository's newer Supabase migration already makes new tables, sequences and functions start with no rights for the public roles. So the table starts closed, and only the functions below are granted to the public role.
- **Add.** Takes an address and a confirm token that the form's code makes, and makes the row, or does nothing if the address is already there. The form's code then emails the confirm link built from its own token, only when the row was new. The function tells the form's code whether the row was new, but the visitor always sees the same "check your inbox" answer, so the form cannot be used to find out who has signed up. (For an address already on the list, nothing is sent, or a plain "you are already on the list" email goes to that address only.)
- **Confirm.** Takes a token and sets confirmed_at.
- **Leave.** Takes a token and deletes the row.
- **Daily tidy.** Deletes rows never confirmed after 7 days. The timer below calls it.
- The functions run with their owner's rights, and with a fixed search path, so that they cannot be tricked into touching other tables.
- The form's code asks Supabase for no row back, and treats a 540 answer ("project paused") as "please try again later", never as success.
- The launch script on the laptop reads the confirmed rows with the database password the building scripts already use. Nothing on Cloudflare can read the list.

## What happens if Supabase pauses the project?

**It is likely to pause.** Supabase pauses a free project after a quiet week. Its own page says "a few user requests to the database each day" is typically enough to count as activity. The new project has no other regular use yet: its library data is not even loaded, and only hand-run building scripts touch it. A form that gets a handful of sign-ups a week may not be enough.

**While paused, every sign-up fails** with a "project paused" answer until the owner presses Resume in the dashboard. A request cannot wake it. The owner gets a warning email about a week before.

| Way round it | Pros | Cons | Commits us to |
| --- | --- | --- | --- |
| **A daily Worker timer** (recommended) | Free: Workers Free allows 5 timers per account. It does useful work (the daily tidy above), so it is not a pretend request. | One more small piece of code to deploy. No source said Pages Functions can run on a timer (seen in search snippets only, not confirmed), so plan on a separate Worker. Supabase's terms say nothing about this either way. | Keeping that Worker deployed for as long as the form is up. |
| **Let it pause, and resume on the warning email** | Nothing to build. | Sign-ups are lost from the day it pauses until someone acts. It depends on the owner reading the warning in time. | Watching for Supabase's emails. |
| **A paid Supabase plan** | Never pauses. | A monthly bill for a few rows (price not looked up). | Ongoing cost for the life of the project. |

## How does Resend share hifth.app with iCloud?

- **Incoming mail stays with Apple.** Resend never touches the root MX records.
- **Send from a subdomain**, such as news.hifth.app. Resend recommends this, and it keeps any reputation damage from a bulk send away from the owner's day-to-day iCloud address at the root. Set the reply-to to a root hifth.app address, so replies still land in iCloud.
- **SPF is not at stake.** Resend's SPF record goes on the bounce subdomain under news, not the root. The root's single SPF record stays as it is, using 6 of its 10 allowed lookups.
- **DKIM keys sit side by side.** Apple's key is under its own name, and Resend's under another. Neither replaces the other.
- **DMARC covers both.** One record at the root also covers news.hifth.app. Mail from Resend lines up with it through Resend's key, and mail from iCloud through Apple's.

## What DNS changes does it need?

Add (all on Cloudflare DNS, all set to "DNS only", never proxied):

1. A DKIM TXT record for Resend under the news subdomain. Copy the value from Resend's dashboard.
2. An MX record on the bounce subdomain under news, pointing at the value Resend gives.
3. An SPF TXT record on that same bounce subdomain, as Resend gives it.
4. A **DMARC** TXT record at the root, set to `p=none` to start, with reports going to an address the owner reads. hifth.app has none today.

Leave alone: the two Apple MX records, the root SPF record, Apple's key, and Apple's domain-ownership record.

Worth a look, not required: the root SPF record still includes the domain registrar's old mail-forwarding servers. With the MX records pointing at Apple, that forwarding cannot receive anything, so the include is very likely left over. Check the registrar's forwarding is off, then remove it.

## Do we need a confirmation email?

**No law we read requires one. It is still worth doing.**

- **US law** does not require consent for ordinary marketing email at all.
- **The UK regulator** requires "specific" consent from a positive action, and a record of "who, when, how". It does not mention double opt-in.
- **EU law** requires that the sender "be able to demonstrate" consent.

A clicked confirmation link is the plainest proof of all three. It also stops someone signing a stranger up, and it keeps mistyped addresses, which bounce and hurt delivery, off the list. Resend free covers the trickle of confirmation emails easily.

## What must every email carry?

- **Who it is from**, plainly.
- **A leave link that works for at least 30 days**, honoured within 10 business days (ours is at once). It must be as easy to leave as it was to join.
- **One-click leave headers** (a standard that lets the mail program show its own "Unsubscribe" button). They point at an HTTPS address that accepts a POST, and must be covered by the email's DKIM signature. Check that Resend signs these headers when they are added to each email; its pages do not say.
- **The leave link should ask before it deletes.** Today a plain visit to the leave link deletes the row. Some mail systems open every link in a message to scan it, which could remove people who never clicked. Better: the link opens a page with a "Leave the list" button that sends a POST, plus a separate POST address for the one-click headers. The **confirm link** gets the same treatment: a page with a "Confirm" button that sends a POST, so a scanner cannot confirm someone by visiting it. (This is my reasoning, not from a fetched source.)
- **A postal address, for US law.** For a one-person project that does not want to print a home address, US law accepts a PO box registered with the US Postal Service, or a private mailbox at a registered mail-receiving business. That is a small yearly cost (not looked up). If the owner is not in the US, check the local rule.

## What does the owner have to do?

1. Make a Resend account and add news.hifth.app as a sending domain.
2. Add the four DNS records above in Cloudflare.
3. Get a PO box or a mail-forwarding address for the email footer.
4. Store Supabase's publishable key and the Resend key as Cloudflare secrets for the front page. Never write them in the repository.
5. Update the privacy page:
   - name Resend as the service that sends the mail, and say it stores sending records in the US;
   - mention that we also keep the date the address was confirmed;
   - say the TestFlight invite is a link, so the address is never given to Apple.
6. On launch day: count the confirmed rows, pick the row in the size table above, run the send script, and put the public TestFlight link in the email.

The building work (the database functions, the timer Worker, the confirm and leave pages, the send script and their tests) is ours, not the owner's.

## What would change the answer?

- **Cloudflare's sending leaves beta and gets a free allowance**, or shows a daily limit big enough for the launch. Then move both jobs to Cloudflare: one company fewer, records already in its DNS.
- **The list passes 3,000 people.** Then use Amazon SES for the burst, and keep Resend for the trickle.
- **The owner wants a regular newsletter** with an editor and an archive, rather than a launch email and two updates a year. Then a newsletter service such as Buttondown or Kit earns its copy of the list.
- **Something else starts using the Supabase project every day.** Then the timer is still useful for the tidy, but no longer needed to keep the project awake.
- **The owner lives outside the US.** Then the postal-address rule and the consent rules that apply need checking for that country.

## What does this note leave for later?

- The wording of the launch email, and whether there is an update email at all.
- Whether the launch is a TestFlight beta or a store release. Either way, the link goes in the email.
- Anything about the app itself. The list never reaches the app, and the app never calls Supabase.
