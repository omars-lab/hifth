# What hifth.app answers for an address that isn't there

*2026-11-11, while building the release tool for hifth.app.*

## What we assumed

The release tool's last step looks at the live site and asks for every address that should
only work on this laptop: the pitch build, the design pages, debug copies of the source, the
development server's own files. The first version took "not there" to mean a 404. It also
allowed one exception: the app's own page, because the site carried a rule sending every
address under `/read/` to the app.

## What we measured

We served the exact release folder with Cloudflare's own local server (`wrangler pages dev`),
which behaves like the real host, and asked for each address.

- **Cloudflare ignored the rule.** It said: "Infinite loop detected in this rule and has been
  ignored", for `/read/*  /read/index.html  200`.
- **Every unknown address answered 200 with the front page.** That is what Cloudflare does when
  a site has no `404.html`. A mistyped link, `/.env` and `/intent/` all "worked". The first
  version of the look would have called each one real content, so every good release would
  have failed its own check.
- **The commit isn't in the app's main script.** The build puts it in a script the main one
  loads later (`rarely-used-*.js`). The folder check looked in every script, so it passed. The
  live look fetched only the main script, so it would have failed every real release.
- **`/privacy.html` answers 308** and sends the browser on to `/privacy`. So the page a reader
  gets is the one at `/privacy`, and a caching rule should name that address.

## What changed

- The site ships a "no page here" page (`apps/landing/404.html`). The folder check requires it
  and allows it. With it, every unknown address answers a real 404.
- The `_redirects` file is gone. The app keeps its place after the `#`, so it needs no
  catch-all rule.
- The live look first asks for two addresses that can't exist, one at the top and one under
  `/read/`. A development address that answers the same way counts as serving nothing, whatever
  the host does with unknown addresses. A test covers a host that answers 200 with the front
  page, and still catches a pitch build that went up.
- The live look follows the scripts the main script names, one step down, to find the commit.
- `_headers` names `/privacy` and `/read/`, the addresses Cloudflare really serves. Each
  rule was then seen in the server's answers: no-cache on the pages, the service worker and the
  manifest, and a year's cache on the app's named build files.
- The look no longer excuses a development address that answers with the app's own page. That
  excuse only existed for the deleted rule, and now it could only hide a leak.

Afterwards, against the same local server, the look reported only what the owner still owes:
the spam check's real key and the privacy page's contact address. A made-up pitch page placed in
the folder was reported. Tests: `.claude/skills/deploy-site/scripts/live.test.mjs` and
`shipped.test.mjs`.
