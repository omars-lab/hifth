---
name: store-numbers
description: How many people download, update and download again the Hifth app, by device and country, from Apple's daily sales reports. Pulls each day's report with the hifth-reviews key into a folder git ignores and prints counts. Use when someone asks how many downloads or installs the app has, how a release is being taken up, which countries or devices readers use, or for the launch goal's download numbers. Not for store reviews (store-feedback), crashes (crash-logs) or anything about what a reader does inside the app, which nothing collects.
---

# Store numbers

Apple counts downloads in the store and gives the developer one report a day. These are the
only numbers about readers this project has: the app itself collects nothing (the privacy rule
that the reader decides who sees their data). This skill fetches those reports and counts them
(launch item ㉝ on `docs/design/app-store-launch.md`).

## Short version

1. `make app-store-numbers ARGS=pull` — fetch the last 30 days' reports not already kept.
2. `make app-store-numbers ARGS=summary` — first downloads, updates and downloads again, by
   device and country.
3. Put the numbers the launch goal asks for into `.claude/goals/app-store-launch.md`.

`--days N` on either looks further back, up to a year, which is all Apple keeps.

## Rules

- **The reports stay in `.store/numbers/`**, which git ignores. Counts may go into the goal
  page; the report files never go into the repo.
- **The key and the vendor number.** `ASC_REVIEWS_KEY_ID` (the `hifth-reviews` key, which has
  Finance access), `ASC_ISSUER_ID` and `ASC_VENDOR_NUMBER`, loaded by the make target from the
  encrypted settings. Nothing prints them. `make app-release-setup` says whether each is saved.
- **Only this app's rows are counted.** A report covers every app on the account; the command
  finds Hifth's number by its bundle id and counts only its rows.
- **A report that changes form is refused**, not miscounted: if Apple drops a column this reads,
  `summary` stops and says so.

## What the numbers mean

| Word | Apple's codes | What it is |
|---|---|---|
| first download | 1, 1F, 1T, F1 | Someone got the app for the first time |
| update | 7, 7F, 7T, F7 | Someone who had it took a new version |
| download again | 3, 3F, 3T, F3 | Someone who had it before got it back |

The codes come from Apple's [product type identifiers](https://developer.apple.com/help/app-store-connect/reference/reporting/product-type-identifiers)
table. 3T and F3 are not in it; Apple's [developer forum](https://developer.apple.com/forums/thread/24354)
gives them for iPad-only and Mac apps, so they are counted with the rest. Device "Desktop" in a
report is the Mac.

## Scripts — when to use each

| Script | What it does | When to reach for it | Command |
|---|---|---|---|
| `scripts/store-numbers.mjs pull [--days N]` | Finds the app, asks Apple for each day's summary sales report back N days that is not kept yet, and keeps it. A day with nothing answers "not found" and is kept empty; yesterday is left to ask again, since its report may not be made yet | Before every summary | `make app-store-numbers ARGS=pull` |
| `scripts/store-numbers.mjs summary [--days N]` | Counts the kept days for this app only | For the goal page, or to see how a release is taken up | `make app-store-numbers ARGS=summary` |
| `scripts/lib/app-store-connect.mjs` (shared, at the repo's top) | The signed token and the report download, shared with store-feedback | Imported | tests: `node --test .claude/skills/store-numbers/scripts/store-numbers.test.mjs` |

## Before the first release

No reports exist until the app is in the store, so `pull` keeps empty days and `summary`
prints zeros. A `pull` that gets that far proves the key, its Finance access and the vendor
number work.
