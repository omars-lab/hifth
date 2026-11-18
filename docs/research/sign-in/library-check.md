# Sign-in libraries: checking the two research passes

Checked on 2026-11-18. This page re-opens the sources behind the library claims in the two earlier passes (`a/research.md` and `b/research.md`) and settles the points they left open or disagreed on.

How to read the "how I read it" column:

- **fetched (GitHub)**: read straight from GitHub's API or from the file in the repository, word for word.
- **fetched (npm)**: read from the npm package registry.
- **fetched (raw)**: downloaded the page and searched its text myself, word for word.
- **fetched (summary)**: opened the page through a tool that hands back a short summary written by a small model, so a quote may not be word for word.
- **snippet only**: seen only as a search result, page not opened.

The "agrees with" column says whether the finding matches pass A, pass B, both, or neither. "Neither" also covers points that neither pass looked at.

Two pages had lines written to AI agents, and I ignored both:

- a bot comment on Better Auth issue #10598 asking agents to install a tool;
- a "Documentation Index" block on Cloudflare's limits page telling agents to fetch another file.

Nothing was filled in, signed into or filed anywhere.

## Summary

1. **Arctic** was deprecated on 29 July 2026, which agrees with pass A. Its npm package carries a "no longer supported" flag. The repository is not archived, but its library source has been removed and replaced by copy-in example code. The Apple provider survives only in the last npm release, 3.7.0, and in the v3.7.0 tag.
2. **Oslo**: every `@oslojs` package except `@oslojs/encoding` was deprecated the same day as Arctic. The Lucia site no longer mentions Oslo, and its session sample uses only the platform's built-in crypto.
3. **Lucia** has been deprecated since March 2025, which is confirmed. lucia-auth.com is now a learning page that points to a single copy-in file, `auth_session.ts`, covering sessions on SQLite.
4. **Better Auth**:
   - a. **Workers and D1**: it runs on Cloudflare Workers with D1. The official docs and the 1.5 release post show passing the D1 binding straight in. Cloudflare's own limits page says sign-in work "typically" uses 10 to 20 ms of CPU, against a 10 ms limit on the free plan, so that limit is a real risk until we measure it. Bundle size is no longer a worry, because the limit is now 64 MiB on both plans.
   - b. **Issue #5243** (Apple's web sign-in failing with a state mismatch): the first fix was reverted. A different fix was merged the next day and is still in the code: the server turns Apple's POST into a GET redirect, so the browser sends the cookie. A later report from May 2026 had a different cause in a separate add-on and was fixed there. I read the source; I did not run it.
   - c. **Revoking Apple's link on delete**: Better Auth does not call Apple's revoke endpoint when a user is deleted. Its account table has a refresh-token column, but the app's sign-in only fills it if we send the refresh token ourselves. A hook that runs before deletion, `beforeDelete`, lets us call Apple's revoke ourselves.
   - d. **Native sign-in with Apple's identity token**: confirmed. Sign-in takes an `idToken` object and makes no redirect, and `appBundleIdentifier` (the app's bundle id) is needed. The input also accepts an optional refresh token.
   - e. **Release pace**: very fast. There were 12 releases in the first two weeks of November 2026. A minor version comes every 3 to 4 months, and each one has carried breaking changes. Version 1.7 forced a database change and then took it back in 1.7.3. There has been no 2.0. Better Auth joined Vercel on 7 July 2026.
5. **Auth.js**: confirmed "now part of Better Auth" since 22 September 2025. It gets "security patches and urgent issues" only. New projects are told to start with Better Auth. The last npm release was July 2026.
6. **OpenAuth** is still "in beta". It looks unmaintained: the last release was March 2025 and the main branch has had no commit since April 2025. It ships Cloudflare KV storage only, with no D1, though the storage interface is a simple key-value shape we could write a D1 version of. It has no native identity-token sign-in.
7. **jose** is at version 6.2.17, published 9 November 2026. It has zero dependencies, lists Cloudflare Workers as supported, and is actively maintained.
8. **Anything new**: no new Workers-native sign-in library from 2026 that I could source and trust. Cloudflare has not shipped sign-in for an app's own public users. Its "Access for Workers" (August 2026) is for staff and team members, not the public.

