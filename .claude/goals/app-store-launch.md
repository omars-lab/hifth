# Is Hifth ready for the App Store, and could we run it once readers have it?

*Written 2026-11-15, when the owner asked for a plan to harden the app before the App Store and
to be ready to hear about problems and fix them fast. Status: **current goal, beside the pitch**.
The list of all goals is [README.md](README.md).*

*Name: `app-store-launch`. Plan that serves it: `launch-readiness`
(`.claude/plans/launch-readiness.md`). What teams check before a launch, with sources:
`docs/research/app-launch/research.md`.*

## The goal

**Hifth on the App Store for iPad, iPhone and Mac, and a way to hear about a problem, find its
cause and ship a fix within days.**

Readers can sign in at launch. Crash reports come from Apple's own reports and from a report the
reader chooses to send. No outside company receives anything.

This goal runs beside the pitch goal, not instead of it. Where the two collide, the pitch build
stays private and the store build stays the public one.

## Are we on it? (checked 2026-11-15)

Not yet. The App Store is still recorded as "not a target", and uploads are locked by a decision,
because two data sources' licences clash with Apple's store terms. The owner chose to build a
citations page and ask both rights holders for written permission; everything except the upload
goes ahead while we wait.

Four facts shape the order:

- Every fix is a new build through Apple's review, because the web part is packed inside the app.
- A store build could have been the private build. Since 2026-11-16 the archive step refuses
  anything but the public one.
- No privacy file, no sandbox on the Mac, no system logging, no "report a problem".
- Sign-in has no code yet, and three choices on the sign-in page wait on the owner.

## How we measure progress

| Measure | What it is | Where it lives |
|---|---|---|
| **Launch blockers open** | Backlog rows tagged for the launch that would stop an upload or a review. Goes to zero. | `make issues LAUNCH=1` (rows with `"launch": true` in `docs/issues.json`) |
| **Owner steps waiting** | Things only the owner can do (emails, sign-in choices, store forms). | The "Waiting on the owner" list below |
| **Days since a restore was practised** | A backup put back into a scratch database and its rows counted. Under 30. | This page |
| **Days since the release command ran clean** | Version bump to a built, checked archive, upload still locked. Under 14. | This page |
| **Unanswered reports and reviews** | Reader reports in the support folder and store reviews with no answer. Zero. | The `operate-app` skill's commands, once built |
| **New crashes** | Crashes from readers' devices not yet in a backlog row. Zero. | The `crash-logs` skill, once it reads readers' crashes |
| **Unsteady tests** | Tests that passed only on a second try in the last push. Zero. | The push's report, once built |
| **Skills with a known gap** | Rows still open in the skills table in the plan. Zero. | The plan's stage 9 |

The first one is the main measure. The others say whether we could run the app once it is out.

## The current numbers

| Measure | Value | As of |
|---|---|---|
| Launch blockers open | **32** of 33: 30 of the 31 on the launch page (the store-build guard closed), and the two older App Store rows on the licence | 2026-11-16 |
| Owner steps waiting | **6**: two permission emails and a fallback date; delete 134 merged branches and ask GitHub to purge; three sign-in choices; the hifth.app first upload steps; the EU trader answer; the Mac keyboard test permission | 2026-11-15 |
| Days since a restore was practised | never | 2026-11-15 |
| Days since the release command ran clean | no release command yet | 2026-11-15 |
| Unanswered reports and reviews | no way to receive them yet | 2026-11-15 |
| New crashes | readers' crashes cannot be read yet | 2026-11-15 |
| Unsteady tests | not reported yet | 2026-11-15 |
| Skills with a known gap | **10** | 2026-11-15 |

Update this table on every pass of the loop (`.claude/loop-prompts/operational-readiness.md`).

## What comes next, in order

1. **Write it down:** backlog rows, this page, the research, the reopened decision.
2. **Clear the licence:** a citations page, two emails for the owner to send, read the page
   artwork's terms, check the recitation audio's terms.
3. **A store build can never be the private build:** done 2026-11-16. The archive step refuses
   anything else, proven by a test.
4. **What Apple requires:** privacy file, Mac sandbox and signing, version numbers, a real
   archive, sound with the silent switch, the "more than a website" notes, an app-wide error
   screen, a screen-reader walk, open faults a reviewer would hit.
5. **Hearing about problems:** Apple's crash reports kept on the device, "Report a problem",
   system logging, a support page.
6. **Shipping a fix fast:** a remote off-switch, one release command, a fix-in-a-hurry page, an
   undo for the site.
7. **Accounts and the server:** sign in with Apple, delete the account in the app, backups with a
   practised restore, the apps' privacy policy.
8. **Listing and test flight:** store answers, screenshots, release notes, a few named testers.
9. **Upload and release**, once the permissions are in writing.

The plan has the detail of each step.

## Waiting on the owner

- Send the two permission emails, and set the date after which we stop waiting.
- Delete the 134 merged branches on GitHub, and ask GitHub Support to purge the old commits.
- The three choices on the sign-in page.
- The hifth.app first upload steps: the Cloudflare key permission, the database step, four
  secrets, and the mail sender.
- Whether you trade in the EU (Apple asks; it decides what contact details are published).
- Let the terminal run the Mac app's keyboard test, or run it while you are away.

## The tools that make this repeatable

### Already there: use these

| Step | Tool |
|---|---|
| Track the work | `issues` skill, `docs/issues.json`, `make issues`, `make backlog` |
| Fix with a test | `testing` skill |
| Build and run the apps | `native-shell` skill, `app-setup` skill |
| Read crashes from a device on a cable | `crash-logs` skill |
| Walk the app | `walk-app` skill |
| Publish the site | `deploy-site` skill |
| Keys and secrets | `secrets` skill |
| A choice to record | `decide` skill |
| Release notes | `intent-manager:write-release-notes` |

### To build

| What | Tool | Why |
|---|---|---|
| Version, archive, upload, review, staged release | new `release-app` skill | No skill covers the release today |
| Reading crashes, reports and reviews; the fix-in-a-hurry path | new `operate-app` skill | Nothing covers running the app once it is out |
| The numbers kept up to date | the loop, `.claude/loop-prompts/operational-readiness.md` | A table nobody updates is worse than none |

## How to use this page

- Before picking launch work, ask: does it close a launch blocker, or make a measure above
  better? If not, it waits.
- When the app is out and the measures hold for a month, mark this goal **done** at the top and
  in the README.
