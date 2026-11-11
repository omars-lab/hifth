# What does someone see when they type hifth.app?

**Short version:** hifth.app gets a front page. It says in one line what Hifth is for, opens the
web app (which moves to hifth.app/read), says the Mac app is coming soon, and lets a reader leave
an email to hear when it ships. The full plan, with every step, is in
[the hifth.app plan](../../.claude/plans/hifth-app-site.md).

**What it changes for a hafiz:** a short address to remember and to pass to a friend, and one
place to hear when the Mac app is out. The pages, marks and look-alike jumps are unchanged.

**What is settled (owner, 2026-11-11):**

- The page says "Mac app — coming soon", with no store name and no store badge.
- The web app moves to hifth.app/read now. Readers at the old address are offered a way to carry
  their marks across.
- The page collects emails for one "it's out" message. It keeps nothing else, and it has no
  sign-in button.
- It is hosted on Cloudflare Pages, on the new account that holds hifth.app.

## Open questions, and what would answer each

### ① Is hifth.app live, with the app at /read and the email form working? · **open**

Not yet. The front page and the privacy page are drawn and checked on a laptop and a phone-width
screen. Still to come: the email form's server part and its database, the app copied under /read,
one tested way to publish, and the "Hifth has moved" sheet on the old address. Each comes with
its own tests.

What would answer it: hifth.app and hifth.app/read open in Firefox and Chrome; a throwaway email
signs up and leaves again; marks made at the old address arrive at the new one.

### ② Can the "what each commit was for" picture open from the local hub? · **fixed**

Yes (2026-11-11). It used to open only as a file on disk, from whichever folder had drawn it, so
it had no place on the local hub. Now the app's development server hands it over at /intent/,
and the hub lists it as a private, local-only page. A production build never includes it, and
the route serves that one page and nothing else from the repository. Draw or redraw it with
`make intent`.

### ③ What contact address does the privacy page give? · **open**

The privacy page tells a reader how to have their email removed without the link in the email.
It needs an address the owner reads. Until the owner picks one, the page shows a placeholder,
and the site does not go live with it.