## 1. Arctic

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| README: "Arctic was deprecated on July 2026. Some example code (with comments) to replace the package can be found under /code." | [github.com/pilcrowonpaper/arctic](https://github.com/pilcrowonpaper/arctic) | fetched (summary), confirmed by the site text below | A |
| Website: "Arctic was deprecated in July 2026 ... The old documentation and API reference can be found in the GitHub repository" (at tag v3.7.0). The old page `/providers/apple` now returns 404, which is why pass B could not open it. | [arctic.pilcrowonpaper.com](https://arctic.pilcrowonpaper.com/) | fetched (raw) | A; also explains B's 404 |
| Author's post, 29 July 2026: "I am deprecating the Arctic NPM package and most NPM packages published under the Oslo project." "On Arctic, the NPM package is deprecated." | [pilcrowonpaper.com/blog/18](https://pilcrowonpaper.com/blog/18) | fetched (raw) | A |
| The repository is **not archived**; it was last pushed 10 Nov 2026. The `src/` folder is gone from the main branch, which now holds only the website and a `code/` folder of example files. Among those files is `token_revocation_request.ts`, a sample request for revoking a token. | GitHub API, `repos/pilcrowonpaper/arctic` | fetched (GitHub) | neither (new detail) |
| npm `arctic`: latest is 3.7.0, flagged deprecated with "Package no longer supported", changed 2026-07-29. | `npm view arctic` | fetched (npm) | A |
| The Apple provider still exists at tag v3.7.0 (`src/providers/apple.ts`), so `arctic@3.7.0` still contains it. Nothing will be fixed in it. | GitHub API at `ref=v3.7.0` | fetched (GitHub) | B had the Apple constructor from older docs |

## 2. Oslo (`@oslojs/*`)

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| "On Oslo, the NPM packages are deprecated except for the encoding package." `@oslojs/encoding` stays until built-in base64 and hex are common, "(I expect around 2028)". | [pilcrowonpaper.com/blog/18](https://pilcrowonpaper.com/blog/18) | fetched (raw) | neither (neither pass checked Oslo) |
| `@oslojs/jwt` 0.3.0 and `@oslojs/crypto` 1.0.1 are both flagged "Package no longer supported" (2026-07-29). `@oslojs/encoding` 1.1.0 is not flagged. | `npm view @oslojs/...` | fetched (npm) | neither |
| The Lucia site does not mention Oslo. Its session sample, `auth_session.ts`, has no imports at all. It uses `crypto.getRandomValues`, `crypto.subtle.digest("SHA-256", ...)` and `Uint8Array.toBase64()`. So no, the Lucia site does not now recommend Oslo. | [lucia-auth.com](https://lucia-auth.com/), `lucia-auth/lucia/code/auth_session.ts` | fetched (summary) for the site; fetched (GitHub) for the file | neither |

## 3. Lucia

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| "Lucia was deprecated in March 2025." "This website was updated in July 2026." The site points to the Auth Book and to `code/auth_session.ts`. | [lucia-auth.com](https://lucia-auth.com/) | fetched (summary) | both |
| `auth_session.ts` is one copy-in file under a "Zero-Clause BSD" licence ("free to use, copy, modify ... without any attribution"). It holds SQLite tables for `user` and `auth_session`, sessions that last 10 days and extend when used, and a stored SHA-256 hash of the secret. It warns "CSRF PROTECTION MUST BE IMPLEMENTED IF THE SESSION TOKEN IS STORED IN A COOKIE" and suggests rejecting non-GET requests whose `Sec-Fetch-Site` is not `same-origin`. | `lucia-auth/lucia/code/auth_session.ts` | fetched (GitHub) | both (B quoted the README line) |
| A note for us: that suggested check would reject Apple's web callback, which is a cross-site POST. The Apple callback route would need to be exempt from it, or turned into a GET redirect first, the way Better Auth does it (see 4b). This is my reading, not stated by the source. | the same file | my inference | neither |
| The Lucia repository is not archived; it was last pushed 8 Aug 2026. | GitHub API | fetched (GitHub) | neither |

## 4a. Better Auth on Cloudflare Workers with D1

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| The 1.5 release post (28 Feb 2026) says Better Auth "now natively supports Cloudflare D1 as a first-class database option. Pass your D1 binding directly". Its example is `database: env.DB, // D1 binding, auto-detected`. "D1 does not support interactive transactions; Better Auth uses D1's `batch()` API for atomicity instead" (shortened). | [better-auth.com/blog/1-5](https://better-auth.com/blog/1-5), source `docs/content/blogs/1-5.mdx` | fetched (GitHub) | A |
| The official database docs have an "Example: Cloudflare D1" section with `import { env } from "cloudflare:workers"` and `database: env.DB`. Migrations run through an endpoint, because "the CLI cannot access it directly". | [better-auth.com/docs/concepts/database](https://www.better-auth.com/docs/concepts/database) | fetched (GitHub) and fetched (summary) of the live page | both |
| There is **no** official Cloudflare integration page: `/docs/integrations/cloudflare` returns 404, and the docs' integrations folder has no Cloudflare file. The D1 instructions live only on the database page and in the 1.5 post. | the same URL; GitHub folder listing | fetched (GitHub), fetched (summary) for the 404 | B (B also hit the 404) |
| Not every part works on D1. The 1.7 notes say SCIM (syncing users from a company directory) does not support D1. The password docs say D1 doesn't support transactions, so password resets are less atomic. Neither matters for Apple-only sign-in. | `blogs/1-7.mdx`, `docs/authentication/email-password.mdx` | fetched (GitHub) | neither |
| CPU: Cloudflare's limits page gives 10 ms per request on the free plan, and says waiting on network or database "does **not** count toward CPU time". It also says: "Heavier workloads that handle authentication, server-side rendering, or parse large payloads typically use 10-20 ms." | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) | fetched (raw) | partly B; the "10-20 ms" line cuts against B's "very likely enough" |
| A known CPU problem: issue #8860, "email/password sign-up exceeds CPU time limit on Cloudflare Workers". The cause was hashing passwords in plain JavaScript. It was fixed by PR #8685, merged 1 Apr 2026. We would not hash passwords, but it shows sign-in work can sit near 10 ms. | [#8860](https://github.com/better-auth/better-auth/issues/8860), [#8685](https://github.com/better-auth/better-auth/pull/8685) | fetched (GitHub) | neither |
| Worker size: "Worker size (uncompressed) 64 MiB" on both Free and Paid. "There is no compressed size limit. Only the uncompressed bundle size counts." There is a separate limit of 1 second for startup: "A Worker must parse and execute its global scope ... within 1 second." | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) | fetched (raw) | neither (neither pass gave a size limit; older sources said 3 MB on free) |
| I found no Better Auth issue about the Workers size limit. | GitHub issue search | fetched (GitHub) | neither |

## 4b. Better Auth issue #5243: Apple's web sign-in fails with "state mismatch"

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| #5243, "OAuth providers fail with `state_mismatch` error when using POST callbacks". Closed as completed on 4 Nov 2025 and locked as "resolved" on 31 Mar 2026. | [#5243](https://github.com/better-auth/better-auth/issues/5243) | fetched (GitHub) | A |
| The first fix, PR #5748 (sets the cookie's SameSite to "none"), was reverted on 4 Nov 2025 by commit 956eb5b. Commenters on 19 and 24 Nov 2025 said it was "probably not fixed yet" and "still not working ... v1.4.1". | #5243 comments; commit 956eb5b | fetched (GitHub) | A (A stops here) |
| A second fix, PR #5759 "fix(oauth): redirect to GET for POST method", was merged on 5 Nov 2025: "Redirect POST callbacks to GET with the same params". The current `callback.ts` still has it: "Handle POST requests by redirecting to GET to ensure cookies are sent". A GET that the browser makes as a top-level page load does carry SameSite=Lax cookies. | [#5759](https://github.com/better-auth/better-auth/pull/5759), `packages/better-auth/src/api/routes/callback.ts` | fetched (GitHub). Source read, not run. | neither (new) |
| Later reports had other causes. #7642 (Jan 2026, Apple `state_not_found`) was a NestJS body parser eating the POST body, not a Better Auth bug. #9491 (May 2026, "Apple Sign In on web returns State mismatch ... on every callback") was traced to the `dash()` add-on and fixed in `@better-auth/infra` 0.2.7. #10598 (Jul 2026) was a different add-on, `oAuthProxy`, dropping Apple's one-time name; it was fixed by PR #10599. | [#7642](https://github.com/better-auth/better-auth/issues/7642), [#9491](https://github.com/better-auth/better-auth/issues/9491), [#10598](https://github.com/better-auth/better-auth/issues/10598) | fetched (GitHub) | neither (new) |
| Two open issues touch the state cookie, but neither is about Apple: #11012 (the state cookie lives 5 minutes, but its database row lives 10) and #12085 (LinkedIn). | GitHub issue search | fetched (GitHub) | neither |
| A side effect worth knowing: the redirect copies the posted `user` field (Apple's one-time name and email) into the GET address, so it can land in request logs. This is my reading of the source. | `callback.ts` | fetched (GitHub), my inference | neither |

## 4c. Deleting a user and revoking the Apple link

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| The Apple provider source has the authorize, token and key-list addresses and a refresh function, but **no revoke**. A search of the repository for `appleid.apple.com/auth/revoke` returns nothing. | `packages/core/src/social-providers/apple.ts`; GitHub code search | fetched (GitHub) | neither (both passes left it open) |
| The shared provider interface has an optional `revokeToken?: (token: string) => Promise<void>`. Apple does not fill it in, and I found no call to it in the delete-user or unlink-account code. | `packages/core/src/oauth2/oauth-provider.ts`, `api/routes/update-user.ts`, `api/routes/account.ts`, `db/internal-adapter.ts` | fetched (GitHub) | neither |
| The account table has `accessToken`, `refreshToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt` and `idToken` columns. "Better Auth doesn't encrypt tokens by default"; it suggests database hooks to encrypt them. | `docs/concepts/database.mdx`, `docs/concepts/users-accounts.mdx` | fetched (GitHub) | neither (B said the page didn't say) |
| On the web flow the server exchanges Apple's code at Apple's token address, so the refresh token Apple returns can be stored. In the app's identity-token flow the input takes `token`, `nonce`, `accessToken`, `refreshToken`, `expiresAt` and `user`, but **no authorization code**. So the refresh-token column only gets filled if our server first exchanges the app's authorization code with Apple itself and passes the result in. This is my reading of the source. | `api/routes/sign-in.ts` (the `idToken` input) | fetched (GitHub), with inference | neither |
| Delete hooks exist: `user.deleteUser.beforeDelete(user, request)` and `afterDelete(user, request)`. In the source, `beforeDelete` runs **before** the user is removed from the database, so it can still read the user's account row and its refresh token, then call Apple's revoke. Throwing an `APIError` there stops the deletion. My reading of the source. | `docs/concepts/users-accounts.mdx`; `update-user.ts` lines ~380 to 390 | fetched (GitHub) | neither |
| For users who signed in through Apple and have no password, deleting needs either a "fresh" session (signed in within `session.freshAge`, 1 day by default) or the email check `sendDeleteAccountVerification`. | `docs/concepts/users-accounts.mdx` | fetched (GitHub) | neither |

## 4d. Native Apple sign-in with the identity token

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| `signIn.social` takes `idToken: { token, nonce?, accessToken? }`, with no redirect. The source also accepts `refreshToken`, `expiresAt` and `user` (Apple's first-time name). | [Better Auth: Apple](https://www.better-auth.com/docs/authentication/apple), `api/routes/sign-in.ts` | fetched (GitHub) | both |
| "On native iOS, it doesn't use the service ID but the app ID (bundle ID) as client ID ... So you need to provide the `appBundleIdentifier`." For both the web and the app, "prefer `clientId: string[]` or `audience: string[]`". You also have to add `https://appleid.apple.com` to `trustedOrigins`. | the same docs page | fetched (GitHub) | both |
| Version 1.7 moved checking identity tokens into one shared verifier ("Identity tokens go through one verifier"). "The built-in provider options are unchanged." | `docs/guides/1-7-upgrade-guide.mdx` | fetched (GitHub) | neither |

## 4e. Release pace and breaking changes

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| Minor releases: 1.4.0 on 22 Nov 2025, 1.5.0 on 1 Mar 2026, 1.6.0 on 6 Apr 2026, 1.7.0 on 18 Aug 2026. There is no 2.0. Patch releases come every few days: v1.7.15 to v1.7.25 between 1 and 14 Nov 2026, and the 1.6 line still got patches until 1 Nov 2026. | GitHub releases API | fetched (GitHub) | neither (B only said "fast-moving") |
| The 1.6 and 1.7 posts each have a "Breaking" section, and the 1.7 upgrade guide lists about 50 changes. Since 1.6 there are two tracks: "`next` is the beta track. It ships new features, refactors, and breaking changes, after a beta cycle." | `blogs/1-6.mdx`, `blogs/1-7.mdx`, `guides/1-7-upgrade-guide.mdx` | fetched (GitHub) | neither |
| A recent slip: "Better Auth 1.7.0 added a required field, `issuer`, to the account table ... Version 1.7.3 removes that requirement." "We did not meet that expectation in 1.7." (7 Sep 2026) | `blogs/1-7-account-schema.mdx` | fetched (GitHub) | neither |
| "Better Auth is joining Vercel" (7 Jul 2026). It says it stays "open source, framework and platform agnostic". | `blogs/better-auth-joins-vercel.mdx` | fetched (GitHub) | neither |

## 5. Auth.js

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| "The Auth.js project is now part of Better Auth." | [authjs.dev](https://authjs.dev/) | fetched (summary) | A |
| Announcement, 22 Sep 2025: "we'll keep addressing security patches and urgent issues as they come up." "we strongly recommend new projects to start with Better Auth unless there are some very specific feature gaps (most notably stateless session management without a database)." | [better-auth.com/blog/authjs-joins-better-auth](https://better-auth.com/blog/authjs-joins-better-auth) | fetched (GitHub source of the post) | neither (A gave only the headline) |
| npm `@auth/core` is at 0.41.3 and was last changed 20 Jul 2026, still a 0.x version. The `nextauthjs/next-auth` repository is not archived and was last pushed 22 Jul 2026. | `npm view @auth/core`, GitHub API | fetched (npm), fetched (GitHub) | neither |

## 6. OpenAuth

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| "It is currently in beta." | [openauth.js.org/docs](https://openauth.js.org/docs/) | fetched (raw) | A |
| Storage: "a simple KV store with various implementations for zero overhead systems like Cloudflare KV and DynamoDB." "if on Cloudflare we recommend Cloudflare KV." The source folder has `aws.ts`, `cloudflare.ts` (takes a `KVNamespace`), `dynamo.ts` and `memory.ts`, so **no D1**. | the same page; `packages/openauth/src/storage/` | fetched (raw), fetched (GitHub) | A |
| The storage interface is only `get`, `set` (with an optional expiry), `remove` and `scan` by prefix. A D1 version looks writable by us, but none ships. My inference. | `storage/storage.ts` | fetched (GitHub), my inference | neither |
| Maintenance: the repository has moved to `anomalyco/openauth` and is not archived. The last npm release is `@openauthjs/openauth` 0.4.3 from 22 Mar 2025. The last commit on `master` was 9 Apr 2025. The 14 Nov 2026 "push" was an "auto: format code" commit on a side branch, `opencode-badge`. It has 150 open issues. | GitHub API, `npm view` | fetched (GitHub), fetched (npm) | neither (both passes said only "beta") |
| Apple provider: redirect sign-in only, with a `responseMode: "form_post"` option. There is no way to sign in by handing it the app's identity token; the docs describe only the code flow with PKCE for mobile. | `provider/apple.ts`; docs | fetched (GitHub), fetched (summary) | A |

## 7. jose

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| "Dependencies: 0" and "`jose` has no dependencies". | [jose README](https://github.com/panva/jose) | fetched (raw) | both |
| Under "Supported Runtimes" it lists "Cloudflare Workers". The universal build "Assumes runtime support of WebCryptoAPI and Fetch API". | the same README | fetched (raw) | both |
| npm `jose` is at 6.2.17, published 9 Nov 2026, and the repository was pushed 12 Nov 2026. | `npm view jose`, GitHub API | fetched (npm), fetched (GitHub) | B (B said v6.x) |

## 8. Anything else

| What the source says | Link | How I read it | Agrees with |
| --- | --- | --- | --- |
| Cloudflare's "Enable Access on a Worker or all Workers at once" (14 Aug 2026) controls sign-in by "Cloudflare account membership, email address, or email domain". That is a lock for staff or a team, not sign-up for the public, and it does not mention Apple. | [Cloudflare changelog, 2026-08-14](https://developers.cloudflare.com/changelog/post/2026-08-14-workers-access/) | fetched (summary) | neither |
| Other names that turned up only in search results, not checked: "Workers Auth" (a D1 adapter docs site), `@auth0/auth0-hono` (a beta Auth0 package for Workers, which uses a hosted service), `cloudflare-apple-sign-in` (a fork with about 5 downloads a week), a guide to "native email and password" on Workers, and a write-up saying Access for Workers breaks WebSockets. None is a credible new library for us. | [workers-auth-docs.pages.dev](https://workers-auth-docs.pages.dev/adapters/d1), [socket.dev cloudflare-apple-sign-in](https://socket.dev/npm/package/cloudflare-apple-sign-in), [flaviocopes](https://flaviocopes.com/native-email-password-authentication-cloudflare-workers/), [ecorpit write-up](https://ecorpit.com/cloudflare-workers-access-all-workers-websocket-403-ctx-access-gaps-2026/) | snippet only | neither |

## Still not settled

- **CPU time**: how much one Apple sign-in through Better Auth on Workers really uses. Cloudflare says sign-in work typically takes 10 to 20 ms, and the free limit is 10 ms. Only a measurement on a deployed Worker settles it, for example the CPU time shown in Workers Logs.
- **Bundle size and startup time** of Better Auth on Workers. The size limit is no longer a concern (64 MiB), but the 1 second startup limit was not measured.
- **Lucia's session sample on Workers**: whether `Uint8Array.toBase64()` works there. The sample relies on it, and I found no Cloudflare page that says yes. If it does not work, swap in `btoa` or `@oslojs/encoding`, which is still maintained.
- **Whether PR #5759 really ends the problem in #5243.** I read the code but did not run an Apple web sign-in. A comment saying it still failed on 1.4.1 (24 Nov 2025) came after the fix merged, and nobody answered it before the issue was locked.
- **Revoking Apple's link after an app sign-in**: we have to exchange the app's authorization code with Apple and keep the refresh token ourselves. Neither pass nor this check confirmed that Better Auth stores a `refreshToken` passed in through `idToken` on the account row. The input accepts one, but I did not trace the code to the database write.
- **The Arctic website's old Apple page** (now a 404) was not opened. The v3.7.0 source has the Apple provider, but I did not read whether it signs Apple's client secret itself.
