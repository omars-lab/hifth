# Sign in with Apple and sign-in for testers: raw findings (researcher A)

Every source below was read on **2026-11-15**. The "how seen" column says how:

- **fetched** means the page itself was opened and read. The reading tool hands back a summary of the page, so quotes here are near-verbatim, not exact. Check any line before it is printed anywhere.
- **snippet** means it was seen only in a search result. Treat a snippet-only line as unconfirmed. The checker should re-open these before anyone builds on them.

The design that uses these findings is [design.md](design.md), next to this file. No Qur'an text, translation or commentary appears here.

**How this was gathered.** Five research passes ran in parallel, one per topic, each told to tag every claim. Their notes were then merged here. One honest caveat for the checker: the notes for both researchers were kept in one shared scratch folder. I read only my five files and did not open the other four (`native_and_review.md`, `second_way_and_testers.md`, `web_signin.md`, `where_accounts_live.md`), which are probably researcher B's. Nothing from them is in here, but the two passes shared a folder, so treat that as a small dent in independence.

## Contents

1. [Apple's sign-in sheet inside the app](#1-apples-sign-in-sheet-inside-the-app)
2. [What is inside Apple's identity token, and how a server checks it](#2-what-is-inside-apples-identity-token-and-how-a-server-checks-it)
3. [Signing in inside the app's web view, or through a browser sheet](#3-signing-in-inside-the-apps-web-view-or-through-a-browser-sheet)
4. [Apple's review rules: sign-in, deletion, privacy](#4-apples-review-rules-sign-in-deletion-privacy)
5. [Deleting an account and revoking Apple's permission](#5-deleting-an-account-and-revoking-apples-permission)
6. [Hidden email addresses, the name arriving once, Apple's notices to the server](#6-hidden-email-addresses-the-name-arriving-once-apples-notices-to-the-server)
7. [Sign in with Apple on a website, including Firefox](#7-sign-in-with-apple-on-a-website-including-firefox)
8. [Supabase as the home for accounts](#8-supabase-as-the-home-for-accounts)
9. [Cloudflare as the home for accounts](#9-cloudflare-as-the-home-for-accounts)
10. [Sessions for a page served from the app's own address](#10-sessions-for-a-page-served-from-the-apps-own-address)
11. [Apple's own iCloud database as a home, and Firebase](#11-apples-own-icloud-database-as-a-home-and-firebase)
12. [A second way in: email code, email link, passkey, Google](#12-a-second-way-in-email-code-email-link-passkey-google)
13. [What proper sign-in for testers needs beyond the button](#13-what-proper-sign-in-for-testers-needs-beyond-the-button)
14. [Locking records so we cannot read them](#14-locking-records-so-we-cannot-read-them)
15. [How other Qur'an and hifz apps do accounts](#15-how-other-quran-and-hifz-apps-do-accounts)
16. [What I found in this repository](#16-what-i-found-in-this-repository)
17. [What I did not look at](#17-what-i-did-not-look-at)

---

## 1. Apple's sign-in sheet inside the app

| What the source says | Source | How seen |
| --- | --- | --- |
| The app makes a request from `ASAuthorizationAppleIDProvider`, runs it through `ASAuthorizationController`, and on success gets a credential with "an opaque user identifier". | [ASAuthorizationAppleIDProvider](https://developer.apple.com/tutorials/data/documentation/authenticationservices/asauthorizationappleidprovider.json) | fetched |
| The request can ask for name and email (`requestedScopes`), and carries a `nonce` ("A string value to pass to the identity provider") and a `state`. Available from iOS 13 and macOS 10.15. | [ASAuthorizationOpenIDRequest](https://developer.apple.com/tutorials/data/documentation/authenticationservices/asauthorizationopenidrequest.json) | fetched |
| Apple's nonce page says the value can be checked against the identity token. It says **nothing about hashing**. | [nonce](https://developer.apple.com/tutorials/data/documentation/authenticationservices/asauthorizationopenidrequest/nonce.json) | fetched |
| "Send the SHA-256 hash of the nonce to Apple, keep the original" is Firebase's convention: "Firebase validates the response by hashing the original nonce and comparing it to the value passed by Apple." | [Firebase: Apple on iOS](https://firebase.google.com/docs/auth/ios/apple) | fetched |
| The credential holds `user`, `identityToken` (a signed token "that securely communicates information about the user to the app"), `authorizationCode`, `fullName`, `email`, `realUserStatus`. | [ASAuthorizationAppleIDCredential](https://developer.apple.com/tutorials/data/documentation/authenticationservices/asauthorizationappleidcredential.json) | fetched |
| The authorization code "is single-use only and valid for five minutes." | [Generate and validate tokens](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json) | fetched |
| Apple gives **no number** for how long the identity token lasts. A 2019 blog measured 10 minutes after issue; a tutorial's sample shows the same. A library's docs say about 5 minutes. | [Curtis Herbert](https://blog.curtisherbert.com/so-theyve-signed-in-with-apple-now-what/) fetched; [sarunw.com](https://sarunw.com/posts/sign-in-with-apple-3/) fetched; [siwa crate](https://docs.rs/crate/siwa/0.1.2) | fetched, fetched, snippet |
| "Native apps only allow the signed-in iCloud user to use Sign in with Apple. Web-based interactions allow logins using any Apple Account." | [Authenticating users](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.md) | fetched |
| The entitlement `com.apple.developer.applesignin` with value `Default` "lets your app use Sign in with Apple", on iOS 13+ and macOS 10.15+. Xcode's capability switch adds it. | [Entitlement](https://developer.apple.com/tutorials/data/documentation/bundleresources/entitlements/com.apple.developer.applesignin.json) | fetched |
| Error 1000 ("unknown") is reported both from a missing entitlement or profile and from Apple's server refusing. | Forum threads [819070](https://developer.apple.com/forums/thread/819070), [836768](https://developer.apple.com/forums/thread/836768), [837986](https://developer.apple.com/forums/thread/837986) | snippet |
| At launch, `getCredentialState(forUserID:)` says authorized, revoked, not found or transferred. It is "a local, inexpensive, nonnetwork call". Asking for a new identity token more than once a day can be throttled. | [Verifying a user](https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json), [CredentialState](https://developer.apple.com/tutorials/data/documentation/authenticationservices/asauthorizationappleidprovider/credentialstate.json) | fetched |
| When a person deletes their whole Apple Account, the app gets **no** revoked notice; Apple says to rely on the launch check. | [Processing changes](https://developer.apple.com/tutorials/data/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts.json) | fetched |
| Button rules: no smaller than other sign-in buttons, one of "Sign in with Apple", "Sign up with Apple", "Continue with Apple", black or white, at least 140×30 points. "App Review evaluates all custom Sign in with Apple buttons". | [Human Interface Guidelines](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/sign-in-with-apple.json) | fetched |
| TestFlight: no Apple statement that sign-in behaves differently. Forum reports of "works from Xcode, fails in TestFlight" mostly trace to setup. | Threads [660156](https://developer.apple.com/forums/thread/660156), [839521](https://developer.apple.com/forums/thread/839521), [837986](https://developer.apple.com/forums/thread/837986) | snippet |

**My reading.** The nonce rule our server follows is our own choice, as long as the app and the server agree. Hashing it is the common convention. The entitlement row is the only Apple statement; that the sheet fails without it is my guess.

## 2. What is inside Apple's identity token, and how a server checks it

| What the source says | Source | How seen |
| --- | --- | --- |
| `iss` is `https://appleid.apple.com`. `aud` is "the `client_id` from your developer account". `sub` is the person's id and "Uses the same identifier across all of the apps in the development team"; it differs between teams and does not change if the person stops and starts again. | [id_token](https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/authorizationi/id_token.json) | fetched |
| A `client_id` is "The identifier (App ID or Services ID) for your app". | [Generate and validate tokens](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json) | fetched |
| `email_verified` and `is_private_email` can come as a string or a true/false value. `real_user_status` is only in native sign-ins (iOS 14+, macOS 11+), never on the web. The name is never in the token. | [id_token](https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/authorizationi/id_token.json), [Receiving a user's identity token](https://developer.apple.com/documentation/signinwithapple/receiving-a-users-identity-token.md) | fetched |
| "All of your applications share the same identifier for the user"; identifiers are "team-scoped". | [Transferring apps and users](https://developer.apple.com/tutorials/data/documentation/signinwithapple/transferring-your-apps-and-users-to-another-team.md) | fetched |
| An Apple engineer, June 2026: without grouping "each App ID its associated website will be treated as a separate account creation flow. However, the same user ID and private email address will be provided". | [Forum 834970](https://developer.apple.com/forums/thread/834970) | fetched |
| Counter-report: in 2019 an app and its website gave different ids; "same issue" in 2023; no Apple reply. | [Forum 124448](https://developer.apple.com/forums/thread/124448) | fetched |
| Grouping identifiers makes consent happen once: "A simple confirmation to continue appears even if the app bundle IDs are different across systems, such as iOS, macOS, and the web." | [Authenticating users](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.md), [Group apps](https://developer.apple.com/help/account/capabilities/group-apps-for-sign-in-with-apple) | fetched |
| Apple's checking steps: signature against Apple's public key, nonce, `iss`, `aud`, and that the time is before `exp`. The prose says "JWS E256". | [Verifying a user](https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json) | fetched |
| The live key list at `appleid.apple.com/auth/keys` held 3 keys, all RSA, all `RS256`. So the prose and the live keys disagree; trust the keys. | [auth/keys](https://appleid.apple.com/auth/keys) | fetched live |
| "The endpoint can return multiple keys ... select the key with the matching key identifier (`kid`)". | [Fetch Apple's public key](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/fetch-apple's-public-key-for-verifying-token-signature.json) | fetched |
| The code is swapped at `POST appleid.apple.com/auth/token` with `client_id`, `client_secret`, `code`, `grant_type`. The answer holds an access token (1 hour in the example), a refresh token and an identity token. A refresh token may be checked "up to once a day". | [Generate and validate tokens](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json), [Verifying a user](https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json) | fetched |

**My reading.** One person should get one `sub` in the app and on the website, because the team is the same. One unanswered report says otherwise, so this needs one real test. The server must accept two `aud` values: the app's bundle id and the website's Services ID.

## 3. Signing in inside the app's web view, or through a browser sheet

| What the source says | Source | How seen |
| --- | --- | --- |
| An Apple engineer, 2023: passkeys in a web view are "only supported for first-party uses in WKWebView. For third-party sign in (e.g. Sign in with Apple), you'll need to use ASWebAuthenticationSession." | [Forum 738229](https://developer.apple.com/forums/thread/738229) | fetched |
| Apple's web button inside an app's web view broke on iOS 17.1: a plain form instead of the sheet, an empty popup. Fixes people used were Swift's own sheet, or Safari plus a return link. No Apple reply. | [Forum 740376](https://developer.apple.com/forums/thread/740376) | fetched |
| "[SOAuthorizationCore] canceling now - no SPI authorization delegate" from the button in a web view, 2021, no replies. | [Forum 687901](https://developer.apple.com/forums/thread/687901) | fetched |
| The browser sheet and the app's web view do not share cookies. | [Forum 774380](https://developer.apple.com/forums/thread/774380) | snippet |
| App Review: "linking out to the default web browser to sign in or register an account provides a poor user experience". | [5.1.1(v) reference](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) | fetched |
| A return address "must use the HTTPS protocol, include a domain name, and can't contain an IP address or `localhost`". | [Generate and validate tokens](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json) | fetched |
| For other platforms Apple says open the sign-in page "in a browser tab", and for apps with their own link scheme, store the result on the server and then send the person back to the app. | [Other platforms](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json) | fetched |
| Matching an https return address in the browser sheet (`https(host:path:)`) needs iOS 17.4 and macOS 14.4. | [ASWebAuthenticationSession.Callback](https://developer.apple.com/tutorials/data/documentation/authenticationservices/aswebauthenticationsession/callback.json) | fetched |

**My reading.** The page inside our app is served from the app's own address (`hifth-app://`), not an https site, so it cannot be Apple's return address. The app's own sheet avoids every problem in this table.

## 4. Apple's review rules: sign-in, deletion, privacy

| What the source says | Source | How seen |
| --- | --- | --- |
| **4.8**: an app that uses "a third-party or social login service (such as ... Google Sign-In ...)" for the main account "must also offer as an equivalent option another login service" that collects only name and email, lets people keep their email private, and does not track for ads. Not needed if the app "exclusively uses your company's own account setup and sign-in systems". The text does not name Sign in with Apple. | [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) | fetched |
| **5.1.1(v)**: "If your app doesn't include significant account-based features, let people use it without a login. If your app supports account creation, you must also offer account deletion within the app." | same | fetched |
| **5.1.1(i)**: a privacy policy linked in App Store Connect and "within the app in an easily accessible manner", saying what is collected, who else gets it, how long it is kept, and "how a user can revoke consent and/or request deletion". | same | fetched |
| Deletion must "delete the entire account record, along with associated personal data"; turning an account off is not enough; no phone call or email needed; re-checking who you are first is allowed; a deletion that takes time is fine if the person is told. | [Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [5.1.1(v) reference](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) | fetched |
| "Apps that support Sign in with Apple should use the Sign in with Apple REST API to revoke user tokens." Apple's May 2022 news post says "you'll need to". | [5.1.1(v) reference](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion), [Apple news, 24 May 2022](https://developer.apple.com/news/?id=12m75xbj) | fetched |
| The App Store privacy label's "Sensitive Info" includes "religious or philosophical beliefs". "Other User Content", "User ID" and "Email Address" would also apply. Labels can be changed without a new build. | [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) | fetched |

**My reading.** An app whose only sign-in is Apple, or Apple plus our own email code, is not caught by 4.8. Adding Google later would be, and Apple already counts as the equal option.

## 5. Deleting an account and revoking Apple's permission

| What the source says | Source | How seen |
| --- | --- | --- |
| `POST appleid.apple.com/auth/revoke` with `client_id`, `client_secret` and `token` (a refresh or access token). | [Revoke tokens](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/revoke-tokens.json) | fetched |
| Apple's technote TN3194 (first published 3 Oct 2025): revoking is "the only way to programmatically invalidate user tokens"; it needs a refresh or access token. With none, "you must still fulfill the user's account deletion request": delete the data and point the person to revoke by hand. For new accounts, send the identity token **and the code** to your server, swap the code, keep the refresh token. | [TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple.md) | fetched |
| Firebase, which keeps no Apple tokens: "you must ask the user to sign in again before revoking their token and deleting the account". | [Firebase: Apple on iOS](https://firebase.google.com/docs/auth/ios/apple) | fetched |
| Supabase does not keep Apple's tokens. The request to revoke them automatically was closed "not planned" in December 2023. A community workaround calls `/auth/revoke` from a Supabase function. One commenter says signing in with the token "consumes" the code; another doubts it. | [supabase/auth #1308](https://github.com/supabase/auth/issues/1308) | fetched |
| The client secret for that call is a token signed with the key file. See section 7. | — | — |

**My reading.** Revoking needs the key file and a server, **even if no one ever signs in on the website**. The simplest path is Firebase's: ask the person to sign in once more when they delete, swap that fresh code and revoke at once. Then no Apple token is kept on our side.

## 6. Hidden email addresses, the name arriving once, Apple's notices to the server

| What the source says | Source | How seen |
| --- | --- | --- |
| Apple shares name and email "the first time the user logs in". It asks again only if the person "stops using Sign in with Apple and later reconnects". The email stays in later tokens; the name never returns. "immediately store it locally". | [Authenticating users](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.md) | fetched |
| To mail `@privaterelay.appleid.com` addresses, register each sending domain in the developer portal. Mail must pass SPF and/or DKIM with exact domain matches or it bounces. Each hidden address takes 100 emails a day. An individual account can register 32 sending sources. | [Configure private email relay](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service), [Communicating using the relay](https://developer.apple.com/tutorials/data/documentation/signinwithapple/communicating-using-the-private-email-relay-service.json) | fetched |
| "Avoid asking for a personal email address when people supply a private relay address." | [Human Interface Guidelines](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/sign-in-with-apple.json) | fetched |
| Apple can post notices to one https address on the main App ID: `email-disabled`, `email-enabled`, `consent-revoked`, `account-deleted`. TLS 1.2 or later. Developers in Korea must provide one. | [Enabling server-to-server notifications](https://developer.apple.com/help/account/capabilities/enabling-server-to-server-notifications), [Processing changes](https://developer.apple.com/tutorials/data/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts.json) | fetched |

## 7. Sign in with Apple on a website, including Firefox

| What the source says | Source | How seen |
| --- | --- | --- |
| A website needs a Services ID tied to the main App ID, with its domains and exact return addresses. "You don't need to upload a verification file". An individual account can register 10 website addresses. | [Configure for the web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web) | fetched |
| Apple's setup page says "you must have an existing app in the App Store that uses Sign in with Apple". The account help page asks only for the main App ID. **The two disagree.** | [Configuring your environment](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json), [Configure for the web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web) | fetched |
| The key file (`.p8`) downloads once: "you won't be able to download it again". Two keys per main App ID. Only the Account Holder or an Admin can make one. | [Create a private key](https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key) | fetched |
| The client secret is a token signed ES256 with the key file. It names the Team ID, the key's id, and the `client_id`. "It's an error to request an expiration time more than 15777000 seconds (six months) in the future". Apple sets no shortest life. | [Creating a client secret](https://developer.apple.com/tutorials/data/documentation/accountorganizationaldatasharing/creating-a-client-secret.json) | fetched |
| Asking for name or email forces `response_mode=form_post`: Apple's page posts a form back to our return address with `code`, `id_token`, `state`, and, the first time only, `user` (name and email). | [Other platforms](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json), [Configuring your webpage](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json) | fetched |
| That post comes from another site, so `SameSite=Lax` cookies do not arrive with it. A short-lived sign-in-only cookie set `SameSite=None; Secure` is the usual fix. | [bscotch blog, 2019](https://blog.bscotch.net/post/sign-in-with-apple-implementation-hurdles/), [Arctic v1](https://v1.arcticjs.dev/providers/apple) | fetched |
| Better Auth issue #5243: Apple sign-in fails with a state mismatch for exactly this reason; closed in November 2025, users said the fix was reverted; locked March 2026. | [better-auth #5243](https://github.com/better-auth/better-auth/issues/5243) | fetched |
| Apple's popup mode: the return address "must match the top-level page's domain"; a 2020 Firefox error showed the cross-window message failing when they differed. | [Forum 128788](https://developer.apple.com/forums/thread/128788) | fetched |
| May 2026: the popup shows only Apple's header and no form, in Firefox, Chrome and Safari; no replies. | [Forum 827464](https://developer.apple.com/forums/thread/827464) | fetched |
| Firefox's one related bug was about iCloud and an old cookie; fixed in Firefox 144. | [Bugzilla 1987563](https://bugzilla.mozilla.org/show_bug.cgi?id=1987563) | fetched |
| Mozilla support threads describe Apple sign-in not finishing in Firefox on Windows, with mixed fixes (tracking protection off for the site, clearing Apple's site data). | [SUMO 1410053](https://support.mozilla.org/en-US/questions/1410053), [SUMO 1290703](https://support.mozilla.org/gl/questions/1290703) | snippet (the site blocked fetching) |
| Testing needs a registered https domain; one workaround maps that domain to this computer in the hosts file. Each preview address counts toward the 10. | [Forum 128788](https://developer.apple.com/forums/thread/128788), [Auth.js Apple source](https://raw.githubusercontent.com/nextauthjs/next-auth/main/packages/core/src/providers/apple.ts) | fetched |

**My reading.** For Firefox, the full-page trip to Apple and back is safer than the popup. Our server can sign a fresh client secret, minutes long, for each call, so nobody has to renew one every six months. The cost is that the key file itself sits in the server's secrets.

## 8. Supabase as the home for accounts

| What the source says | Source | How seen |
| --- | --- | --- |
| Native sign-in hands Apple's token to `signInWithIdToken`. "Native-only implementations don't require secret key rotation." The website's redirect sign-in needs the six-month secret: "a critical maintenance task that will cause authentication failures if missed." | [Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [its .md copy](https://supabase.com/docs/guides/auth/social-login/auth-apple.md) | fetched |
| The Client IDs field holds several ids; if the website sign-in is used, the Services ID must be first. How to separate them is not stated. | [Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) | fetched |
| Supabase's own examples disagree on the nonce: the Swift one sends none, the Flutter one hashes for Apple and sends the original to Supabase. Community guides agree with Flutter. | same; [zenn.dev](https://zenn.dev/tomohiro629/articles/f28c77f1bac963), [dev.to](https://dev.to/gautier/apple-sign-in-with-flutter-and-supabase-40lp) | fetched; snippet |
| With the Data API off, "none of the auto-generated REST endpoints respond". The page does not say whether sign-in keeps working. | [Data API](https://supabase.com/docs/guides/database/data-api) | fetched |
| Access tokens last 1 hour by default. Refresh tokens "never expire but can only be used once". Session time limits are Pro only. | [Sessions](https://supabase.com/docs/guides/auth/sessions), [Pricing](https://supabase.com/pricing) | fetched |
| The built-in mailer only sends to the project's team, 2 an hour, "not meant for production use". Your own mail sender is allowed on Free, 30 an hour by default. Adding `{{ .Token }}` to the template sends a 6-digit code; one per 60 seconds; codes last 1 hour. | [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless) | fetched |
| Passkeys are "experimental"; registering one "requires an existing, confirmed, non-anonymous user", so a passkey cannot make an account; origins must be https. | [Passkeys](https://supabase.com/docs/guides/auth/passkeys) | fetched |
| Free: 50,000 monthly users, 500 MB, "Free projects are paused after 1 week of inactivity", restorable for a year, a warning email first. Two free projects, counted across every organisation where you are Owner or Admin; paused ones do not count. Pro from 25 US dollars a month, never paused. | [Pricing](https://supabase.com/pricing), [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) | fetched |
| The sign-in endpoint is limited to 150 requests per 5 minutes per IP address; email and code endpoints 30 per 5 minutes. Turnstile and hCaptcha can guard the forms. | [Rate limits](https://supabase.com/docs/guides/auth/rate-limits), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha) | fetched |
| Deleting a user "Requires a `service_role` key" and "should only be called on a server". | [admin.deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) | fetched |
| With the Data API on, the public key ships in every app and only row rules keep readers apart. A third-hand summary of a UpGuard scan says over 16,000 Supabase databases had readable tables because those rules were missing. | [API keys](https://supabase.com/docs/guides/api/api-keys) fetched; [startwithidentity.com, 28 Sep 2026](https://startwithidentity.com/blog/2026-09-28-16000-supabase-databases-readable-because-row-level-security-was-off.md) | fetched (the summary); the UpGuard report itself was not read |
| Several Supabase doc pages carried a line asking AI agents to file a feedback report. It was ignored; nothing was sent. | — | — |

## 9. Cloudflare as the home for accounts

| What the source says | Source | How seen |
| --- | --- | --- |
| `jose` has "no dependencies" and lists Cloudflare Workers as a supported runtime. It can both check Apple's token against Apple's key list and sign the client secret from the key file. It caches the key list 10 minutes by default. | [jose](https://github.com/panva/jose), [RemoteJWKSetOptions](https://github.com/panva/jose/blob/main/docs/jwks/remote/interfaces/RemoteJWKSetOptions.md), [jose README](https://raw.githubusercontent.com/panva/jose/main/README.md) | fetched |
| Workers' Web Crypto does ECDSA signing, checking and key import. | [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) | fetched |
| Workers Free: 100,000 requests a day, shared with Pages Functions; 10 ms of computing per request, and waiting on a fetch does not count. | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) | fetched |
| No measured cost found for checking an RSA signature on Workers. | [activepieces guide](https://www.activepieces.com/blog/cloudflare-workers-pricing-2026-free-vs-paid-plans.md) | snippet |
| D1 Free: 5 million rows read and 100,000 written a day, 5 GB in all, 500 MB per database, 10 databases. Over a daily limit it returns errors until midnight UTC. Nothing about pausing. | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) | fetched |
| KV Free allows 1,000 writes a day. | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) | fetched |
| The Rate Limiting binding counts per 10 or 60 seconds, "separately in each Cloudflare location"; its page does not say whether it is on Free. Turnstile is free with "Unlimited challenges". | [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/) | fetched |
| Lucia "was deprecated in March 2025" and replaced with a short code sample. Arctic was deprecated in July 2026; its author wrote that "OAuth 2.0 is not an ideal layer to abstract". | [lucia-auth.com](https://lucia-auth.com/), [Arctic](https://github.com/pilcrowonpaper/arctic), [pilcrowonpaper.com/blog/18](https://pilcrowonpaper.com/blog/18) | fetched |
| Better Auth 1.5 (28 Feb 2026): "Pass your D1 binding directly". Its Apple sign-in takes the app's token with "no redirection"; set `appBundleIdentifier`, because the app's token names the bundle id, not the Services ID. Its passkey and email-link add-ons exist; no page says they are tested on D1. | [Better Auth 1.5](https://better-auth.com/blog/1-5), [Better Auth: Apple](https://www.better-auth.com/docs/authentication/apple) fetched; [1.4 notes](https://better-auth.com/blog/1-4), [Magic link](https://better-auth.com/docs/plugins/magic-link) snippet | fetched / snippet |
| OpenAuth runs on Workers but is "currently in beta", stores in KV, not D1, and does not describe sign-in with the app's token. | [OpenAuth](https://openauth.js.org/docs/), [OpenAuth Apple](https://openauth.js.org/docs/provider/apple/) | fetched |
| Auth.js is "now part of Better Auth"; its Apple setup stores a ready-made six-month secret. | [Auth.js Apple](https://authjs.dev/getting-started/providers/apple) | fetched |
| Cloudflare Access is for an organisation's own staff. No Cloudflare product for consumer sign-in was found. | [Cloudflare One](https://developers.cloudflare.com/cloudflare-one/) | fetched |

## 10. Sessions for a page served from the app's own address

| What the source says | Source | How seen |
| --- | --- | --- |
| WebKit bug 226760: a web view page on its own link scheme sent `Origin: null`; fixed June 2021; a commenter said it came back in a later beta. | [WebKit 226760](https://bugs.webkit.org/show_bug.cgi?id=226760) | fetched |
| Asking how to set the origin in a web view to avoid cross-site blocks: no replies, 2023. | [Forum 741025](https://developer.apple.com/forums/thread/741025) | fetched |
| Web views are said to treat their own link schemes as not secure in some ways. | [Forum 725916](https://developer.apple.com/forums/thread/725916), [WebKit 222861](https://bugs.webkit.org/show_bug.cgi?id=222861) | snippet |
| Better Auth's bearer add-on sends the session in a header and warns it is "intended only for APIs that don't support cookies". | [Better Auth: Bearer](https://better-auth.com/docs/plugins/bearer) | fetched |

**My reading.** The server must never accept the `null` origin. The safest shape keeps the session token in the app's Keychain and lets the app's Swift side make the calls, since it is not bound by the browser's cross-site rules. Whether the page can lock data itself (`crypto.subtle` needs a "secure" page) is untested.

## 11. Apple's own iCloud database as a home, and Firebase

| What the source says | Source | How seen |
| --- | --- | --- |
| CloudKit JS lets a website reach the same private database as the app; the person signs in with their Apple Account in the browser. | [CloudKit JS](https://developer.apple.com/tutorials/data/documentation/cloudkitjs.json), [API token](https://developer.apple.com/tutorials/data/documentation/cloudkit/obtaining-an-api-token-for-an-icloud-container.json) | fetched |
| Encrypted fields use keys in the person's iCloud Keychain; if they reset it the data is "permanently lost". Apple says web services "handle the encryption and decryption for you". | [Encrypting user data](https://developer.apple.com/documentation/cloudkit/encrypting-user-data.md) | fetched |
| A July 2026 forum question says encrypted fields **cannot** be read from the web; no Apple reply. Contradicts the line above. | [Forum 839408](https://developer.apple.com/forums/thread/839408) | fetched |
| Reports of Apple's web sign-in for CloudKit failing or blank in Firefox. | [Forum 827464](https://developer.apple.com/forums/thread/827464), [SUMO 1410053](https://support.mozilla.org/ee/questions/1410053) | snippet |
| Firebase Auth (with Identity Platform) is free up to 3,000 daily users for the first tier. | [Firebase Auth limits](https://firebase.google.com/docs/auth/limits) | fetched |

## 12. A second way in: email code, email link, passkey, Google

| What the source says | Source | How seen |
| --- | --- | --- |
| Mail scanners at workplaces, universities and hospitals open links ahead of the person, so a one-time link is already used when they click. Opened 27 Dec 2025, confirmed by a second person 14 Jan 2026, no Supabase reply. | [Supabase discussion #41618](https://github.com/orgs/supabase/discussions/41618) | fetched |
| Never use up a one-time token on a plain page load; make it a button press. | [Microsoft community](https://techcommunity.microsoft.com/t5/office-365/o365-url-scan-safe-links-impact-to-one-time-url/m-p/977132), [Descope](https://docs.descope.com/conditions/email-scanner) | snippet |
| A passkey can be the first and only way in (Apple's own guide). In an app's web view it works only for the app's own linked domain (`webcredentials`). | [Supporting passkeys](https://developer.apple.com/tutorials/data/documentation/authenticationservices/supporting-passkeys.md), [Forum 723273](https://developer.apple.com/forums/thread/723273), [passkeys.dev iOS](https://passkeys.dev/docs/reference/ios/) | fetched |
| Firefox on macOS can make and use iCloud Keychain passkeys from version 122. | [passkeys.dev device support](https://passkeys.dev/device-support/) fetched (table hard to read); [Mozilla Connect](https://connect.mozilla.org/t5/ideas/support-webauthn-passkeys/idc-p/40818) | fetched / snippet |
| Google: "A developer must not direct a Google OAuth 2.0 authorization request to an embedded user-agent". iOS web views get `disallowed_useragent`. Page modified 5 Aug 2026. | [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies), [Google native apps](https://developers.google.com/identity/protocols/oauth2/native-app) | fetched |

## 13. What proper sign-in for testers needs beyond the button

| What the source says | Source | How seen |
| --- | --- | --- |
| GDPR Article 9: processing data "revealing ... religious or philosophical beliefs" is forbidden unless an exception applies, such as explicit consent "for one or more specified purposes". | [GDPR Art. 9](https://gdpr-info.eu/art-9-gdpr/) | fetched |
| The UK regulator: if you infer a special trait, "the inferred data is special category data regardless of how confident you are"; a visit to a place of worship alone is "unlikely" to count, but does once the service acts on it. | [ICO: special category data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/) | fetched |
| Give the same answer whether or not an account exists; count failures per account, not per IP; CAPTCHA is "defense-in-depth". A session may last a day, with a fresh check before sensitive steps. | [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) | fetched |
| Turnstile "does not access, store, or transmit user communications, form entries, or other page inputs". | [Turnstile](https://developers.cloudflare.com/turnstile/) | fetched |
| Apple's Advanced Data Protection: if access is lost, "Apple will not have the encryption keys to help you recover it"; a recovery contact or key is set up first. | [Advanced Data Protection](https://support.apple.com/en-us/102651) | fetched |

**My reading.** A record of which verses someone keeps getting wrong is very likely data about religious practice. This is not legal advice.

## 14. Locking records so we cannot read them

| What the source says | Source | How seen |
| --- | --- | --- |
| Ente: a master key made on the device, kept on the server only locked by a key from the password and by a recovery key. | [Ente architecture](https://ente.com/architecture/) | fetched |
| Bitwarden locks the key with one each passkey produces (the PRF extension), and falls back to the master password when a step does not support it. | [Bitwarden PRF](https://contributing.bitwarden.com/architecture/deep-dives/passkeys/implementations/relying-party/prf/) | fetched |
| Excalidraw keeps the key after `#` in the share link: "Anything that's added after the # doesn't get sent to the server." | [Excalidraw](https://plus.excalidraw.com/blog/end-to-end-encryption) | fetched |
| Safari 18 added PRF "for the encryption of user data". A Mozilla engineer says Firefox 139 supports it on macOS 15. | [WebKit: Safari 18](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/), [Bugzilla 1985777](https://bugzilla.mozilla.org/show_bug.cgi?id=1985777) | fetched |
| PRF reported failing in Safari's phone-by-QR-code flow; a WebKit bug from December 2025 still open. | [Forum 774112](https://developer.apple.com/forums/thread/774112), [WebKit 259934](https://bugs.webkit.org/show_bug.cgi?id=259934) | snippet |

## 15. How other Qur'an and hifz apps do accounts

| App | Ways in | Without an account? | What the account is for | Source | How seen |
| --- | --- | --- | --- | --- | --- |
| Quran.com / QuranReflect | Google, Facebook, Apple, email; one account across both since 12 Nov 2025 | not stated on the page read | notes, streaks, goals, collections, progress across browsers | [Quran.com update](https://quran.com/product-updates/centralized-accounts-across-quran-foundation) | fetched |
| Quran Foundation (for other apps) | its own sign-in, offered to other apps with the code-plus-proof flow (PKCE); the person's `sub` is "the user's stable Quran Foundation identifier" | — | user data for third-party apps | [Quran Foundation OAuth](https://api-docs.quran.foundation/docs/tutorials/oidc/getting-started-with-oauth2/) | fetched |
| Quran.com iOS app | — | listing mentions no account | a user says it syncs through iCloud, and desktop sign-in did not reach the iPhone | [App Store](https://apps.apple.com/us/app/quran-by-quran-com-%D9%82%D8%B1%D8%A2%D9%86/id1118663303) fetched; [feedback](https://feedback.quran.com/mobile-app/p/ios-syncing-issues) snippet | fetched / snippet |
| Tarteel | email and password, Apple, Google | not stated | mistake history (paid); recordings "may be anonymously used as training data" | [Create an account](https://support.tarteel.ai/en/articles/12168720-how-to-create-a-tarteel-account), [Privacy summary](https://support.tarteel.ai/en/articles/12414462-understanding-our-privacy-policy), [App Store](https://apps.apple.com/us/app/tarteel-quran-memorization/id1391009396) | fetched |
| Tarteel deletion | in-app: menu, Account, Delete Account; no way to delete only the history | — | — | [Delete account](https://support.tarteel.ai/en/articles/12042228-how-to-delete-your-account) | snippet |
| Mofassal | not stated | yes, guest first, sign up later | sync; teacher groups with roles (teacher, student, assistant, supervisor, parent); label says no data collected | [App Store](https://apps.apple.com/us/app/mofassal-quran-hifz-review/id1584188020) | fetched |
| Muslim Pro | email, Google, Apple | yes, but "your progress and settings will not be saved" | bookmarks, progress across devices | [Help](https://support.muslimpro.com/hc/en-us/articles/4648775233549-Setting-Up-A-Muslim-Pro-Profile) | fetched |
| Hamil Al Quran | not stated | "works fully without an account" | optional sync; teachers link students by a private code | [App Store](https://apps.apple.com/app/id6749209998) | fetched |
| Hifz Tracker | not stated | not stated | student and teacher mode | [App Store](https://apps.apple.com/us/app/-/id6748594784) | fetched |
| Sabaq, QuranRecord, Mashhuda | — | — | school and teacher tracking | [Sabaq](https://apps.apple.com/app/id1568365115), [QuranRecord](https://apps.apple.com/ca/app/quranrecord/id6751930130), [Mashhuda](https://apps.apple.com/app/id6740761243) | snippet |

**Did not look:** Quran Companion, Hifz Planner, Quranic, Ayah, Itqan, Qaloon, Tarteel's teacher product, QuranReflect's own sign-in page. Tarteel's full privacy policy and Mofassal's would not load.

## 16. What I found in this repository

These are facts from the checked-in files, read in this branch.

- **The app's page is not on an https address.** The iPad and Mac apps serve the page from their own address, `hifth-app://app/`, out of the bundled build (`native/Hifth/Web/LocalScheme.swift`).
- **The bridge goes one way for messages today.** The page can tell the app "ready", "go to this page" and "share this". The app talks back by running script in the page. There is no sign-in message (`native/Hifth/Web/Bridge.swift`).
- **Entitlements.** The Mac app has an entitlements file with nothing in it. There is no entitlements file for the iPad and iPhone build (`native/Hifth/Resources/`).
- **Signing.** The App ID was registered on 2026-11-09 with Sign in with Apple ticked. The iPad build is signed with the paid team; the Mac build is not yet (`docs/design/testflight-plan.md`).
- **Supabase today.** One project holds the held copy of outside Qur'an data. Its checked-in settings keep sign-ups off and the Data API off, and an offline test insists on both. Apple sign-in is present in the settings but switched off (`supabase/config.toml`, the store test under the `leverage-qul` skill).
- **Something to check, not a confirmed fault.** The mailing list lives on that same project, and its code calls the Data API's address (`apps/landing/lib/notify.mjs`). The checked-in settings say that API is off. I did not look at the live project. One of the two is out of date, or the list goes through a door the settings do not show.
- **Cloudflare today.** hifth.app runs on its own Cloudflare account, with three small server functions for the mailing list and its secrets (`apps/landing/functions/api/`, `apps/landing/wrangler.toml`). The plan to share marks with a teacher already chose Cloudflare's free database for shared copies (sharing plan ⑥).
- **The privacy check.** The revision record and the jumps record may leave the device only by named ways out, and today there is one (`scripts/gate-revision-privacy.mjs`). Any sync to a server adds a named way out.

## 17. What I did not look at

- Apple's Universal Links setup, so how an email link would reopen the app is not sourced.
- Whether Apple's authorize page accepts the code-plus-proof flow (PKCE).
- Auth.js running on Workers, Clerk, PocketBase, Standard Notes.
- CloudKit's private-database limits, and whether they count against the reader's iCloud storage.
- A browser-support table for passkey-made keys (PRF) from MDN or caniuse; Chrome's first version.
- GDPR Articles 17 and 20 (erasure and taking your data with you).
- The UpGuard report itself, only a summary of a summary.
- The other researcher's files, on purpose.
