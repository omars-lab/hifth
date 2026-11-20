---
name: understanding-processes
description: How Hifth's longer processes work from start to finish, explained for someone who has never run them — what has to be set up first (with the pages to visit and who does each step), a diagram of the whole road, what each step checks and why, where things end up, where it stands today, and what to do when a step fails, with a script that checks the setup. Use for "how does releasing the app work", "what do I need before a release", "walk me through the release process", "is this laptop set up to release", "how do I set up the App Store Connect key", "where does ~/.appstoreconnect come from", or before running a process for the first time. Not the command list for a release in progress (release-app), nor the one-time account IDs (app-setup).
---

# Understanding Hifth's processes

Each process has its own page in this folder. A page explains the whole road, so a reader who
missed every earlier session can follow it, and it points at the skill that holds the commands
rather than repeating them.

| process | page | the commands live in |
|---|---|---|
| Releasing the iPad, iPhone and Mac app, from a version number to readers | [app-release.md](app-release.md) | `release-app`, `app-setup` |
| A broken version is on the store: reproduce, fix, rebuild, ask Apple for a faster review | [fix-in-a-hurry.md](fix-in-a-hurry.md) | `operate-app` (the map), `release-app`, `crash-logs` |

## Scripts: when to use each

| script | what it does | when to reach for it | command |
|---|---|---|---|
| `scripts/check-release-setup.mjs` | checks everything a release needs on this laptop and in the Apple account (Node, Xcode and its sign-in, the two certificates, the App Store Connect key and its ids, the public build, the licence lock), says ok, missing or later for each, what to do and the page to do it on, then which release steps can run today. Prints no secret, no certificate name and no key id | before a first release on a laptop, after setting up a key or a certificate, or when a release step fails for a missing account or key | `make app-release-setup` |
| `scripts/check-store-listing.mjs` | reads the words drafted for Apple's store forms (`docs/design/store-listing.md`, each box under a `<!-- field: name -->` line, and its Arabic twin under `<name>-ar`) and checks each against Apple's length limit, no long dash, the app's display name, keywords that do not repeat the name or subtitle, the privacy answer against the app's privacy file, the export answer and category against the app's settings, and that each hifth.app page it gives is in the site's files. Prints lengths only, never the words | after editing the listing, before pasting it into App Store Connect, and when the app's name, category or privacy file changes | `make app-store-listing` |

## The shape of every page here

1. **The short version**: what the process is for and its steps, one line each.
2. **What has to be in place first**: each one-time step, who does it, the page to do it on,
   and how the check script sees it.
3. **The whole road, drawn**: a Mermaid diagram, with the steps that are locked or not built
   yet marked as such.
4. **Each step**: the command, what it refuses, and why that matters to a reader.
5. **Where things end up**: files and folders, and whether they leave the laptop.
6. **Where it stands**, dated, pointing at the backlog rows that hold the status.
7. **When a step fails**: what it says, what it means, and the fix.
8. **Why it is shaped this way**: the choices behind it, linked to their records.

## Keeping these pages right

- A status lives in its backlog row; a page here gives the date it was last true and the row.
- A new one-time step: a row in the page's setup table, a check in the script with a test,
  and the step on `app-setup` if it is an account or ID.
- Never a secret, a key's id, or anything the certificate names carry (the owner's email).
