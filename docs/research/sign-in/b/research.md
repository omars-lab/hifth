# How close is Hifth to Sign in with Apple, and what would proper sign-in for testers need? Raw findings, researcher B

These are the raw notes behind [the design note](design.md). They were written on 2026-11-15 by researcher B, working apart from researcher A; A's files were not read.
No app code and no Apple, Supabase or Cloudflare setting was changed.

Each source says how it was seen:

- **fetched**: the page was opened and read. Most pages came back through a fetch tool that summarises the page, so a short quoted phrase is close paraphrase unless a section says it was read word for word. Re-check any quote against the page before printing it.
- **snippet**: only a search-result summary was seen. Treat it as a lead, not a fact. Every claim that rests only on a snippet says so where it is made.

Apple's documentation pages come back empty to a plain reader, so they were read through Apple's data address, the one ending in `.json` under `developer.apple.com/tutorials/data/documentation/`.

The outside research was split into five topics. Each topic's notes follow below, after what the repository already says. Each topic has its own source list at the top, with its own short labels (A1, S1 and so on). The labels are local to that topic: S1 in one topic is not S1 in another.

## What does the repository already say?

All read directly in this worktree on 2026-11-15.

| what | where | what matters here |
| --- | --- | --- |
| The Apple membership | `docs/design/testflight-plan.md` | Paid individual membership, active since 2026-11-08. |
| The app's Apple id | `docs/design/iphone-app.md` | Registered on 2026-11-09 with iCloud, Associated Domains, Siri, Push and **Sign in with Apple** turned on. Bundle id `com.bytesofpurpose.hifth`. |
| Is the iPad app signed with the paid team? | `docs/design/testflight-plan.md`, item ③ | Yes, since 2026-11-10 (364 days left on that signing). The Mac app is not yet. |
| Can testers be sent the app? | `docs/design/testflight-plan.md` | The upload is held by the licence reading (decision `native-testflight-licence`). Recommended testers are external, invited by email, which means Apple reviews the beta first. TestFlight has its own feedback button. |
| Is Sign in with Apple in any build? | `native/project.yml`, `native/Hifth/Resources/Hifth-macOS.entitlements` | **No.** The iPad and iPhone target has no entitlements file at all. The Mac target's entitlements file is an empty list, and the Mac target is signed ad hoc (`CODE_SIGN_IDENTITY: "-"`). `DEVELOPMENT_TEAM` is empty; `Makefile.native` reads the team from the signing certificate. |
| Can the page ask the shell for something and get an answer? | `native/Hifth/Web/Bridge.swift`, `apps/web/src/native-bridge.ts` | **Not yet.** The bridge carries three messages one way, page to shell (`ready`, `route`, `share`), through a handler named `hifth`. The shell can call into the page through `exposeToShell`. There is no "ask and wait for the reply" path. Apple's `WKScriptMessageHandlerWithReply` is the ready-made way to add one. |
| What address does the page in the app have? | `native/Hifth/Web/LocalScheme.swift` | `hifth-app://app/…`, served from the bundled build. That is a custom scheme, not https, so anything that needs an https page on a real domain (Apple's web sign-in return address, passkeys) cannot run on it. |
| Does hifth.app run any server code today? | `apps/landing/functions/api/`, `apps/landing/wrangler.toml` | **Yes.** Cloudflare Pages project `hifth-app` already runs three functions for the notify list (`notify`, `confirm`, `unsubscribe`). `notify` checks a Cloudflare Turnstile token (the "are you a person" check) before doing anything. Its secrets are the store address, its public key, a list key and the Turnstile secret. |
| Does hifth.app publish an Apple link file? | `apps/landing/_headers`, `apps/landing/` | No `apple-app-site-association` file and no `.well-known` folder. Passkeys, and links that open the app, would need one. |
| What does the Supabase settings file say about Apple? | `supabase/config.toml` | An Apple sign-in block exists but is off: `enabled = false`, empty client id, secret read from an environment value, nonce check on. Sign-ups are off in three places. The site address is a local placeholder. |
| What is the Supabase store used for today? | `docs/design/supabase-move.md`, `docs/design/hifth-app-mailing-list.md` | One store, named after hifth.app, holds the outside library for the build tools **and**, since the owner's decision of 2026-11-12, the notify list. Sign-ups are off and the web door is off; `make qul-store-check` fails if anyone ever signs up, and an offline test fails if the settings file stops keeping sign-ups off. A daily Cloudflare job keeps it awake against Supabase's one-week pause. The old store is still running until it is retired (item ③ there). Whether the account that holds the new store has room for another free project was not checked. |
| Where should shared things live? | `docs/design/sharing-between-readers.md`, item ⑥ | Owner, 2026-11-09: Cloudflare's free database, not a new Supabase project. The share page is `hifth.app/share` (⑧) and the app is `hifth.app/read` (⑭). Item ⑨ (the teacher link) is blocked and waits on ③ (which way sharing goes). |
| What was already known about Sign in with Apple | `docs/design/sharing-between-readers.md`, section "What we know so far about Sign in with Apple (2026-11-11)" | No Sign in button with nothing behind it. Sign-in lives on hifth.app. In the apps, Apple's own sheet handed to the page through the bridge, never a web sign-in page inside the app. On the web, Apple's sign-in needs a server part. Deletion inside the app is required, and Apple sign-in is required if Google is offered. It also notes "if Supabase is chosen, it is a new project of its own". |
| Where does a reader's own record live? | `docs/decisions/storage-model.md` | Today: on the device, plus a file the reader saves. "On the day there is sign-in": the reader's own cloud copy of that file, written all at once. A record shared between people "starts its own" decision. The timing of sign-in ("not this year") is owned by the licensing question. |
| Own-device sync | `docs/design/icloud-sync.md` | Records follow the reader across their own Apple devices through their own iCloud, with no account of ours. Waits on the paid signing. |
| The privacy rule | `CLAUDE.md`, `scripts/gate-revision-privacy.mjs` | The reader's marks, revision record and settings are seen by no one else until they press a button that says what goes and to whom; they can see who has it and take it back. The privacy check keeps a closed list of the code allowed to read each record, so any way off the device has to be added to that list on purpose. |
| Open work | `docs/backlog.md` | The `sharing-sign-in` row is blocked on `sharing-which-way`. |


## Topic 1: How does Sign in with Apple work inside the Apple apps, and what does App Review ask for?


Date of reading for every source: 2026-11-15. "FETCHED" = I read the page's content (Apple docs read through the `tutorials/data/...json` address). "SNIPPET" = seen only in search-result summaries; treat as unconfirmed. Anything marked "from memory, not fetched" is flagged as such.

Source list (all read 2026-11-15):

| # | Address | Status |
|---|---|---|
| S1 | https://developer.apple.com/app-store/review/guidelines/ | FETCHED (first 100,000 of 114,384 chars; 4.8 and 5.1.1(v) were in the read part; no "last updated" date seen) |
| S2 | https://developer.apple.com/support/offering-account-deletion-in-your-app/ | FETCHED |
| S3 | https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/revoke-tokens.json | FETCHED (the older `sign_in_with_apple_rest_api/revoke_tokens.json` path is 404) |
| S4 | https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json | FETCHED |
| S5 | https://developer.apple.com/tutorials/data/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts.json | FETCHED |
| S6 | https://developer.apple.com/tutorials/data/documentation/authenticationservices/implementing-user-authentication-with-sign-in-with-apple.json | FETCHED |
| S7 | https://developer.apple.com/tutorials/data/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.json | FETCHED (overview article) |
| S8 | https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json | FETCHED |
| S9 | https://developer.apple.com/tutorials/data/documentation/signinwithapple/receiving-a-users-identity-token.json | FETCHED |
| S10 | https://developer.apple.com/tutorials/data/documentation/accountorganizationaldatasharing/creating-a-client-secret.json | FETCHED |
| S11 | https://developer.apple.com/tutorials/data/documentation/signinwithapple/communicating-using-the-private-email-relay-service.json | FETCHED |
| S12 | https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service | FETCHED |
| S13 | https://developer.apple.com/tutorials/data/documentation/bundleresources/entitlements/com.apple.developer.applesignin.json | FETCHED |
| S14 | https://developer.apple.com/help/account/reference/supported-capabilities-macos | FETCHED, but the table's tick marks did not come through in text, so the per-column answer could not be read |
| S15 | https://developer.apple.com/tutorials/data/documentation/authenticationservices/asauthorizationopenidrequest/nonce.json | FETCHED |
| S16 | https://developer.apple.com/tutorials/data/documentation/authenticationservices/asauthorizationappleidcredential.json | FETCHED |
| S17 | https://developer.apple.com/tutorials/data/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple.json | FETCHED (TN3194, first published 2025-10-03) |
| S18 | https://developer.apple.com/tutorials/data/documentation/webkit/wkscriptmessagehandlerwithreply.json | FETCHED |
| S19 | https://developer.apple.com/tutorials/data/documentation/webkit/wkscriptmessagehandlerwithreply/usercontentcontroller(_:didreceive:replyhandler:).json | FETCHED |
| S20 | https://developer.apple.com/tutorials/data/documentation/authenticationservices/aswebauthenticationsession.json | FETCHED |
| S21 | https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json | FETCHED |
| S22 | https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi.json and .../signinwithapple.json and .../signinwithapplejs.json | FETCHED (indexes only, used to find page paths) |
| S23 | https://appleid.apple.com/.well-known/openid-configuration | FETCHED (summarised by the fetch tool, not quoted raw) |
| S24 | https://developer.apple.com/news/?id=pzpmt15y (this address served the whole Apple Developer News list page, not one item) | FETCHED (both halves) |
| S24b | https://developer.apple.com/news/?id=j9zukcr6 (Korea server-notification item, the address the deletion page links) | NOT fetched; its text was read inside S24's list |
| S33 | https://developer.apple.com/help/account/capabilities/enabling-server-to-server-notifications | FETCHED |
| S34 | https://developer.apple.com/tutorials/data/documentation/authenticationservices/aspresentationanchor.json | FETCHED |
| S35 | https://developer.apple.com/tutorials/data/documentation/webkit/wkusercontentcontroller/addscriptmessagehandler(_:contentworld:name:).json | FETCHED (no word on Promises) |
| S25 | https://developer.apple.com/forums/thread/740376 (Sign in with Apple JS inside WKWebView broke on iOS 17.1) | FETCHED |
| S26 | https://developer.apple.com/forums/thread/685118 (macOS WKWebView shows native sheet) | FETCHED |
| S27 | https://developer.apple.com/forums/thread/793244 (DTS: not supported for Developer ID) | FETCHED |
| S28 | https://supabase.com/docs/guides/auth/social-login/auth-apple | FETCHED |
| S29 | https://supabase.com/docs/reference/javascript/auth-signinwithidtoken | FETCHED, but only a stub came back (no parameter descriptions) |
| S30 | https://github.com/supabase/auth/blob/master/internal/api/token_oidc.go (Supabase Auth server source) | FETCHED |
| S31 | https://firebase.google.com/docs/auth/ios/apple | FETCHED |
| S32 | SNIPPET only: [forum 129263](https://developer.apple.com/forums/thread/129263), [707074](https://developer.apple.com/forums/thread/707074), [768236](https://developer.apple.com/forums/thread/768236), [730386](https://developer.apple.com/forums/thread/730386) (Developer ID); [660156](https://developer.apple.com/forums/thread/660156), [839521](https://developer.apple.com/forums/thread/839521) (TestFlight); [836768](https://developer.apple.com/forums/thread/836768), [837986](https://developer.apple.com/forums/thread/837986) (error 1000); [747744](https://developer.apple.com/forums/thread/747744) (token lifetime); [765145](https://developer.apple.com/forums/thread/765145), [762647](https://developer.apple.com/forums/thread/762647) (4.8 reading); [sarunw.com tutorial](https://sarunw.com/posts/sign-in-with-apple-3/); [Auth0 community thread](https://community.auth0.com/t/sign-in-with-apple-universal-login-in-swift-results-in-a-blank-page/32517/10); [mjtsai.com 2020](https://mjtsai.com/blog/2020/02/19/which-os-services-are-app-storeonly) | SNIPPET only |

---

### 1. Native route: getting the identity token and authorization code and handing them to the web page

#### Takeaway
Use AuthenticationServices in Swift (ASAuthorizationAppleIDProvider and ASAuthorizationController), then hand the result to the page as the reply to a page-to-shell message. `WKScriptMessageHandlerWithReply` (iOS 14+/macOS 11+) is made for this: the reply goes straight back to the page's call, so no separate shell-to-page call is needed. Both the handler and its reply block run on the main actor.

#### Cited Findings
- Apple's sample starts the flow like this: `ASAuthorizationAppleIDProvider().createRequest()`, `request.requestedScopes = [.fullName, .email]`, then `ASAuthorizationController(authorizationRequests: [request])`, set `delegate` and `presentationContextProvider`, and call `performRequests()`. — [S6](https://developer.apple.com/tutorials/data/documentation/authenticationservices/implementing-user-authentication-with-sign-in-with-apple.json)
- "The authorization controller calls the `ASAuthorizationControllerPresentationContextProviding.presentationAnchor(for:)` function to get the window from the app where it presents the Sign in with Apple content to the user in a modal sheet." Sample returns `self.view.window!`. — [S6](https://developer.apple.com/tutorials/data/documentation/authenticationservices/implementing-user-authentication-with-sign-in-with-apple.json)
- "If the user is not signed in at the system-level, the app presents an alert directing the user to sign in with their Apple ID in Settings." Also: "The user must enable Two-Factor Authentication to use Sign in with Apple." — [S6](https://developer.apple.com/tutorials/data/documentation/authenticationservices/implementing-user-authentication-with-sign-in-with-apple.json)
- The credential (`ASAuthorizationAppleIDCredential`) has nine properties: `user` ("An identifier for the authenticated user"), `identityToken` ("A JSON Web Token (JWT) that securely communicates information about the user to the app"), `authorizationCode` ("A token that the app uses to interact with the server"), `state`, `fullName`, `email`, `realUserStatus`, `authorizedScopes`, and a newer `userAgeRange` (type `ASUserAgeRange`, no description given). — [S16](https://developer.apple.com/tutorials/data/documentation/authenticationservices/asauthorizationappleidcredential.json)
- What comes back: "an identity JSON Web Token (JWT), single-use authorization grant code, the state contained in the authorization request, and user identifier." "Use the user identifier instead of an email address to identify the user. The user identifier remains unique and static for your developer team." — [S9](https://developer.apple.com/tutorials/data/documentation/signinwithapple/receiving-a-users-identity-token.json)
- `WKScriptMessageHandlerWithReply`: "Adopt the `WKScriptMessageHandlerWithReply` protocol when your app needs to receive JavaScript messages from a web view and provide an appropriate response." The page calls it with `window.webkit.messageHandlers.<name>.postMessage(<body>)`. It is declared `@MainActor protocol`. It is installed with `WKUserContentController.addScriptMessageHandler(_:contentWorld:name:)`. — [S18](https://developer.apple.com/tutorials/data/documentation/webkit/wkscriptmessagehandlerwithreply.json)
- Reply block: `reply` may be "NSNumber, NSString, NSDate, NSArray, NSDictionary, and NSNull. Specify nil if an error occurred"; `errorMessage` is "nil on success, or a string that describes the error that occurred." The block is annotated `@escaping @MainActor @Sendable`. Availability: iOS 14.0+, iPadOS 14.0+, Mac Catalyst 14.0+, macOS 11.0+. There is also an `async` Swift variant returning `(Any?, String?)`. — [S19](https://developer.apple.com/tutorials/data/documentation/webkit/wkscriptmessagehandlerwithreply/usercontentcontroller(_:didreceive:replyhandler:).json)
- On macOS, loading Apple's sign-in address in a WKWebView brought up the native sheet instead of a web page, and the poster could not detect the user pressing Cancel through the navigation delegate. Nobody from Apple answered. The only suggestion, untested, was to watch `WKUIDelegate`'s `webViewDidClose:`. — [S26](https://developer.apple.com/forums/thread/685118) (forum, July 2021)

#### Inferences
- Shape of the bridge: the page posts `{type: "appleSignIn", nonceHash}` to a reply-capable handler. Swift runs the controller, keeps the `replyHandler` until the delegate fires, then replies with a dictionary of strings: `identityToken` (the `Data` decoded as UTF-8), `authorizationCode` (decoded as UTF-8), `user`, `givenName`/`familyName` (only on first sign-in), and `email`. On cancel or error it replies `nil` with an error string. The replyHandler must be called exactly once on every path (success, error, cancel), or the page's call never finishes. The "Promise" behaviour on the JS side is not stated in the fetched pages (see Gaps).
- `identityToken` and `authorizationCode` are `Data?`, not strings, so they must be converted before going into the reply, because `Data` is not one of the allowed reply types (S19 lists the types allowed).
- Presentation anchor on Mac: `typealias ASPresentationAnchor = NSWindow` on macOS and `= UIWindow` on iOS/iPadOS/Mac Catalyst — [S34](https://developer.apple.com/tutorials/data/documentation/authenticationservices/aspresentationanchor.json) (fetched). So on a Mac the shell returns the WKWebView's `window` (an NSWindow). It should not force-unwrap it, since a window may not exist yet at launch (inference).
- Using `evaluateJavaScript` (or `callAsyncJavaScript`) to push the result into a function the page exposes also works, but the reply handler is simpler. It also keeps the token out of a JavaScript source string, so there is nothing to escape or inject.
- The custom-scheme origin (`hifth-app://`) does not matter for the native route. Apple never sees the page's origin, because the request comes from the app's bundle ID.

#### Gaps
- Not confirmed from a fetched page: that `postMessage` on a reply-capable handler returns a Promise that resolves with `reply` and rejects with `errorMessage`. None of the three WebKit pages fetched (S18, S19, S35) says it. It is widely known; confirm with a quick test in the shell.

---

### 2. The nonce

#### Takeaway
Make a fresh random value for each sign-in. Send its SHA-256 hash (as lowercase hex) to Apple in the request's `nonce`. Apple copies that hash into the identity token's `nonce` claim. Give the raw value to the server, which hashes it and compares the result with the claim. This proves the token was issued for this one sign-in attempt and blocks replay. Supabase's server code does exactly this comparison.

#### Cited Findings
- Apple's nonce property: "A string value to pass to the identity provider." "You can verify this value with the identity token provided as part of a successful ASAuthorization response." "The nonce size may depend on the actual technology used, and an error might be returned by the request execution." — [S15](https://developer.apple.com/tutorials/data/documentation/authenticationservices/asauthorizationopenidrequest/nonce.json)
- Apple: the server must "Verify the `nonce` for the authentication." — [S8](https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json); "associate a client session with an ID token using the `nonce` value." — [S7](https://developer.apple.com/tutorials/data/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.json)
- Firebase: "For every sign-in request, generate a random string"; "This step is important to prevent replay attacks"; "You will send the SHA256 hash of the nonce with your sign-in request, which Apple will pass unchanged in the response"; "Firebase validates the response by hashing the original nonce and comparing it to the value passed by Apple." — [S31](https://firebase.google.com/docs/auth/ios/apple)
- Supabase Auth server (`IdTokenGrant`): `hash := fmt.Sprintf("%x", sha256.Sum256([]byte(params.Nonce)))` then `if hash != idToken.Nonce {` → reject. If only one side has a nonce: "Passed nonce and nonce in id_token should either both exist or not." — [S30](https://github.com/supabase/auth/blob/master/internal/api/token_oidc.go)
- The Supabase Apple guide shows the hash-to-Apple, raw-to-Supabase pattern only in its Flutter example. Its Swift and Expo examples show no nonce at all. — [S28](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- The OpenID discovery document lists `nonce` among the supported claims. — [S23](https://appleid.apple.com/.well-known/openid-configuration)

#### Inferences
- The hash must be lowercase hex of SHA-256 over the UTF-8 bytes of the raw value, because that is what Supabase's `%x` produces. A base64 hash would never match.
- Because the page (not Swift) calls `supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce: raw })`, the raw value has to be on the page side. Either the page makes the raw value and sends only the hash to Swift, or Swift makes both and returns the raw value with the token. The first is cleaner, because then the shell never holds a secret it has to send back.
- Supabase's rule that both must exist or neither means sending no nonce to Apple and none to Supabase would also pass. That gives up replay protection, so don't.

#### Gaps
- The full Supabase `signInWithIdToken` parameter docs did not come back (S29 was a stub). The `nonce` parameter name comes from S28's examples and S30's `params.Nonce`.

---

### 3. How a server checks the identity token

#### Takeaway
Check the signature against Apple's public keys (`https://appleid.apple.com/auth/keys`, RS256). Then check that `iss` = `https://appleid.apple.com`, that `aud` = the app's bundle ID for native sign-in (the Services ID for web sign-in), that the token has not expired, and that the nonce matches. Key the account on `sub`. The token is short-lived: about 10 minutes, but only secondary sources say so.

#### Cited Findings
- Apple's verification list: "Verify the JWS E256 signature using the server's public key"; "Verify the `nonce` for the authentication"; "Verify that the `iss` field contains `https://appleid.apple.com`"; "Verify that the `aud` field is the developer's `client_id`"; "Verify that the time is earlier than the `exp` value of the token." — [S8](https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json)
  - Note a conflict: S8 says "E256", while the discovery document says ID tokens are signed RS256 — [S23](https://appleid.apple.com/.well-known/openid-configuration). A verifier should expect RS256 (per the discovery document), reject any other `alg` (never just accept whatever the header says), and pick the key from `https://appleid.apple.com/auth/keys` by the header's `kid`.
- Discovery document: issuer `https://appleid.apple.com`; authorization, token, revocation and key-set addresses under `appleid.apple.com/auth/`; response types `code`; response modes query, fragment, form_post; subject type `pairwise`; scopes openid, email, name; token-endpoint client auth `client_secret_post`. Claims listed: aud, email, email_verified, exp, iat, is_private_email, iss, nonce, real_user_status, sub, transfer_sub. — [S23](https://appleid.apple.com/.well-known/openid-configuration)
- `client_id` is "The identifier (App ID or Services ID) for your app." — [S4](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json)
- Supabase: list each bundle ID in the Apple provider's **Client IDs**. "If you're building a native app only, you do not need to configure the OAuth settings." "Native-only implementations don't require secret key rotation." If web and native are both used, put the Services ID first; the native flow "accepts any client ID in the list as a valid token audience, regardless of order." — [S28](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- Supabase's server takes its allowed audiences from the configured Apple client ID(s) and, if set, the iOS bundle ID, and enforces `slices.Contains(idToken.Audience, clientID)`. — [S30](https://github.com/supabase/auth/blob/master/internal/api/token_oidc.go)
- Email: "If you request the user's verified email address, Sign in with Apple prompts the user to share it with your app. The user may choose to share their real email address or an anonymous one that uses the private email relay service." With a managed Apple Account, `email` is a real address, and in Apple School Manager it may be empty. — [S9](https://developer.apple.com/tutorials/data/documentation/signinwithapple/receiving-a-users-identity-token.json). "Apple provides the user's email address in the identity token on all subsequent API responses." — [S7](https://developer.apple.com/tutorials/data/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.json)
  - Do not rely on the email being present (for example the School Manager case above).
- `real_user_status`: 2 = likely real, 1 = unknown ("Don't block service"), 0 = unsupported (before iOS 14/macOS 11). It is returned only on first use: "Subsequent attempts don't return the user status." — [S7](https://developer.apple.com/tutorials/data/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.json)
- Lifetime: Apple's pages say only "earlier than `exp`" (S8). The authorization code is "single-use only and valid for five minutes" — [S4](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json). The roughly 10-minute identity-token lifetime (exp − iat = 600 s in a sample) comes only from SNIPPETS ([sarunw.com tutorial](https://sarunw.com/posts/sign-in-with-apple-3/); [forum 747744](https://developer.apple.com/forums/thread/747744)).
- Refresh-token checks: "You may verify the refresh token up to once a day … Apple's servers may throttle your call if you attempt to verify a user's Apple Account more than once a day." "User interaction is required any time a new identity token is requested … calling for a new identity token on every launch, or more frequently than once a day, can result in your request failing due to throttling." — [S8](https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json)
- Apple's sample token in the notifications doc shows the shape of `sub` (`820417.faa3…0219`) and `is_private_email` as the string `"true"`. — [S5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts.json)

#### Inferences
- With Supabase, the app's bundle ID must be in the Apple provider's Client IDs, because native tokens carry the bundle ID as `aud`. If iPad/iPhone and Mac use the same bundle ID, one entry covers both.
- `is_private_email` and `email_verified` may arrive as strings ("true") rather than JSON booleans (see S5's sample), so server code should accept both.
- `sub` is per developer team (S9: "unique and static for your developer team"; S23: subject type `pairwise`). Moving the app to another team changes it (`transfer_sub` exists for that).

#### Gaps
- No Apple page fetched gives the full claim descriptions. The JS `id_token` reference page that S8 links to was not fetched. `email_verified` and `auth_time` semantics are not confirmed from Apple text.
- The exact identity-token lifetime is not confirmed from an Apple source.

---

### 4. Web sign-in inside the WKWebView instead (Sign in with Apple JS, or a redirect to appleid.apple.com)

#### Takeaway
It is fragile, and the custom-scheme origin rules it out as a direct path. Apple's web flow returns to an https `redirect_uri` with a real domain, and Sign in with Apple JS inside a WKWebView regressed on iOS 17.1 (it fell back to a plain HTML login form with no Face ID sheet). Developers who hit this either rewrote it in Swift or moved the web flow out to Safari. ASWebAuthenticationSession is the supported way to run a web sign-in from an app, but it is a detour here, because the native API exists on every platform the app targets.

#### Cited Findings
- `redirect_uri` "must use the HTTPS protocol, include a domain name, and can't contain an IP address or `localhost`, and must not contain a fragment identifer (#)." — [S4](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json); a similar rule without the https wording is in [S21](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json).
- Apple's guide for apps that can't use the JS library says "open a browser tab with the authorization URL." Platforms with custom URL schemes "must handle the data resulting from the authorization flow by storing it on their app server in the logic of their `redirect_uri` endpoint. You then redirect the custom URL scheme to give control back to the app." If any scope is requested, `response_mode` must be `form_post`, and the result is an HTTP POST to the redirect URI. — [S21](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json)
- Sign in with Apple JS inside a WKWebView: "Worked in version '17.0.3', doesn't work in version '17.1'". Instead of the native sheet, users get an HTML Apple ID form. With `usePopup: true` the popup was empty. One user claims it was "Fixed in iOS 17.2", another still saw it on 17.2.1. There is no Apple reply. Workarounds: "completely abandon js and rewrite it to swift", or open the Apple login page in Safari with app links. — [S25](https://developer.apple.com/forums/thread/740376) (forum, Oct 2023–Jan 2024)
- SNIPPET: the web flow breaks at the final 302 redirect to the app's custom scheme inside WKWebView, and the only working fix was native Sign in with Apple. — [Auth0 community thread](https://community.auth0.com/t/sign-in-with-apple-universal-login-in-swift-results-in-a-blank-page/32517/10) (not fetched)
- ASWebAuthenticationSession: "Use an ASWebAuthenticationSession instance to authenticate a user through a web service … In iOS, the browser is a secure, embedded web view. In macOS, the system opens the user's default browser if it supports web authentication sessions, or Safari otherwise." "ASWebAuthenticationSession ensures that only the calling app's session receives the authentication callback, even when more than one app registers the same callback URL scheme." Available on iOS 12+ and macOS 10.15+. — [S20](https://developer.apple.com/tutorials/data/documentation/authenticationservices/aswebauthenticationsession.json)
- Apple's account-deletion FAQ: "linking out to the default web browser to sign in or register an account provides a poor user experience and isn't appropriate, per App Review Guideline 4." — [S2](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

#### Inferences
- A page served from `hifth-app://app/` cannot be registered as a Services ID website domain or return URL, because those need https and a domain. So Sign in with Apple JS can't work from that origin as-is. A web flow would need an https bounce page on the real site, then a hand-off back into the shell, which is the fragile last hop forum users report.
- Supabase's own web OAuth for Apple (redirect to Supabase, then back to the site) has the same problem: its callback must land on an https address, not the custom scheme, unless it runs inside ASWebAuthenticationSession with a custom callback scheme.
- Native sign-in through the bridge avoids the origin question entirely, and it gives the Face ID/Touch ID sheet reviewers expect. It is the right choice on iOS, iPadOS and macOS. The web flow only matters for the public https site in an ordinary browser.
- Using ASWebAuthenticationSession for Apple's own sign-in while the native API exists is legal, but it is a worse experience (a browser sheet plus a domain prompt) and needs a Services ID, a client secret and a redirect.

#### Gaps
- No Apple statement found that explicitly forbids Sign in with Apple JS inside a WKWebView. The evidence is regression reports, not a rule.
- The S25 thread does not settle whether iOS 18/26 restored the native sheet for JS in WKWebView.

---

### 5. Signing: provisioning profile and entitlement on each platform; ad-hoc Mac builds

#### Takeaway
Sign in with Apple needs the `com.apple.developer.applesignin` entitlement (value `["Default"]`) on iOS 13+ and macOS 10.15+. Xcode adds it when the capability is turned on for a target signed with the team and a provisioning profile. An ad-hoc signed Mac app has no profile, so (by inference: no fetched page says it outright) it can't carry this entitlement and the native API should not work. Apple support staff do say outright that Developer ID (outside the Mac App Store) builds can't use it. On a Mac, native Sign in with Apple therefore needs a development-signed build (team plus development profile) for testing, and Mac App Store or TestFlight signing for distribution.

#### Cited Findings
- Entitlement: "An entitlement that lets your app use Sign in with Apple." Key `com.apple.developer.applesignin`, an array of strings, value `Default` ("The value used for normal operation"). Platforms: iOS 13.0, iPadOS 13.0, macOS 10.15, tvOS 13.0, visionOS 1.0, watchOS 6.0 (Mac Catalyst not listed). "To add this entitlement to your app with the correct associated value, enable the Sign in with Apple capability in Xcode." — [S13](https://developer.apple.com/tutorials/data/documentation/bundleresources/entitlements/com.apple.developer.applesignin.json)
- Xcode setup: enable the capability in Signing & Capabilities. Xcode must have your Apple ID and the target must be assigned to a team "so it can enable the capability with your provisioning profile." — [S6](https://developer.apple.com/tutorials/data/documentation/authenticationservices/implementing-user-authentication-with-sign-in-with-apple.json)
- DTS (Quinn "The Eskimo!", Jul 2025): "Sign in with Apple is not supported for Developer ID apps. See the Developer ID column in the table in Developer Account Help > Reference > Supported capabilities (macOS)." — [S27](https://developer.apple.com/forums/thread/793244)
- SNIPPETS repeating the Developer ID answer (2020, 2021) and the Xcode error "Profile doesn't support Sign in with Apple" with a Developer ID profile: [forum 129263](https://developer.apple.com/forums/thread/129263), [707074](https://developer.apple.com/forums/thread/707074), [768236](https://developer.apple.com/forums/thread/768236), [730386](https://developer.apple.com/forums/thread/730386). One DTS reply suggests using the web flow (server plus private key) for Developer ID Mac apps ([768236](https://developer.apple.com/forums/thread/768236), snippet). A [2020 mjtsai.com post](https://mjtsai.com/blog/2020/02/19/which-os-services-are-app-storeonly) said the capabilities page then showed Developer ID as supported. That conflicts with DTS; DTS's 2025 answer is newer.
- The macOS capabilities reference lists "Sign in with Apple". Its columns are ADP, Developer ID and Apple Developer, but the fetched text lost the tick marks. — [S14](https://developer.apple.com/help/account/reference/supported-capabilities-macos)
- SNIPPETS: AuthorizationError 1000 is the common generic failure when the entitlement or profile is missing or wrong. A Capacitor developer saw 1000/1001 on macOS with no linked entitlements file. Several new App IDs in 2026 threads failed server-side even with a correct entitlement ([836768](https://developer.apple.com/forums/thread/836768), [839521](https://developer.apple.com/forums/thread/839521), [837986](https://developer.apple.com/forums/thread/837986)).

#### Inferences
- iOS/iPadOS: add an entitlements file with `com.apple.developer.applesignin = [Default]` and sign with the team (automatic signing). The development profile is regenerated to include the capability, since the App ID already has it turned on in the portal.
- macOS: the current ad-hoc signing must change to team signing (Apple Development certificate plus a Mac development profile for the same App ID) before native Sign in with Apple can be tested on the Mac. To distribute, the Mac build must go through the Mac App Store or TestFlight, not Developer ID (per S27). If the Mac must stay outside the store, the fallback is the web flow in ASWebAuthenticationSession, which needs a Services ID and a client secret.
- The entitlement is restricted (it needs a profile), so an ad-hoc build that claims it would be killed at launch or ignored. It will not quietly work. This is from general code-signing knowledge, not a fetched page. Confirm with a real build.

#### Gaps
- No fetched Apple page explicitly says "ad-hoc signed apps can't use Sign in with Apple". It follows from the profile requirement (S6) and the restricted entitlement. The exact failure mode (refusal to launch vs. error 1000) was not confirmed.
- S14's per-column ticks could not be read in text form. Open the page in a browser to confirm the Developer ID column.

---

### 6. App Review Guidelines 4.8 (Login Services) and 5.1.1(v) (account sign-in and deletion): exact wording today

#### Takeaway
Guideline 4.8 no longer names Sign in with Apple. If an app uses a third-party or social login (Google, for example) for the user's main account, it "must also offer as an equivalent option another login service" that (a) collects only name and email, (b) lets users keep their email private, and (c) doesn't collect app interactions for advertising without consent. Sign in with Apple meets all three, so it is the usual way to comply, but it is no longer the only way. Guideline 5.1.1(v) requires in-app account deletion whenever account creation is offered, and it says not to force a login if the app has no significant account-based features.

#### Cited Findings
- 4.8, verbatim: "Apps that use a third-party or social login service (such as Facebook Login, Google Sign-In, Log in with X, Sign In with LinkedIn, Login with Amazon, or WeChat Login) to set up or authenticate the user's primary account with the app must also offer as an equivalent option another login service with the following features: the login service limits data collection to the user's name and email address; the login service allows users to keep their email address private as part of setting up their account; and the login service does not collect interactions with your app for advertising purposes without consent." — [S1](https://developer.apple.com/app-store/review/guidelines/)
- 4.8, primary account: "A user's primary account is the account they establish with your app for the purposes of identifying themselves, signing in, and accessing your features and associated services." — [S1](https://developer.apple.com/app-store/review/guidelines/)
- 4.8 exceptions (another login service not required): the app "exclusively uses your company's own account setup and sign-in systems"; it is an alternative app marketplace (or distributed from one) using a marketplace-specific login; it is "an education, enterprise, or business app that requires the user to sign in with an existing education or enterprise account"; it "uses a government or industry-backed citizen identification system or electronic ID"; it "is a client for a specific third-party service and users are required to sign in to their mail, social media, or other third-party account directly to access their content." — [S1](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.1(v), verbatim: "If your app doesn't include significant account-based features, let people use it without a login. If your app supports account creation, you must also offer account deletion within the app. Apps may not require users to enter personal information to function, except when directly relevant to the core functionality of the app or required by law. If your core app functionality is not related to a specific social network …, you must provide access without a login or via another mechanism. … The app must also include a mechanism to revoke social network credentials and disable data access between the app and social network from within the app. An app may not store credentials or tokens to social networks off of the device and may only use such credentials or tokens to directly connect to the social network from the app itself while the app is in use." — [S1](https://developer.apple.com/app-store/review/guidelines/)
- When the wording changed: SNIPPETS only. One search summary says a 2024 update "made clear that the login service cannot collect interactions with your app for advertising purposes without consent". A forum answer says "The recent guidelines do not require explicitly to sign with Apple account" ([forum 765145](https://developer.apple.com/forums/thread/765145) / [762647](https://developer.apple.com/forums/thread/762647), snippets). The SNIPPET for older (2019–2020) wording: apps "must also offer Sign in with Apple as an equivalent option." The exact date of the change was not confirmed from a fetched Apple page.
- SNIPPET: App Review rejection notices still say "Sign in with Apple is a login service that meets all the requirements specified in guideline 4.8."
- Recent guideline news items fetched (Oct 16 2026, Feb 6 2026, Nov 13 2025, Jun 9 2025) do not mention 4.8. — [S24](https://developer.apple.com/news/?id=pzpmt15y)

#### Inferences
- If the app offers Google (or any social login) as a main account login, it must offer a privacy-focused equal option. Sign in with Apple is the obvious one and the one App Review names in rejections. An email magic link or passkey run by the developer's own system counts as "your company's own account setup", and an app that uses only that needs no extra option.
- Sign in with Apple must be an "equivalent option": the same placement and the same access as Google, not hidden.
- Since 5.1.1(v) says to let people use the app without a login when accounts aren't central, an offline-first reader where sign-in only enables sync should keep working signed out. Sign-in should be optional, offered for sync and backup.
- The "an app may not store credentials or tokens to social networks off of the device" line is about social-network tokens (e.g. Facebook), not your own auth server's session. Storing Apple's refresh token on your own server for revocation is what Apple's TN3194 tells you to do (see section 7).

#### Gaps
- No date found on the guidelines page in the part read (the last ~14k characters were not read).
- The exact date 4.8 dropped the explicit "Sign in with Apple" wording was not confirmed from an Apple page.

---

### 7. Account deletion and revoking Apple tokens

#### Takeaway
If the app creates accounts, it must let people start deleting the whole account inside the app. For Sign in with Apple, Apple says to revoke the user's tokens with `POST https://appleid.apple.com/auth/revoke`. That call needs a `client_secret` (a JWT signed with a Sign in with Apple private key from the developer portal) plus a refresh or access token. You only get those by trading the authorization code at `/auth/token` within five minutes of sign-in. So in practice the server must trade the code at sign-in and store the refresh token, as TN3194 says. The fallback is to ask the user to sign in again at deletion time to get a fresh code. Supabase does none of this for you.

#### Cited Findings
- Deletion rule: "Apps submitted to the App Store that support account creation must also let people initiate deletion of their account within the app." "Deleting an account removes the account from the developer's records, along with any data associated with the account that the developer isn't legally required to maintain." "Only offering to temporarily deactivate or disable an account is insufficient." Make it "easy to find", typically in account settings. — [S2](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- "Apps that support Sign in with Apple should use the Sign in with Apple REST API to revoke user tokens. Use server-to-server notification endpoints to process changes for Sign in with Apple accounts." — [S2](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- Other deletion FAQ: apps outside highly regulated industries "should not require people to make a phone call, send an email, use a chat support flow"; confirming intent is fine, but "apps that make it unnecessarily difficult … will not pass review"; a manual process is acceptable if you tell the person how long it takes and confirm when done; it applies to everyone regardless of region; guest accounts must be deletable too. — [S2](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- Revoke endpoint: `POST https://appleid.apple.com/auth/revoke`, `application/x-www-form-urlencoded`. Required: `client_id` ("The identifier (App ID or Services ID) for your app. The identifier must match the value provided during the authorization request"), `client_secret` ("A secret JSON Web Token (JWT) that uses the Sign in with Apple private key associated with your developer account"), and `token` ("The user refresh token or access token intended to be revoked"). Optional: `token_type_hint` (`refresh_token` or `access_token`). A 200 means "the provided token has been revoked successfully or was previously invalid." — [S3](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/revoke-tokens.json)
- Token endpoint: `POST https://appleid.apple.com/auth/token` with `client_id`, `client_secret`, `code` ("single-use only and valid for five minutes") and `grant_type=authorization_code`. It returns `access_token`, `token_type`, `expires_in` (3600 in the example), `refresh_token` and `id_token`. A refresh-token request returns no new refresh token. — [S4](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json)
- Client secret JWT: header `alg` ES256 and `kid` (10-character key ID); claims `iss` = Team ID, `iat`, `exp` (no more than 15,777,000 seconds, six months, ahead), `aud` = `https://appleid.apple.com`, and `sub` = the same App ID or Services ID used as `client_id` (case-sensitive). Signed with ECDSA P-256 / SHA-256 using the downloaded private key. — [S10](https://developer.apple.com/tutorials/data/documentation/accountorganizationaldatasharing/creating-a-client-secret.json)
- TN3194 (first published 2025-10-03): "The Token revocation endpoint (`/auth/revoke`) is the only way to programmatically invalidate user tokens associated to your developer account without user interaction." At account creation: "Securely transmit the identity token and authorization code to your app server"; "Verify the identity token and validate the authorization code using the `/auth/token` endpoint"; "Once the authorization code is validated, securely store the token response — including the identity token, refresh token, and access token." — [S17](https://developer.apple.com/tutorials/data/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple.json)
- TN3194, with no token or code available: "you must still fulfill the user's account deletion request". Delete the data, "Direct the user to manually revoke access" (https://support.apple.com/en-us/102571), and handle the revoked notification. Otherwise, "the next time the user authenticates … they won't be presented with the initial authorization flow to enter their full name, email address, or both." — [S17](https://developer.apple.com/tutorials/data/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple.json)
- Firebase's pattern (it does not store Apple tokens): "you must ask the user to sign in again before revoking their token and deleting the account." It then revokes with the fresh authorization code. — [S31](https://firebase.google.com/docs/auth/ios/apple)
- Supabase's Apple guide does not cover token revocation or account deletion for native sign-in. It says Supabase Auth doesn't support server-to-server notifications ("leave that setting blank"). Its six-month secret rotation applies only to its OAuth (web) setup. — [S28](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- News, Oct 9 2025: from Jan 1 2026, developers based in the Republic of Korea must provide a server-to-server endpoint when registering or updating a Services ID. On account deletions it points to TN3194. — [news item j9zukcr6](https://developer.apple.com/news/?id=j9zukcr6) (text read inside the news list page [S24](https://developer.apple.com/news/?id=pzpmt15y)); also noted in [S2](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

#### Inferences
- Even a "native-only, no secret needed" Supabase setup needs a Sign in with Apple private key (.p8) and a client-secret JWT, but only on whatever server code does the trade and the revoke (for example a Supabase Edge Function). The key is not needed in Supabase's provider settings. For native, `client_id` (and the secret's `sub`) is the bundle ID.
- Plan A (Apple's TN3194 way): after native sign-in, the page also sends `authorizationCode` to a server function. Within five minutes that function calls `/auth/token` with the bundle ID as `client_id` and stores the `refresh_token`, encrypted and tied to the user's `sub`. At deletion it calls `/auth/revoke` with the stored token, then deletes the account.
- Plan B (Firebase way): store nothing. At deletion the shell runs native Sign in with Apple again, and the server immediately trades that fresh code and revokes. It is simpler and stores no token, but it means asking the user to sign in again when they delete.
- Either way the client secret JWT can be made fresh on each call (short `exp`), which avoids the six-month expiry problem.
- If the server was in the EU or elsewhere, remember the stored refresh token is personal data and must be deleted with the account (TN3194 lists "The token used for token revocation").

#### Gaps
- TN3194 does not say what to do on `invalid_grant`/`invalid_client`; it points to TN3107 (not fetched).
- Whether App Review actually tests that tokens were revoked is not stated anywhere I read. S2 says "should", not "must", for the REST API revoke.

---

### 8. Private email relay

#### Takeaway
A user can hide their email. The app then gets a relay address (`@privaterelay.appleid.com`, and since Aug 2026 new ones on `@private.icloud.com`) that forwards to the user's real inbox. Mail sent to a relay address is delivered only if the sending domain or address is registered in the developer portal ("Sign in with Apple for Email Communication") and passes SPF and/or DKIM. Unregistered senders bounce.

#### Cited Findings
- "A private relay email service sends email to a recipient using an automatically generated email address." Relay addresses "end in `@private.icloud.com`, `@privaterelay.appleid.com`, or `@icloud.com`". They are the same for one user across all apps from one developer team, and active whether or not the app is installed. — [S11](https://developer.apple.com/tutorials/data/documentation/signinwithapple/communicating-using-the-private-email-relay-service.json)
- "Each private relay email address has a daily limit of 100 emails, which includes emails from the developer to the relay address, as well as user replies." If the user turns forwarding off, "the relay server rejects all future emails sent to that address." — [S11](https://developer.apple.com/tutorials/data/documentation/signinwithapple/communicating-using-the-private-email-relay-service.json)
- Portal steps: Certificates, Identifiers & Profiles → Services → Configure under "Sign in with Apple for Email Communication" → Email Sources (+) → enter domains/subdomains or individual addresses → Register; the table shows whether SPF passed. Individuals can register up to 32 email sources (organisations 100). — [S12](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service)
- "All outbound emails sent through the Private Email Relay service must be authenticated with the Sender Policy Framework (SPF) and/or DomainKeys Identified Mail (DKIM) protocol … We recommend authenticating outbound emails using both." For SPF, the envelope-sender (Return-Path) domain must be registered and match exactly. If the email provider uses its own envelope domain, "you must sign your emails with DKIM", and the DKIM `d=` domain must exactly match the registered From: domain. "If you don't register all the source domains or emails that you use, email sent to the private relay service will result in a bounce message." — [S12](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service)
- News, Aug 24 2026, "Update: New domain for Sign in with Apple": new private relay addresses will be issued on `private.icloud.com`; make sure account systems, email-validation logic and allowlists accept that domain. — [S24](https://developer.apple.com/news/?id=pzpmt15y) (read from the news list page)
- `email-enabled` / `email-disabled` notifications tell the server when forwarding is switched. — [S5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts.json)

#### Inferences
- If the app ever emails users (a sign-in link, a mailing list, or Supabase's own auth mail), every sending domain has to be registered: the app's mail domain, plus the email provider's envelope domain or DKIM alignment. Supabase's default sender is Supabase's own domain, so mail from it to relay addresses would bounce unless a custom SMTP sender on a registered domain is set up. That last point is inference; Supabase S28 only mentions registering email sources under OAuth setup.
- Email-validation code must accept `private.icloud.com` addresses (Aug 2026 change).

#### Gaps
- None major. The Aug 2026 news item was read from the list page, not its own page.

---

### 9. Name only on first authorization; credential-state checks; revoked notification; server-to-server notifications

#### Takeaway
Apple gives the user's name (and the email, through the credential object) only on the first authorization. The name is never in the identity token, so the app must save it immediately (with Supabase, `updateUser`). On device, call `getCredentialState(forUserID:)` (cheap, works offline) at launch or on foreground, and watch `credentialRevokedNotification`. But when an Apple Account is deleted, no revoked notification is sent, so the state check is what catches it. Server-to-server notifications (`email-disabled`, `email-enabled`, `consent-revoked`, `account-deleted`) are set up on the app's primary App ID, so a native-only app can receive them, but Supabase does not handle them; it would take a separate small endpoint.

#### Cited Findings
- "The API collects this information and shares it with your app the first time the user logs in using Sign in with Apple. If the user then uses Sign in with Apple on another device, the API doesn't ask for the user's name or email again. It collects the information again only if the user stops using Sign in with Apple and later reconnects." "[Apple] doesn't include other information about the user, such as their name. When you receive user information from the API response, immediately store it locally so your app can access it again in the event of a process or network failure." — [S7](https://developer.apple.com/tutorials/data/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.json)
- "Apple doesn't receive the user's full name shared with the system UI. The raw data is passed directly to your app … and is not included in the user's identity token. To help prevent cross-site scripting attacks, validate and sanitize the user-submitted first and last name values before storing." The user can edit the name in the sheet. — [S9](https://developer.apple.com/tutorials/data/documentation/signinwithapple/receiving-a-users-identity-token.json)
- Supabase: "Apple only provides the user's full name during the first sign-in attempt." Later sign-ins return null; after sign-in, call `updateUser` with `full_name`, `given_name`, `family_name`. — [S28](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- Credential state: `getCredentialState(forUserID:)` returns `.authorized`, `.revoked` or `.notFound`. On revoked/notFound, show sign-in. — [S6](https://developer.apple.com/tutorials/data/documentation/authenticationservices/implementing-user-authentication-with-sign-in-with-apple.json). "You may tie the session's lifetime to successful `getCredentialState(forUserID:completion:)` calls on Apple devices. This is a local, inexpensive, nonnetwork call …" "If the user's Apple Account changes in the system, calls … indicate that the user changed. Assume that a different user has signed in and log out the app's currently known user." — [S8](https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json)
- "When a user permanently deletes their Apple Account, Sign in with Apple invalidates all user tokens and disables email forwarding for all associated apps. For native apps, the system doesn't send a `credentialRevokedNotification`. Use `getCredentialState(forUserID:completion:)` to respond to account deletion events." — [S5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts.json)
- Native apps should "observe the `credentialRevokedNotification` and use `getCredentialState(forUserID:completion:)`". On either event: delete all user data (including the stored revocation token, server data, and Keychain/on-disk data) and "Revert the client to an unauthenticated state." — [S17](https://developer.apple.com/tutorials/data/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple.json)
- Server-to-server notifications: the server needs TLS 1.2+. The payload is a JWS signed by Apple, posted as `{"payload": "<JWT>"}`, with claims `iss`, `aud`, `iat`, `jti`, `events`. Event types: `email-disabled`, `email-enabled`, `consent-revoked` ("revokes consent for your app to use their Apple Account and their credentials become invalid"), and `account-deleted` ("requests that Apple permanently delete their Apple Account"). Email events carry `sub`, `email`, `is_private_email` and `event_time`; the other two carry `sub` and `event_time`. One endpoint may serve several teams and apps. — [S5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts.json)
  - Note: the task brief says "account-delete"; Apple's page spells it `account-deleted`.
- "Supabase Auth doesn't support" server-to-server notifications; leave the setting blank. — [S28](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- Registering the endpoint: Identifiers → your App ID → enable Sign in with Apple → Configure → "Provide a server-to-server notification endpoint URL. Only one URL can be provided per each Sign in with Apple app grouping and key." "A server-to-server notification endpoint URL can only be registered on a primary App ID. The endpoint URL must be an absolute URI including the scheme, host, and path." "TLS 1.2 is required." — [S33](https://developer.apple.com/help/account/capabilities/enabling-server-to-server-notifications)

#### Inferences
- In the shell: keep `user` (the Apple user ID) in the Keychain. On launch or foreground call `getCredentialState`, and observe `credentialRevokedNotification`. On `.revoked`/`.notFound`, tell the page (shell to page) to sign out of Supabase and clear local account data. This is the native replacement for server notifications, and it costs no network call.
- The name has to travel from Swift to the page on the first sign-in in the same reply as the token, and the page must call `updateUser` right after `signInWithIdToken` succeeds. If that call fails, the name is gone until the user revokes and re-authorises. So the shell or page should keep it locally until it is saved (Apple: "immediately store it locally").
- Server-to-server notifications are registered on the primary App ID (S33), so they are available to a native-only app. With Supabase they are optional: anything wanted (like `email-disabled` or `account-deleted`) would need a separate small https endpoint (for example an Edge Function) that checks Apple's JWS and edits Supabase data. Only developers based in Korea are required to register one (S24).

#### Gaps
- The `credentialRevokedNotification` reference page was not fetched directly. Its use is from TN3194 and S5.

---

### 10. TestFlight vs production

#### Takeaway
I found no Apple statement that Sign in with Apple behaves differently in TestFlight. By inference from the absence of any documented difference (no source states it), it has no separate sandbox the way StoreKit does, and it uses real Apple Accounts. Forum reports of TestFlight-only failures are anecdotes, usually traced to signing or profile problems or to Apple-side failures on newly created App IDs.

#### Cited Findings
- SNIPPET: Apple's StoreKit docs say apps from TestFlight always run in the sandbox for in-app purchases. That is a StoreKit statement, not about Sign in with Apple.
- SNIPPETS: "works perfectly as expected from Xcode but nothing happens … after deploying to TestFlight" ([forum 660156](https://developer.apple.com/forums/thread/660156)). "AuthorizationError 1000 on a brand-new SIWA setup (TestFlight)" while Google Sign-In worked ([forum 839521](https://developer.apple.com/forums/thread/839521), 2026). Others report it working the same in TestFlight, Xcode and clean installs.
- Apple's Sign in with Apple pages fetched (S5–S9, S17) make no mention of a separate TestFlight or sandbox environment for Sign in with Apple.

#### Inferences
- Treat TestFlight like production: real Apple Accounts, real `sub` values (the same team, so the same `sub` as the App Store build), real relay addresses. Accounts made while testing are real Apple authorisations, so revoke them (Settings → Apple Account → Sign in with Apple) to see the first-run name/email flow again.
- A TestFlight build is distribution-signed. If the capability is in the App ID and the build, it should work; failures point at the profile or entitlement.

#### Gaps
- No primary Apple source found either way. This rests on the absence of any documented difference plus forum anecdotes (snippets).


## Topic 2: How does Sign in with Apple work on the website, including Firefox?


Date of reading for every source: 2026-11-15. Each source is marked **FETCHED** (page body read) or **SNIPPET** (seen only in search results). Quotes came through a summarising fetch tool; wording is as returned, but punctuation was normalised in at least one case (curly to straight apostrophes in A8), so re-check any quote before printing it. Apple documentation was read through its JSON data address (`/tutorials/data/documentation/...json`); the human address is given alongside where useful.

Source list (used below):
- [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json) Apple, Configuring your environment for Sign in with Apple — https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json — FETCHED
- [A2](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json) Apple, Incorporating Sign in with Apple into other platforms — https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json — FETCHED
- [A3](https://developer.apple.com/tutorials/data/documentation/accountorganizationaldatasharing/creating-a-client-secret.json) Apple, Creating a client secret (Account and Organizational Data Sharing; the page the token docs link to) — https://developer.apple.com/tutorials/data/documentation/accountorganizationaldatasharing/creating-a-client-secret.json — FETCHED
- [A4](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json) Apple, Generate and validate tokens — https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json — FETCHED
- [A5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json) Apple, Configuring your webpage for Sign in with Apple — https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json — FETCHED (the `signinwithapplejs/...` variant suggested in the brief 404s)
- [A6](https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/clientconfigi.json) Apple, ClientConfigI — https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/clientconfigi.json — FETCHED
- [A7](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/errorresponse.json) Apple, ErrorResponse — https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/errorresponse.json — FETCHED
- [A8](https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/authorizationi/id_token.json) Apple, AuthorizationI id_token (claims) — https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/authorizationi/id_token.json — FETCHED
- [A9](https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json) Apple, Verifying a user — https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json — FETCHED
- [A10](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/revoke-tokens.json) Apple, Revoke tokens — https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/revoke-tokens.json — FETCHED
- [A11](https://developer.apple.com/tutorials/data/documentation/signinwithapple/communicating-using-the-private-email-relay-service.json) Apple, Communicating using the private email relay service — https://developer.apple.com/tutorials/data/documentation/signinwithapple/communicating-using-the-private-email-relay-service.json — FETCHED
- [A12](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/) Apple Developer Account Help, Configure Sign in with Apple for the web — https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/ — FETCHED
- [A13](https://developer.apple.com/tutorials/data/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.json) Apple, Authenticating users with Sign in with Apple — https://developer.apple.com/tutorials/data/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.json — FETCHED
- [F1](https://developer.apple.com/forums/thread/834970) Apple Developer Forums thread 834970, "Sign in with Apple across two iOS apps and one web Services ID" (Jun 2026, DTS answer) — https://developer.apple.com/forums/thread/834970 — FETCHED
- [F2](https://developer.apple.com/forums/thread/128788) Apple Developer Forums thread 128788, "Sign in with apple js use popUp" (2020–2021) — https://developer.apple.com/forums/thread/128788 — FETCHED
- [F3](https://developer.apple.com/forums/thread/709400) Apple Developer Forums thread 709400, usePopup cannot post (Jun 2022) — https://developer.apple.com/forums/thread/709400 — FETCHED
- [F4](https://developer.apple.com/forums/thread/119616) Apple Developer Forums threads https://developer.apple.com/forums/thread/119616 and https://developer.apple.com/forums/thread/719985 on the domain verification file — SNIPPET only
- [F5](https://developer.apple.com/forums/tags/sign-in-with-apple-js?page=7) Apple Developer Forums / search summary that the JS library forces `response_mode=web_message` in popup mode — https://developer.apple.com/forums/tags/sign-in-with-apple-js?page=7 — SNIPPET only
- [S1](https://supabase.com/docs/guides/auth/social-login/auth-apple) Supabase, Login with Apple — https://supabase.com/docs/guides/auth/social-login/auth-apple — FETCHED
- [L1](https://lucia-auth.com/) Lucia — https://lucia-auth.com/ — FETCHED
- [L2](https://github.com/panva/jose) jose (panva) README — https://github.com/panva/jose — FETCHED
- [L3](https://v2.arcticjs.dev/providers/apple) Arctic v2 Apple provider — https://v2.arcticjs.dev/providers/apple — FETCHED
- [L4](https://v1.arcticjs.dev/providers/apple) Arctic v1 Apple provider — https://v1.arcticjs.dev/providers/apple — FETCHED
- [L5](https://arcticjs.dev/providers/apple) Arctic current Apple provider — https://arcticjs.dev/providers/apple — 301 to https://arctic.pilcrowonpaper.com/providers/apple, which returned 404; content seen only as SNIPPET
- [L6](https://www.better-auth.com/docs/authentication/apple) Better Auth, Apple — https://www.better-auth.com/docs/authentication/apple — FETCHED
- [L7](https://authjs.dev/getting-started/providers/apple) Auth.js, Apple provider — https://authjs.dev/getting-started/providers/apple — FETCHED
- [C1](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) Cloudflare Workers, Web Crypto — https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ — FETCHED
- [M1](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign) MDN, SubtleCrypto.sign() — https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign — FETCHED
- [B1](https://bugzilla.mozilla.org/show_bug.cgi?id=1987563) Mozilla Bugzilla 1987563 (Apple `aasp` cookie / SameSite, Firefox 142) — https://bugzilla.mozilla.org/show_bug.cgi?id=1987563 — FETCHED
- [B2](https://bugzilla.mozilla.org/show_bug.cgi?id=1987554) Mozilla Bugzilla 1987554 (Apple passkey sign-in freeze in Firefox, LastPass) — https://bugzilla.mozilla.org/show_bug.cgi?id=1987554 — FETCHED
- [B3](https://support.mozilla.org/en-US/questions/1302948) Mozilla support question 1302948 ("Can't access apple websites which require a login", fix `privacy.resistFingerprinting`) — https://support.mozilla.org/en-US/questions/1302948 — fetch returned a "Client Challenge" page; SNIPPET only
- [D1](https://dev.to/oskarmakarov/sign-in-with-apple-broke-with-invalidclient-after-6-months-heres-why-and-how-to-never-deal-2mhk) dev.to, "Sign in with Apple broke with invalid_client after 6 months" — https://dev.to/oskarmakarov/sign-in-with-apple-broke-with-invalidclient-after-6-months-heres-why-and-how-to-never-deal-2mhk — FETCHED (year of post not shown)
- [X2](https://meta.discourse.org/t/sign-in-with-apple/122790/40) Discourse Meta, "Sign in with Apple" post #40 (Aug 4 2020) — https://meta.discourse.org/t/sign-in-with-apple/122790/40 — FETCHED
- [K1](https://appleid.apple.com/auth/keys) Apple's public identity-token key set — https://appleid.apple.com/auth/keys — FETCHED
- [X1](https://lists.openstreetmap.org/pipermail/rails-dev/2025-August/043293.html) Search summary on form_post + SameSite cookie failures (OpenStreetMap, Discourse, Vapor, ueberauth_apple) — e.g. https://meta.discourse.org/t/sign-in-with-apple/122790/40, https://lists.openstreetmap.org/pipermail/rails-dev/2025-August/043293.html — SNIPPET only

---

### Services ID: what it is, how it ties to the App ID, domains and return URLs

#### Takeaway
A Services ID is the web "client_id". It is attached to an existing primary App ID that has Sign in with Apple turned on, and carries a list of domains and absolute return URLs. Return URLs must be HTTPS with a real domain name (no localhost, no IP, no `#`), and a path such as `/auth/apple/callback` is fine. Apple's account help now says no verification file needs to be uploaded, while an older-style Apple doc still says "register and verify".

#### Cited Findings
- "You must use a unique identifier — a Services ID — to register each web service that supports Sign in with Apple authentication. You configure the Services ID with the registered domains and return URLs for a primary app." — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json)
- The Services ID is used "as the client identifier when authenticating or validating users with Sign in with Apple JS and Sign in with Apple REST API." — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json)
- Setup: "create a Services ID and associate your website to an existing primary iOS, macOS, tvOS, or watchOS App ID enabled for Sign in with Apple." Step 6: "select your app from the list of primary App IDs that is related to your website." Step 7: "Under Website URLs, provide your domains, subdomains, or return URLs as a comma-delimited list. You must provide at least one domain or subdomain." — [A12](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)
- Domain file: "You don't need to upload a file on your server to complete the registration process for domains and subdomains." — [A12](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)
- Contradicting/older wording: "you must register and verify all top-level domains and subdomains that incorporate Sign in with Apple. Domains associate with your Apple Developer Team ID." The page does not describe any verification steps. — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json)
- Forum reports (since about Nov 2020) that the `apple-developer-domain-association.txt` file was no longer asked for — [F4](https://developer.apple.com/forums/thread/119616) (SNIPPET only).
- Limits: "Organizations can register up to 100 website URLs"; "Individuals can register up to 10 website URLs" — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json); same numbers in [A12](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/).
- Return URL shape: "each registered URL must be absolute and must include the scheme, host, and path. The following is an example return URL: `https://example.com/path/to/endpoint`" — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json)
- redirect_uri: "It must include a domain name and can't be an IP address or `localhost`, and must not contain a fragment identifer (#)." — [A2](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json); token endpoint adds "The URI must use the HTTPS protocol" — [A4](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json); JS: "The host specified in `appleid-signin-redirect-uri` must include a domain name. It can't be an IP address or `localhost`" — [A5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json)
- Primary App ID grouping: "Choose to group with an existing primary App ID if you're associating an App ID with a related app ... App grouping ensures that users need to provide consent to share their information only once for each group of apps and websites." — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json)
- "Apple associates your Sign in with Apple private key with a primary app, and its app group, if available." — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json)
- Each app group is notified when users "Change email forwarding preferences," "Delete their app account," "Permanently delete their Apple Account" — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json)
- Removing the Services ID's association: "Associated services will be affected by disassociating your domain." — [A12](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)
- Developers working around the localhost ban add a hosts-file entry such as `127.0.0.1 mywebsite-dev.com` — [F2](https://developer.apple.com/forums/thread/128788) (forum post, Aug 2020)

#### Inferences
- `https://example.app/auth/apple/callback` fits Apple's own example shape (scheme + host + path) and meets every stated rule; a subpath is fine.
- Local development cannot use `localhost` or an IP. Options: a hosts-file alias for a real-looking domain, or a Cloudflare Pages preview deployment whose address is registered as a return URL (each preview domain would count against the 10/100 limit; per-branch preview names are more stable than per-commit ones).
- Because a Services ID must hang off a *primary* App ID, the web client naturally lands in the same group as the native app.

#### Gaps
- Apple's two pages disagree on whether domains must be "verified". The account-help page (more specific, step-by-step) says no file is needed; I found no current Apple page describing any verification step. Treat "no file needed" as current, but confirm in the portal.
- Whether a wildcard or a `*.pages.dev` preview address is accepted was not found.

---

### response_mode=form_post: what arrives, and what it means for a static site and its cookies

#### Takeaway
If `name` or `email` is requested, Apple must answer with an HTTP POST (`application/x-www-form-urlencoded`) to the return URL, so a Pages Function has to receive it. The POST carries `code`, `id_token`, `state`, and on the very first authorization only, a `user` JSON string with name and email. Because the POST comes from appleid.apple.com, browsers will not send a `SameSite=Lax` (or Strict) cookie with it; a state cookie must be `SameSite=None; Secure`, or the state check must avoid cookies.

#### Cited Findings
- "The type of response mode expected. Valid values are `query`, `fragment`, and `form_post`. If you requested any scopes, the value must be `form_post`." — [A2](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json)
- "For the `form_post` value, an HTTP `POST` request containing the results of the authorization is sent to the `redirectURI`. The HTTP body contains the result parameters with `application/x-www-form-urlencoded` content type." — [A2](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json)
- "At the end of the authorization flow, Apple performs a `form_post` to the `redirect_uri` value you provided. At this point, the authorization flow is complete, and it's your server's responsibility to persist the data and return control to the app." — [A2](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json)
- Scopes: "Valid values are `name` and `email`. You can request one, both, or none." — [A2](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json)
- Fields: `code` — "A single-use authorization code that's valid for five minutes"; `id_token` — "returned if the authorization request contained `code` and `id_token` as a value for `response_type`"; `state` — returned if provided; `user` — "A JSON string containing the data requested in the `scope` property ... `{ "name": { "firstName": string, "lastName": string }, "email": string }`." — [A2](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json)
- "Apple only returns the user object the first time the user authorizes the app. Validate and persist this information from your app to your server. Subsequent authorization requests do not contain the user object, however, the user's email is provided in the identity token for all requests." — [A5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json)
- Supabase: "Apple only provides the user's full name during the first sign-in attempt (when the user initially authorizes your app)." — [S1](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- Error: "The only error code that might be returned is `user_cancelled_authorize`." — [A2](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json)
- `state` "is also used to mitigate cross-site request forgery attacks, by comparing against the state value contained in the authorization response." — [A5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json)
- Community reports: the form_post callback is a cross-site POST, so a `SameSite=Lax` session/state cookie is not attached, producing "state missing/mismatch". Fixes used: a separate short-lived state cookie with `SameSite=None; Secure` (sometimes scoped to the callback path); or a POST handler that re-issues the data as a same-site GET/redirect; exempting the callback from CSRF middleware. — [X1](https://lists.openstreetmap.org/pipermail/rails-dev/2025-August/043293.html) (SNIPPET only; OpenStreetMap, Discourse, Vapor, ueberauth_apple)
- Primary community account (Discourse, Aug 4 2020): "Apple is using a POST request on the callback"; with `samesite=Lax` cookies "Discourse is unable to read session cookies during the callback", giving a CSRF error. Workaround `samesite=None` (called INSECURE by the author for a whole-site session cookie); proposed secure fix: answer the POST with JavaScript that sets `window.location='/auth/apple/callback?code=...&state=...'` (turn it into a same-site GET). Also: "Using a POST request without a CSRF token also trips another security measure in core." — [X2](https://meta.discourse.org/t/sign-in-with-apple/122790/40)
- Firefox and an Apple cookie with unspecified SameSite: Firefox treats it as "None" — "created with `SameSite` unspecified, which Firefox treats as 'None'" (Apple's own cookie, Firefox 142) — [B1](https://bugzilla.mozilla.org/show_bug.cgi?id=1987563)

#### Inferences
- On Cloudflare Pages, put a function at e.g. `/functions/auth/apple/callback.ts` exporting `onRequestPost`; static files alone cannot receive the POST.
- The `user` JSON is the only time the name is ever delivered. The callback must save it on that first POST (or carry it forward, e.g. into the session it creates), or it is lost for good; re-requesting later will not bring it back.
- State checking without a cross-site cookie: a signed, stateless `state` (an HMAC over a random value + expiry, verified in the function) needs no cookie at all; pairing it with a `nonce` whose hash Apple echoes inside the signed `id_token` gives replay protection. A `SameSite=None; Secure; HttpOnly; Path=/auth/apple` state cookie also works in Safari, Chrome and Firefox today, since it is a first-party cookie on our own domain (sent with a cross-site top-level POST when `None`).
- After the POST is handled, respond with a 303 redirect to a static page; any session cookie set on that response can be `SameSite=Lax`, because subsequent navigations are same-site.

#### Gaps
- No Apple primary source discusses SameSite; the cookie guidance rests on one fetched community account [X2](https://meta.discourse.org/t/sign-in-with-apple/122790/40) plus snippets [X1](https://lists.openstreetmap.org/pipermail/rails-dev/2025-August/043293.html) and general browser rules.
- I did not test whether Safari's tracking prevention treats the `SameSite=None` cookie differently on a cross-site POST (it is first-party to our domain, so it should be sent).

---

### Sign in with Apple JS: popup vs redirect, does popup avoid the form_post, and Firefox

#### Takeaway
Redirect mode makes Apple POST to the return URL (server needed). Popup mode (`usePopup: true`) hands the result back to the opening page as a DOM event / resolved promise containing `code`, `id_token`, `state` and the first-time `user` object, so no server endpoint receives a form POST; but the page's origin must match the `redirectURI`'s origin, which must be a registered return URL. No current, Firefox-specific breakage of Apple's popup was found; known Firefox problems are an origin-mismatch `postMessage` error (2020), Apple's own cookie bug (Firefox 142, fixed), password-manager extensions hijacking the passkey step, and a resistFingerprinting report (snippet only).

#### Cited Findings
- Script: `https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js` — [A5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json)
- Init: `AppleID.auth.init({ clientId, scope, redirectURI, state, nonce, usePopup : true })`; meta-tag equivalents `appleid-signin-client-id`, `-scope`, `-redirect-uri`, `-state`, `-nonce`, `-use-popup`. — [A5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json); `usePopup`: "A Boolean that enables showing the flow in a popup." — [A6](https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/clientconfigi.json)
- Redirect mode: "Apple ... sends an HTTP POST request containing the results of the authorization to the URL provided in `redirectURI`." — [A5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json)
- Popup mode: "If you use the pop-up option ... After Apple's server processes the authorization request, it dispatches a Domain Object Model (DOM) event containing the results of the authorization: `AppleIDSignInOnSuccess` on success, or `AppleIDSignInOnFailure` on failure." Also `await AppleID.auth.signIn()` returns a promise. — [A5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json)
- Popup success data: `{ "authorization": { "code", "id_token", "state" }, "user": { "email", "name": { "firstName", "lastName" } } }` — [A5](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple.json)
- Apple staff (Mar 2020): "when "usePopup" set to true, we will only post the data back to the "redirectURI" provided in AppleID.auth.init"; "if the app that invoked Sign in with Apple JS has url "https://www.example.com/test" then the redirectURI should be "https://www.example.com""; "if the app url is "https://www.example2.com/test" then the app will not get any data". — [F2](https://developer.apple.com/forums/thread/128788)
- Developer (Oct 2020): "It appears the iframe is only allowed to do the "post" on the same origin as the page that opened the popup." Firefox showed: "Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('https://x.example.com') does not match the recipient window's origin ('https://y.example.com')." — [F2](https://developer.apple.com/forums/thread/128788)
- Same symptom (Jun 2022): "I cannot get apple sign in to post to my redirectURI if I set `usePopup: true`" with "Unable to post message to https://my-staging-site... Recipient has origin https://....ngrok.io." No answer. — [F3](https://developer.apple.com/forums/thread/709400)
- Reports (2020) of the popup not resolving the promise / not closing on cancel. — [F2](https://developer.apple.com/forums/thread/128788)
- Workaround (Jan 2021): skip the library and `window.open('https://appleid.apple.com/auth/authorize?response_type=code&...&response_mode=form_post...')`; the popup then redirects to the return URL (server POST again). — [F2](https://developer.apple.com/forums/thread/128788)
- The JS library reportedly overrides `response_mode` to `web_message` when `usePopup` is on — [F5](https://developer.apple.com/forums/tags/sign-in-with-apple-js?page=7) (SNIPPET only).
- Supabase's web example uses the `usePopup: true` option for `AppleID.auth.init`. — [S1](https://supabase.com/docs/guides/auth/social-login/auth-apple) (what it does with the result was not in the fetched text)
- Firefox reports found:
  - Bug 1987563 (Firefox 142; the page shows only relative dates, "1 year ago", so roughly late 2025; Android appears only in the bug's platform tag, and every report quoted was desktop — Windows, macOS, Linux): Apple's `idmsa.apple.com` `aasp` cookie switched to `SameSite=Lax`; stale cookies broke Apple logins; Apple reverted; status VERIFIED FIXED (verified on 144). Workaround was clearing Apple site data. — [B1](https://bugzilla.mozilla.org/show_bug.cgi?id=1987563)
  - Bug 1987554 (Firefox 142.0.1, macOS): "Continue with Apple" → "Sign in with Passkey" froze; cause a LastPass extension update hijacking the passkey step; RESOLVED WORKSFORME. "This function works on both Safari and Chrome successfully in the same machine." — [B2](https://bugzilla.mozilla.org/show_bug.cgi?id=1987554)
  - Mozilla support 1302948: Apple logins failing in Firefox, user fix was `privacy.resistFingerprinting` — [B3](https://support.mozilla.org/en-US/questions/1302948) (SNIPPET only).
  - Bug 2012345 "Login with Apple using macOS: Failed to verify identity (caused by extensions)" RESOLVED INVALID — mentioned in [B1](https://bugzilla.mozilla.org/show_bug.cgi?id=1987563).
- No source tied `usePopup` to Firefox Enhanced Tracking Protection; no Firefox-for-Android-specific Sign in with Apple report was found (search, 2026-11-15).

#### Inferences
- Popup mode does avoid the need for a server route that receives Apple's form POST: the result lands in page JavaScript. The page must then send `id_token` (and `code` if the token exchange is wanted) to a Pages Function, which verifies it. The `redirectURI` still has to be a registered return URL on the same origin as the page.
- Popups must be opened from a direct user click (all browsers' blockers allow that); on Firefox Android a popup becomes a new tab, and `postMessage` back to the opener still works in principle, but this was not confirmed by any source. Redirect mode is the safer fallback for mobile and for anyone with strict popup or extension setups.
- Most Firefox failures found were in Apple's own login pages (cookies, passkeys, extensions), affecting both modes equally; they are not specific to the site's code. A visible "Having trouble? Try again in a new tab / private window" path would cover them.
- Building both (popup default on desktop, redirect on mobile/fallback) matches the repo's "build it more than one way" habit and costs one extra function route.

#### Gaps
- Apple does not document which `response_mode` the JS library uses in popup mode; the `web_message` claim is snippet-only.
- No recent (2025–2026) primary report on popup mode in Firefox desktop or Android was found; needs a real test on each browser.

---

### The .p8 key, Key ID, Team ID and the client secret JWT; expiry and renewal

#### Takeaway
The client secret is a JWT signed ES256 (ECDSA P-256, SHA-256) by the Sign in with Apple private key, with header `kid` = Key ID and claims `iss` = Team ID, `iat`, `exp` ≤ 15,777,000 seconds (six months) ahead, `aud` = `https://appleid.apple.com`, `sub` = the client_id (Services ID for web). It is only needed for the token endpoint and revoke; verifying an `id_token` does not use it. An expired secret makes the token exchange fail with `invalid_client`. Signing it fresh on the server (per request or cached for minutes) removes the six-month chore; hosted providers like Supabase need a new pasted secret every six months.

#### Cited Findings
- Header: `alg` "use `ES256`"; `kid` "A 10-character key identifier". — [A3](https://developer.apple.com/tutorials/data/documentation/accountorganizationaldatasharing/creating-a-client-secret.json) (this page is under Account and Organizational Data Sharing; the token docs link "creating a client secret" here)
- Claims: `iss` "use the 10-character Team ID"; `iat` seconds since epoch; `exp` "It's an error to request an expiration time more than `15777000` seconds (six months) in the future, as measured by the clock on Apple's servers."; `aud` "use `https://appleid.apple.com`"; `sub` "use the same App ID or Services ID that you use as the `client_id` ... The value is case-sensitive." — [A3](https://developer.apple.com/tutorials/data/documentation/accountorganizationaldatasharing/creating-a-client-secret.json)
- Signing: "sign it using the Elliptic Curve Digital Signature Algorithm (ECDSA) with the P-256 curve and the SHA-256 hash algorithm." — [A3](https://developer.apple.com/tutorials/data/documentation/accountorganizationaldatasharing/creating-a-client-secret.json)
- "To validate your web service, Sign in with Apple requires you to create a JSON web token (JWT) with the key identifier (`kid`) in the header." — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json)
- "Each primary app can have a maximum of two private keys." Rotation: "create a new private key for the primary app. Then, after transitioning to the new key, revoke the old private key." — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json)
- client_secret: "Authorization code and refresh token validation requests require this parameter." — [A4](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json)
- Expired secret: `invalid_client` — "invalid client secret (expired token, malformed claims, or invalid signature), or mismatched or invalid redirect URI." — [A7](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/errorresponse.json)
- Supabase: "Apple requires you to generate a new secret key every 6 months using the signing key (`.p8` file)." Its generator "does not currently work in Safari, so use Firefox or a Chrome-based browser instead." — [S1](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- Supabase ordering pitfall: "If a native App ID comes before the Services ID, native sign-in keeps working but web sign-in is rejected by Apple."; "the native `signInWithIdToken` flow accepts any client ID in the list as a valid token audience, regardless of order." — [S1](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- After expiry, web sign-in failed with `invalid_client` ("Unable to exchange external code" in Supabase logs) while "Native `signInWithIdToken` flows don't use the client secret" and kept working; advice for self-hosted auth: "generate the secret dynamically on each request instead"; hosted dashboards (Supabase, Firebase, Auth0) need a pasted secret. — [D1](https://dev.to/oskarmakarov/sign-in-with-apple-broke-with-invalidclient-after-6-months-heres-why-and-how-to-never-deal-2mhk) (blog, year not shown)
- Better Auth: "We recommend generating the client secret JWT in your auth configuration"; "Apple rejects client secret JWTs that expire more than 15,777,000 seconds (six months) in the future." — [L6](https://www.better-auth.com/docs/authentication/apple)
- Identity-token verification steps list only Apple's public key, `nonce`, `iss`, `aud`, `exp` — no client secret. — [A9](https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json)
- Apple's public keys at `https://appleid.apple.com/auth/keys` (read 2026-11-15): three keys, each `kty: RSA`, `use: sig`, `alg: RS256` (kids GNCf4J83Oh, nP41CGTvOz, 8nTlO3M2Bk). — [K1](https://appleid.apple.com/auth/keys)

#### Inferences
- Sign-in that only verifies the `id_token` (popup mode, or reading `id_token` from the form POST) keeps working after the client secret expires. What breaks: the code exchange (and so refresh tokens) and token revocation — the latter matters for account deletion.
- On our own Pages Function, store the `.p8` contents as an encrypted secret (Cloudflare Pages secret / env var), plus Team ID and Key ID as plain vars; sign a short-lived secret (e.g. 5 minutes) whenever calling Apple. No calendar reminder needed.
- If Supabase is the auth layer, the six-month paste is unavoidable for its web flow, unless the web uses the popup + id-token path (no secret involved).

#### Gaps
- Apple's Sign in with Apple-specific "Creating a client secret" page could not be fetched separately from the Data Sharing one; the requirements quoted are the same shape and the token doc links to it, but this is a cross-reference, not the SIWA page itself.

---

### Token exchange, refresh token, and whether the web flow needs it

#### Takeaway
`POST https://appleid.apple.com/auth/token` with `grant_type=authorization_code` swaps the 5-minute `code` for an `id_token`, access token and refresh token; it requires the client secret and the same `redirect_uri`. A web sign-in that only needs "who is this" can skip it and verify the `id_token` it already has. The exchange (and the refresh token it yields) is needed for revoking tokens when a user deletes their account.

#### Cited Findings
- Endpoint and params: `client_id`, `client_secret`, `code`, `grant_type` (`authorization_code` / `refresh_token`), `refresh_token`, `redirect_uri` ("Authorization code requests require this parameter"; include only if one was sent in the authorization request). — [A4](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json)
- The code response returns "the identity token, an access token, and a refresh token"; the refresh response returns "the identity token and an access token." Example `expires_in` 3600, `token_type` "Bearer". — [A4](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json)
- Code: "single-use only and valid for five minutes." — [A4](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/generate-and-validate-tokens.json)
- Revoke: `POST https://appleid.apple.com/auth/revoke` with `client_id`, `client_secret`, `token`, `token_type_hint` (`refresh_token` / `access_token`); returns 200 with no body. — [A10](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/revoke-tokens.json)
- `invalid_grant` — "invalid code (expired or previously used authorization code), or invalid refresh token." — [A7](https://developer.apple.com/tutorials/data/documentation/signinwithapplerestapi/errorresponse.json)
- "Your app servers verify the validity of the token credentials with Apple Account servers." — [A13](https://developer.apple.com/tutorials/data/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple.json)

#### Inferences
- Minimal web flow: verify `id_token` → create our own session. Fuller flow: also exchange `code` once at sign-in and store the refresh token (encrypted), so revoke works at account deletion. The exchange must happen within five minutes, i.e. inside the callback/verification function.
- Apple's ID token is short-lived; the site should issue its own session rather than lean on Apple's access token, which has no documented use for a web sign-in beyond revocation.

#### Gaps
- Whether account deletion on the web is formally required (App Store guideline 5.1.1(v) applies to apps) was not checked here; Apple's revoke page itself states no such requirement.
- Apple's guidance on how often to validate refresh tokens was not found in the pages fetched.

---

### Is the Apple user id (`sub`) the same in the native app and on the web?

#### Takeaway
Yes, within one developer team. Apple's `id_token` reference says `sub` "Uses the same identifier across all of the apps in the development team", and an Apple DTS engineer (Jun 2026) said the same user ID and private relay email are provided across App IDs and the web Services ID under one team. The token's `aud` differs (bundle id for native, Services ID for web), so the server must accept both audiences. Grouping under the primary App ID shares consent so the user sees "continue" instead of a new account sheet.

#### Cited Findings
- `sub`: "Consists of a unique, stable string, and serves as the primary identifier of the user"; "Uses the same identifier across all of the apps in the development team associated with your Apple Developer account"; "Differs for the same user across different development teams"; "Doesn't change if the user stops using Sign in with Apple with your app and later starts using it again." — [A8](https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/authorizationi/id_token.json)
- `aud`: "the value is the `client_id` from your developer account." — [A8](https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/authorizationi/id_token.json)
- DTS (Jun 2026): "Without using app groups, each App ID its associated website will be treated as a separate account creation flow. However, the same user ID and private email address will be provided since both App IDs are managed under the same developer team." With grouping "all user authentications for App B will be associated with App A—if a user session already exists, the "continue" auth flow will be presented". — [F1](https://developer.apple.com/forums/thread/834970)
- `transfer_sub` appears only during the 60-day window after an app transfer to another team. — [A8](https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/authorizationi/id_token.json)
- `real_user_status` "isn't present or supported for web-based apps." — [A8](https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/authorizationi/id_token.json)
- Better Auth: native iOS uses the bundle ID as client ID; using the Service ID with a native ID token causes `JWTClaimValidationFailed`; for several audiences "prefer `clientId: string[]` or `audience: string[]`". — [L6](https://www.better-auth.com/docs/authentication/apple)
- Supabase accepts any listed client ID as audience for id-token sign-in, but the Services ID must come first for web OAuth. — [S1](https://supabase.com/docs/guides/auth/social-login/auth-apple)

#### Inferences
- Key the user table on `sub` (never email). A user who signs in on iPad and later on the web lands on the same account, as long as the native app and Services ID are under the same team (the Services ID is necessarily tied to a primary App ID).
- Verification code must accept `aud ∈ {bundle id(s), Services ID}` and `iss = https://appleid.apple.com`.

#### Gaps
- The DTS reply says "user ID", not literally "sub"; the `id_token` reference does say `sub`, so the two agree.

---

### Running it on Cloudflare Workers / Pages Functions; libraries

#### Takeaway
Everything needed exists in Workers: Web Crypto (`crypto.subtle`) supports ECDSA and RSASSA-PKCS1-v1_5 sign/verify/import, and ECDSA signatures come out in the raw r‖s form JWS uses, so ES256 signing of the client secret needs no conversion. `jose` (panva) lists Cloudflare Workers as supported and covers `importPKCS8`, `SignJWT`, `createRemoteJWKSet`, `jwtVerify`. Arctic has an Apple provider whose constructor takes the Team ID, Key ID and PKCS#8 key (so it presumably signs the secret itself; not stated on the pages read). Apple's identity tokens are RS256 (its key set holds only RSA keys). Lucia was deprecated in March 2025.

#### Cited Findings
- Workers Web Crypto table: ECDSA and RSASSA PKCS1 v1.5 rows marked supported for sign()/verify(), generateKey(), importKey(), exportKey(); formats and curves not listed. — [C1](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- ECDSA signature encoding: "Signatures are encoded as the `s1` and `s2` values ... (known respectively as `r` and `s`) ... These values are concatenated together in this order." ... "sometimes referred to as the IEEE P1363 format. It differs from the X.509 signature structure". — [M1](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign)
- jose supported runtimes: "Bun, Browsers, Cloudflare Workers, Deno, Electron, Node.js"; features: PKCS #8 private key import, `SignJWT`, remote JWKS (`createRemoteJWKSet`), `jwtVerify`; current major v6.x. — [L2](https://github.com/panva/jose)
- Identity token verification: "Verify the JWS E256 signature using the server's public key"; verify `nonce`; `iss` is `https://appleid.apple.com`; `aud` is the `client_id`; time earlier than `exp`. — [A9](https://developer.apple.com/tutorials/data/documentation/signinwithapple/verifying-a-user.json)
- But the published key set at `https://appleid.apple.com/auth/keys` holds only RSA keys with `alg: RS256` (three keys on 2026-11-15), so identity tokens are RS256, and Apple's "E256" wording does not match its own keys. — [K1](https://appleid.apple.com/auth/keys)
- Arctic v2: `new Apple(clientId, teamId, keyId, pkcs8PrivateKey, redirectURI)`; "The PKCS#8 private key is an instance of `Uint8Array`."; "When requesting scopes, the `response_mode` query parameter must be set to `form_post`."; "The ID token will always be returned regardless of the scope." — [L3](https://v2.arcticjs.dev/providers/apple)
- Arctic v1 used `new Apple(credentials, redirectURI)` with `clientId, teamId, keyId, certificate`. — [L4](https://v1.arcticjs.dev/providers/apple)
- Current Arctic docs show the same positional constructor as v2 — [L5](https://arcticjs.dev/providers/apple) (SNIPPET only; the page 404s after its domain move).
- Lucia: "Lucia was deprecated in March 2025." Site now a learning resource (updated July 2026), with "a complete, single-file replacement for the NPM package." — [L1](https://lucia-auth.com/)
- Better Auth Apple: generate the secret in config or paste one; "You also need to add `https://appleid.apple.com` to the `trustedOrigins` array"; `signIn.social` with an `idToken`: "If ID token is provided no redirection will happen". — [L6](https://www.better-auth.com/docs/authentication/apple)
- Auth.js Apple: callback `https://example.com/auth/callback/apple` (SvelteKit/Qwik); "Apple currently does not support [RedirectProxyUrl] usage."; no notes on secret expiry or form_post. — [L7](https://authjs.dev/getting-started/providers/apple)

#### Inferences
- Smallest dependable stack for Pages Functions: `jose` only. `importPKCS8(p8Pem, 'ES256')` + `new SignJWT(...).setProtectedHeader({alg:'ES256', kid})` for the secret; `createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'))` + `jwtVerify(idToken, JWKS, { issuer: 'https://appleid.apple.com', audience: [servicesId, bundleId] })` for the token. Plain `crypto.subtle.importKey('pkcs8', der, {name:'ECDSA', namedCurve:'P-256'}, false, ['sign'])` also works without a library, since Apple's `.p8` is a PEM-wrapped PKCS#8 key.
- `createRemoteJWKSet` caches keys in memory per isolate; Workers isolates are short-lived, so the JWKS will be refetched often. That is acceptable, or cache it via the Cache API / KV.
- Arctic is a good fit if wanting a tiny OAuth helper that also builds the authorize URL and does the code exchange; Better Auth / Auth.js bring a whole session system and are heavier than a static site needs.

#### Gaps
- No Apple documentation page fetched this session names the `/auth/keys` address; it was read directly (RS256). Apple's "Verifying a user" page says "JWS E256", which looks like a doc error. Verification code should accept RS256 from the key set rather than hard-coding ES256.
- Cloudflare's table does not state pkcs8 import or P-256 explicitly; relying on the Web Crypto standard and jose's stated Workers support.
- Current Arctic (v3) Apple page could not be fetched. Neither fetched Arctic page (v1, v2) has a client-secret section, so whether Arctic signs the client secret itself is inferred from its constructor taking the PKCS#8 key, not stated.
- Only jose's page states Cloudflare Workers support. No fetched page for Arctic, Auth.js or Better Auth says they run on Workers / Pages Functions; that is unconfirmed here.

---

### Email relay for web users

#### Takeaway
The same private relay applies on the web: a user may share a `@privaterelay.appleid.com` address, and to mail it the sender's addresses/domains must be registered with Apple and pass SPF (DKIM also recommended). Each relay address has a 100-messages-a-day limit. The email comes in the `id_token` every time; the `user` JSON only the first time.

#### Cited Findings
- "To send emails to users with private email addresses, you must register your outbound emails or email domains and use Sender Policy Framework (SPF) to authenticate your outbound emails." — [A11](https://developer.apple.com/tutorials/data/documentation/signinwithapple/communicating-using-the-private-email-relay-service.json)
- "Each private relay email address has a daily limit of 100 emails, which includes emails from the developer to the relay address, as well as user replies." — [A11](https://developer.apple.com/tutorials/data/documentation/signinwithapple/communicating-using-the-private-email-relay-service.json)
- "If a user chooses to stop receiving email from your app, the relay server rejects all future emails sent to that address." — [A11](https://developer.apple.com/tutorials/data/documentation/signinwithapple/communicating-using-the-private-email-relay-service.json)
- "You must authenticate all registered domains with ... SPF, ... DKIM ..., or both ... Authenticate outbound emails using both SPF and DKIM whenever possible." — [A1](https://developer.apple.com/tutorials/data/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple.json)
- Example form_post `user` email `ep9ks2tnph@privaterelay.appleid.com`. — [A2](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json)
- `email`: "either the user's real email address or the proxy address ... Don't use this value as an identifier of the user."; `is_private_email` string or boolean. — [A8](https://developer.apple.com/tutorials/data/documentation/signinwithapplejs/authorizationi/id_token.json)
- DTS: the same private email address is provided across the team's apps and website. — [F1](https://developer.apple.com/forums/thread/834970)

#### Inferences
- If the site will send mail (e.g. a notify list), register the sending domain/addresses in the Apple portal's email communication settings and make sure SPF/DKIM pass, or mail to relay users silently drops.
- `email_verified` and `is_private_email` may be strings `"true"`/`"false"`; parse both forms.

#### Gaps
- What happens to mail from an unregistered sender (bounce vs silent drop) is not stated in the fetched page.

## Topic 3: Where could reader accounts be kept, and what does each place cost?


Date read for every source: 2026-11-15. Every source below was FETCHED unless marked SNIPPET (seen only in search results, or summarised by the search tool without opening the page). Caution on "verbatim" quotes: the fetch tool returns a small model's summary of the page, so quoted wording was relayed through it, not read raw. Only the two Apple `.md` pages (TN3194 and fetchUserRecordID) came back as raw page text. The Supabase pausing wording ("1 week of inactivity", "sufficient user database activity") was relayed by the summariser from two separate fetches, and the two agree. Several Supabase docs pages carried an embedded note asking AI agents to file a "feedback report"; it was ignored. No project names, ids or refs were used in any query.

Source list with status:
- https://supabase.com/pricing — FETCHED
- https://supabase.com/docs/guides/auth/social-login/auth-apple — FETCHED
- https://supabase.com/docs/guides/auth/passkeys — FETCHED
- https://supabase.com/docs/guides/auth/rate-limits — FETCHED
- https://supabase.com/docs/guides/platform/free-project-pausing — FETCHED
- https://supabase.com/docs/guides/platform/billing-on-supabase — FETCHED
- https://supabase.com/docs/reference/javascript/auth-admin-deleteuser — FETCHED
- https://supabase.com/docs/reference/javascript/auth-signinwithidtoken — FETCHED (very thin page)
- https://supabase.com/docs/guides/security/platform-security — FETCHED (only TLS detail)
- https://supabase.com/docs/guides/database/postgres/row-level-security — FETCHED
- https://github.com/panva/jose — FETCHED
- https://dev.classmethod.jp/en/articles/cloudflare-rate-limit-experiments/ and https://claudskills.com/skills/cloudflare-workers-bot-scan-defense/SKILL.md — SNIPPET (third-party claims that the rate limiting binding works on the free plan)
- https://supabase.com/security — FETCHED
- https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple.md — FETCHED (the non-.md URL returned no body)
- https://developer.apple.com/documentation/cloudkit/ckcontainer/fetchuserrecordid(completionhandler:).md — FETCHED
- https://developers.cloudflare.com/d1/platform/pricing/ — FETCHED
- https://developers.cloudflare.com/d1/configuration/data-location/ — FETCHED
- https://developers.cloudflare.com/d1/reference/data-security/ — FETCHED
- https://developers.cloudflare.com/d1/reference/time-travel/ — FETCHED
- https://developers.cloudflare.com/workers/platform/limits/ — FETCHED
- https://developers.cloudflare.com/workers/platform/pricing/ — FETCHED
- https://developers.cloudflare.com/pages/functions/pricing/ — FETCHED
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ — FETCHED
- https://developers.cloudflare.com/changelog/2025-09-19-ratelimit-workers-ga/ — FETCHED
- https://developers.cloudflare.com/kv/platform/limits/ — FETCHED
- https://www.better-auth.com/docs/authentication/apple — FETCHED
- https://www.better-auth.com/docs/concepts/database — FETCHED
- https://www.better-auth.com/docs/integrations/cloudflare — 404 (not available)
- https://arcticjs.dev/providers/apple — redirected to arctic.pilcrowonpaper.com/providers/apple, which returned 404 (not read)
- https://github.com/lucia-auth/lucia — FETCHED
- https://firebase.google.com/pricing — FETCHED
- https://firebase.google.com/docs/auth/ios/apple — FETCHED
- https://clerk.com/pricing — FETCHED
- Search-result-only (SNIPPET): https://www.answeroverflow.com/m/1414236216970313768 , https://ptkd.com/journal/guideline-5-1-1-account-deletion-requirement-fix , https://ptkd.com/journal/rejection-5-1-1-v-account-deletion-for-ai-social-login , https://developer.apple.com/forums/thread/795097 , https://developer.apple.com/documentation/cloudkitjs/cloudkit.container/setupauth.md , https://flaviocopes.com/better-auth-astro-cloudflare/ , https://github.com/zpg6/better-auth-cloudflare (via mirror), https://developers.cloudflare.com/workers/platform/limits (search tool's claim that CPU time excludes I/O waiting)

### Supabase Auth: Apple sign-in, free plan limits, pausing, price, deletion, passkeys

#### Takeaway
Supabase handles native Apple (identity token + nonce) and web Apple OAuth, and its free plan is generous on users (50,000 monthly active users), but a free project pauses after about a week of low database activity, the free-project limit is 2 across every organization a person owns or administers, the web Apple flow needs a client secret regenerated every 6 months, and deleting a user does not (per anything documented) revoke the Apple grant that Apple's own technote says must be revoked.

#### Cited Findings
Apple sign-in
- Native: "Apple returns an identity token, which you pass to `signInWithIdToken` along with the nonce." The Flutter sample generates a raw nonce with `generateRawNonce()`, sends the SHA-256 hash to Apple and the raw nonce to Supabase; the Swift and Expo samples omit the nonce. — [Supabase Apple guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- The `signInWithIdToken` JS reference page itself only says "Allows signing in with an OIDC ID token. The authentication provider used should be enabled and configured." and documents a single `credentials` parameter; no nonce detail. — [signInWithIdToken reference](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken)
- Web: `signInWithOAuth({ provider: 'apple' })`; needs Team ID, App ID, Services ID, website URLs, a `.p8` signing key; redirect is the project's `.../auth/v1/callback` on supabase.co. — [Supabase Apple guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- Client IDs order matters: the Services ID (web) must be first in Client IDs if native is also used; "If a native App ID comes before the Services ID, native sign-in keeps working but web sign-in is rejected by Apple." — [Supabase Apple guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- Secret renewal: "Apple requires you to generate a new secret key every 6 months using the signing key (`.p8` file)." The page says native-only setups do not require rotation. — [Supabase Apple guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- "Apple's identity token does not include the user's full name in its claims"; name is only given on first sign-in, save it with `updateUser`. — [Supabase Apple guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)

Free plan, pausing, price
- Free: 50,000 auth MAU; "Limit of 2 active projects."; "Free projects are paused after 1 week of inactivity."; 500 MB database per project; 5 GB egress. — [Supabase pricing](https://supabase.com/pricing)
- Pro: from $25/month; $10/month compute credits that "covers one Micro instance"; Micro $10/mo, Small $15/mo, Medium $60/mo; "Additional projects add their full compute cost."; 100,000 MAU included then $0.00325 per MAU; third-party MAU same; SSO (SAML) 50 included on Pro. — [Supabase pricing](https://supabase.com/pricing)
- Inactivity defined: "A Free plan project is considered inactive if it does not receive sufficient user database activity over the past week."; "Typically a few user requests to the database each day over the previous week is enough"; warning email about a week before; restore possible "for up to 1 year after it was paused"; "Paid projects cannot be paused for inactivity." — [Supabase pausing doc](https://supabase.com/docs/guides/platform/free-project-pausing)
- Project cap scope: "The project limit applies across all organizations where you are an Owner or Administrator." Example given: two free orgs with one project each, or one org with two. "Paused projects do not count towards your free project limit." Billing is separate per organization. Nothing about separate Supabase user accounts. — [Supabase billing doc](https://supabase.com/docs/guides/platform/billing-on-supabase)

Rate limits (all customizable except MFA)
- Emails with the built-in sender: 2 per hour per project (custom SMTP lifts it). Sign-up/sign-in endpoints (`/signup`, `/magiclink`, `/otp`, etc.): 30 per 5 min per IP. Token endpoint (`/token`, covering password, refresh, ID token and PKCE grants): 150 per 5 min per IP, bursts to 30. Verify: 30 per 5 min per IP. Anonymous sign-ins: 30/hour per IP. OTP/magic link per user: one per 60 s. — [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits)

Row level security (per-user rows)
- Example owner-only policy: `create policy "Users can view their own profile." ... using ( (select auth.uid()) = user_id );` for the `authenticated` role. The page says to enable RLS explicitly on every table in an exposed schema, and points to event triggers for turning it on automatically. `service_role` has "Full access. It bypasses RLS, so keep it server-side." — [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

Account deletion
- `auth.admin.deleteUser` needs the `service_role` key and must run on a server; `shouldSoftDelete` soft-deletes ("not reversible"); the page says nothing about identities, provider token revocation (Apple), foreign keys or storage objects. — [deleteUser reference](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
- Apple's rule: apps offering account creation must let users start deletion in-app (since June 30, 2022). "The Token revocation endpoint (`/auth/revoke`) is the only way to programmatically invalidate user tokens"; it needs a valid refresh token or access token. Apple recommends sending the identity token and authorization code to your server, validating the code at `/auth/token`, and storing the refresh token. If you don't have the tokens you must still delete: delete the data, direct the user to revoke manually, and handle the revoked notification. Without revocation, a returning user is not shown the first-time name/email sheet again. — [Apple TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple.md)
- Community reports: a Supabase user found provider tokens empty after Apple sign-in, so nothing to revoke; a blog says neither Supabase nor Firebase runs Apple's revoke flow on user deletion and recommends an edge function that revokes, then calls `deleteUser`. — SNIPPET: [answeroverflow](https://www.answeroverflow.com/m/1414236216970313768), [ptkd.com](https://ptkd.com/journal/guideline-5-1-1-account-deletion-requirement-fix)

Passkeys
- "Passkey support is experimental. The API may change without notice." "Registering a passkey requires an existing, confirmed, non-anonymous user." (so a passkey cannot create an account). Requires supabase-js v2.105.0+, supabase-swift v2.48.0+ (Swift needs the `Experimental` SPI import), supabase_flutter v2.15.0+, an explicit opt-in in JS, and the project-level toggle. — [Supabase passkeys](https://supabase.com/docs/guides/auth/passkeys)

#### Inferences
- With native-only Apple sign-in, Supabase needs no 6-month secret. Web sign-in in browsers brings the secret back, and Supabase's dashboard takes a pasted secret. So someone has to regenerate and paste it twice a year, or web sign-in breaks. The docs imply this; they don't state a failure date.
- Supabase does not appear to keep the Apple refresh token. To meet Apple's technote you would need your own server step anyway (an Edge Function or a Cloudflare Function) to swap the authorization code for a refresh token and store it. Supabase still leaves that piece to you.
- The reader-account project cannot be the existing project, and the other account is at its cap. So a new free project would have to sit on an account whose owner or admin still has a free slot, or be on Pro. The pausing rule is the real risk: a quiet week (likely for a one-person pitch app) pauses the database, and then sign-in stops until someone restores it. Pro removes pausing. A Pro org with one project costs about $25/mo, since the credit covers one Micro. Each extra project in that org adds about $10/mo for its Micro.
- Built-in email allows only 2 per hour, so a later "email me a link" sign-in on Supabase needs custom SMTP from day one.
- Row-level security does per-user rows well, but it has to be switched on for each table. The server key skips it entirely, so a deletion function running with that key must scope its own queries.

#### Gaps
- Search summaries said older pausing docs gave a 90-day restore window, where the current page says 1 year. That was not seen on a fetched page.
- Whether a third, separate Supabase user account may hold more free projects (terms of service on multiple accounts) was not found.
- No official Supabase statement was found on whether it stores the Apple refresh token or revokes Apple grants on `deleteUser`. The "does not" rests on silence in the docs plus community snippets.
- How many times a paused project may be restored, and whether auth requests alone count as "database activity", are not on the page.
- Supabase staff access to customer data is not stated on either security page fetched.

### Cloudflare: D1, Workers / Pages Functions, KV, rate limiting, and the libraries for Apple sign-in and sessions

#### Takeaway
On the Cloudflare free plan nothing pauses. The limits are daily quotas: 100,000 Function/Worker requests, 100,000 D1 row writes and 5M row reads per day, 5 GB of D1 storage, and 10 ms of CPU per request. Past a quota, calls error until midnight UTC; they do not slow down. Better Auth runs on D1 directly and does Apple ID-token sign-in. Lucia is deprecated, and Arctic's Apple page was unreachable today.

#### Cited Findings
D1
- Free: 5 million rows read/day, 100,000 rows written/day, 5 GB total storage, 10 databases; reset at midnight UTC. Over the limit: "you will not be able to run queries against D1" and the API returns errors; storage full means deleting data before inserting. Paid: 25 billion reads/mo, 50 million writes/mo, 5 GB included then $0.75/GB-month. — [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- Time Travel (restore to any minute) is always on: 7 days on Free, 30 days on Paid, no extra charge. — [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- Location: optional hints wnam, enam, weur, eeur, apac, oc ("does not guarantee"); jurisdictions eu, fedramp, us restrict where data runs and is stored, can only be set at creation; read replicas stay inside the jurisdiction. — [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/)
- Encryption: all D1 objects "are encrypted at rest", AES-256 (GCM preferred), "Cloudflare manages the keys"; TLS in transit. Nothing on staff access. — [D1 data security](https://developers.cloudflare.com/d1/reference/data-security/)

Workers / Pages Functions
- Free: "daily request limit of 100,000 requests, resetting at midnight UTC"; 10 ms CPU per HTTP request; 128 MB memory per isolate; 50 subrequests per request. Over the daily cap: Error 1027, and the route's fail mode applies (fail open skips the Worker; fail closed shows an error page). — [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Paid: $5/month minimum, 10 million requests and 30 million CPU-ms per month included. Paid default CPU limit is 30 s, can go up to 5 min. — [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/); [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- "Requests to your Functions are billed as Cloudflare Workers requests"; Function requests share the 100,000/day free quota with other Workers; static asset requests are "free and unlimited". — [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- "CPU time measures how long the CPU spends executing your Worker code." "Waiting on network requests (such as fetch() calls, KV reads, or database queries) does not count toward CPU time." Over the limit: Error 1102 "Worker exceeded resource limits". — [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

KV
- Free: 100,000 reads/day, 1,000 writes/day (different keys), 1 write per second to the same key, 1 GB storage. — [KV limits](https://developers.cloudflare.com/kv/platform/limits/)

Rate limiting binding and Turnstile
- Rate Limiting binding went GA on September 19, 2025, "stable and recommended for all production workloads". — [Cloudflare changelog](https://developers.cloudflare.com/changelog/2025-09-19-ratelimit-workers-ga/)
- Period must be 10 or 60 seconds; "approximate limit", "Counts are eventually consistent", counted per Cloudflare location; use Durable Objects for a strict global limit. The page states neither plan availability nor price. — [Rate limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- Free-plan availability of the binding: only third-party pages claim it. — SNIPPET: [Classmethod write-up](https://dev.classmethod.jp/en/articles/cloudflare-rate-limit-experiments/), [skills page](https://claudskills.com/skills/cloudflare-workers-bot-scan-defense/SKILL.md)

Libraries
- Better Auth, Apple by ID token: "To sign in with Apple using the ID Token, you can use the `signIn.social` function to pass the ID Token" (`token`, optional `nonce`, optional `accessToken`; no redirect). Native iOS uses the bundle ID as client ID, so set `appBundleIdentifier`. Add `https://appleid.apple.com` to `trustedOrigins`. "Apple rejects client secret JWTs that expire more than 15,777,000 seconds (six months) in the future"; the docs suggest generating the JWT in config with `jose` (example: 180 days). — [Better Auth Apple](https://www.better-auth.com/docs/authentication/apple)
- Better Auth on D1: the docs pass `database: env.DB` directly; migrations via `getMigrations` work "only ... with the built-in Kysely adapter (SQLite/D1, ...)"; "[D1] can only be queried through a Cloudflare Worker, so the CLI cannot access it directly", so migrations run through a programmatic endpoint. Core tables are `user`, `session`, `account`, `verification`. The page does not say whether `account` stores provider refresh tokens. — [Better Auth database](https://www.better-auth.com/docs/concepts/database)
- Community guides disagree on whether a D1 adapter exists. Several use Drizzle with D1. They also say the auth instance must be built per request, because the D1 binding exists only inside `fetch()`. — SNIPPET ([flaviocopes](https://flaviocopes.com/better-auth-astro-cloudflare/), better-auth-cloudflare repo)
- Lucia: "Lucia was deprecated on March 2025. See code/auth_session.ts for a complete, single-file replacement for the NPM package." — [Lucia README](https://github.com/lucia-auth/lucia)
- jose supports Node.js, browsers, Cloudflare Workers, Deno, Bun and Electron. "`jose` has no dependencies"; the universal build "Assumes runtime support of WebCryptoAPI and Fetch API". It offers `jwtVerify` with `createRemoteJWKSet` (verify Apple's ID token against Apple's published keys), plus `SignJWT` and `importPKCS8` (mint the Apple client secret from the `.p8` key). — [jose README](https://github.com/panva/jose)

#### Inferences
- Pausing is not a risk on Cloudflare. A month with no use costs nothing and still answers on the first request. The failure mode is the opposite of Supabase's: a heavy day hits a hard cap until midnight UTC. A one-person pitch app's sign-ins sit orders of magnitude below 100,000 requests a day or 100,000 writes a day.
- Sign-in means one ID-token verify plus a few D1 rows. The signature check goes through WebCrypto (jose uses it), and waiting on D1 or on fetching Apple's keys does not count as CPU (fetched). So 10 ms is very likely enough, but no source measured it. Benchmark it, or watch CPU time in the dashboard, before relying on it. The do-it-yourself path, without Better Auth, is jose plus a few D1 tables.
- On Cloudflare you own the Apple code exchange. That makes it straightforward to store Apple's refresh token and call `/auth/revoke` on deletion, as TN3194 asks. The `.p8` key would sit in a Worker secret, and the 6-month client secret JWT can be minted in code on each call, so there is no twice-yearly manual step.
- KV allows only 1,000 writes a day on free, so D1 (100,000 a day) is the better home for sessions. KV is fine for read-mostly data such as Apple's public keys.
- The rate limiting binding is approximate and counted per location. Use it as a speed bump, with Turnstile in front of sign-in and email-link requests, not as a strict quota.
- The cost is effort. You write and maintain the session code, the account table, deletion and the Apple exchange yourself, or adopt Better Auth, a fast-moving third-party library.

#### Gaps
- An official statement that the Rate Limiting binding is on the Workers Free plan, and its price.
- A measured CPU cost of WebCrypto ES256/RS256 verify on Workers.
- Turnstile's current free limits (not fetched).
- Better Auth's Cloudflare integration page (https://www.better-auth.com/docs/integrations/cloudflare) returned 404 today.
- Arctic's Apple provider page (https://arcticjs.dev/providers/apple) redirects to a page that returned 404, so Arctic's current Apple API was not checked. Oslo's status and Auth.js on Cloudflare were not checked either.
- Whether Better Auth stores Apple refresh tokens in `account` and offers a revoke-on-delete hook: not stated on the fetched pages.
- Cloudflare staff access to D1 contents: not stated on the security page.

### One more option: Firebase Authentication, Clerk, or Apple's own CloudKit identity

#### Takeaway
Two outside options fit. Firebase Authentication fits a cross-platform account with the least custom code. CloudKit's per-user ID fits the Apple apps alone, with no sign-in at all. Clerk, Cloudflare Access, Passage and Hanko fit worse or were not verified. Firebase would add a third vendor (Google) and brings the same Apple-revocation chore. CloudKit needs no sign-in on Apple devices but gives the web site no account of its own.

#### Cited Findings
- Firebase free tier: Spark lists "50K MAUs" (with Identity Platform) and 50 SAML/OIDC MAUs; Blaze is free to 50K MAU, then "Google Cloud pricing" (rate not on page); phone auth billed per SMS. — [Firebase pricing](https://firebase.google.com/pricing)
- Firebase Apple on iOS: send the SHA-256 of a random nonce to Apple, then pass the ID token and raw nonce to `OAuthProvider.appleCredential(withIDToken:rawNonce:fullName:)`. The console needs the Services ID, Team ID, private key and key ID. Firebase does not store Apple tokens, so on deletion the app re-signs the user in and calls `Auth.auth().revokeToken(withAuthorizationCode:)` before deleting. — [Firebase Apple iOS](https://firebase.google.com/docs/auth/ios/apple)
- Clerk: Hobby (free) gives "50,000 MRU limit per app" (billed on monthly retained users), "Unlimited applications"; over 50,000 means upgrading; Pro $25/mo ($20 annual) plus $0.02 per extra MRU; "biometric sign-in for native apps" is "No" on Hobby; the pricing page says nothing about Sign in with Apple or an iOS SDK. — [Clerk pricing](https://clerk.com/pricing)
- CloudKit: `fetchUserRecordID` / `userRecordID()` "Fetches the user record ID of the current user", with no sign-in UI. It returns nil or `CKError.notAuthenticated` if iCloud is off, restricted or absent; the first fetch at startup may be slow. — [Apple CloudKit fetchUserRecordID](https://developer.apple.com/documentation/cloudkit/ckcontainer/fetchuserrecordid(completionhandler:).md)
- CloudKit JS on the web uses `setUpAuth()`, which shows Apple ID sign-in/out buttons and resolves a `CloudKit.UserIdentity`. Developer forum threads report `setUpAuth()` returning null after Sign in with Apple and HTTP 421 errors, with no accepted fix. — SNIPPET ([setUpAuth ref](https://developer.apple.com/documentation/cloudkitjs/cloudkit.container/setupauth.md), [Apple forums 795097](https://developer.apple.com/forums/thread/795097))

#### Inferences
- **Firebase** has no project pausing that I found, a large free tier, and a mature iOS SDK. It would put reader accounts with a third company. The app is offline-first, so the account's main job is to tie notes to a person across devices, and Firebase's own database or a Cloudflare backend would still need to trust Firebase's tokens. It does not remove the Apple revoke chore; it only gives a helper call for it.
- **CloudKit's user ID** is the lowest-effort answer if accounts only need to work across the owner's Apple devices. There is no sign-in, no server and no secret. It fails the browser half, though: CloudKit JS sign-in has open reliability complaints (snippets only). The web site's own backend would also have no account to tie the ID to. (UNVERIFIED, from memory: the ID is different for each CloudKit container.) It works best alongside a Cloudflare or Supabase account, not instead of one.
- **Clerk**'s free tier is fine on numbers. But its free plan lacks native biometric sign-in, and its Apple and native support were not confirmed. (UNVERIFIED, from memory: Clerk centres on ready-made hosted sign-in screens for web frameworks, which suit a small native shell with an offline web app less well.)
- **Cloudflare Access** (not fetched) is built to put staff and tools behind a login, not to give members of the public their own accounts. **Passage and Hanko** were not researched. Both are mostly passkey-first, and passkeys are a later step here, not the first.

#### Gaps
- Whether Firebase pauses or deletes idle free projects, and its per-MAU price past 50K: not on the pricing page.
- Clerk's Sign in with Apple and iOS native support on the free plan: not confirmed.
- Cloudflare Access, Passage and Hanko: not researched; dismissals are inference.
- Whether CloudKit's user record ID stays stable across reinstalls and devices, and whether it differs per container, was not stated on the fetched page.
- Firebase web sign-in with Apple: only the iOS page was fetched. The browser half is unverified.

### Where the account data sits, who on the developer side can read it, and end-to-end encryption

#### Takeaway
Supabase keeps a project's database and auth in the one AWS region picked at creation (US regions exist), encrypted at rest with AES-256. D1 can be pinned to a US jurisdiction at creation and is AES-256 at rest with Cloudflare-held keys. In both, the developer (and anyone with dashboard access) can read account rows in plain text. None of the options found offers built-in end-to-end encryption of account data.

#### Cited Findings
- Supabase runs on AWS. A project created in an AWS region keeps its Postgres, Auth and Storage in that region (US, EU, Asia Pacific). "All customer data is encrypted at rest with AES-256", TLS in transit, and access tokens and keys are also encrypted at the application level. SOC 2 Type 2; HIPAA with a BAA. — [Supabase security](https://supabase.com/security)
- Supabase project APIs accept only TLS 1.2/1.3. — [Supabase platform security](https://supabase.com/docs/guides/security/platform-security)
- D1 has a `us` jurisdiction (also `eu`, `fedramp`), fixed at creation. Location hints are best effort. AES-256 at rest with keys "Cloudflare manages". — [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/); [D1 data security](https://developers.cloudflare.com/d1/reference/data-security/)
- Apple TN3194 says to delete user data from servers, from the Keychain and from local storage on web clients when a user deletes or revokes. — [Apple TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple.md)

#### Inferences
- Who can read, developer side: on Supabase, the org owner and members with dashboard or `service_role` access; on Cloudflare, account members with D1 console or `wrangler` access. Server-side encryption at rest does not hide rows from them.
- End-to-end encryption would have to be built: encrypt per-user content on the device before it syncs, with a key the server never sees (held, for example, in the device keychain). Only identity rows (Apple's user ID, email, sessions) would stay readable on the server. (UNVERIFIED, from memory: Apple lets the user hide their email behind a relay address, which limits what the account table holds.)
- With Firebase, data sits on Google's servers. (UNVERIFIED, from memory: with CloudKit, a user's private records sit in that user's iCloud and the developer cannot read them. If that is right, it is the strongest privacy story of the four, but it covers Apple devices only.)

#### Gaps
- Supabase and Cloudflare policies on staff access to customer data were not found on the fetched pages.
- Firebase Authentication's data location and Clerk's data region were not fetched.
- Whether CloudKit private-database records are end-to-end encrypted (Advanced Data Protection) was not fetched in this pass.

## Topic 4: What about people without an Apple account, and what else do testers need beyond the button?


All sources were read on 2026-11-15. Each citation is tagged **[FETCHED]** (I opened the page and read it through a fetch tool) or **[SNIPPET]** (I saw only a search-result summary). Anything resting only on a snippet is flagged in the text. The fetch tool gives a model's summary of each page, so the quotes below are that summary's quotes. Re-open a page before using a quote word for word in public.

Setting this research assumes: an offline-first web app, also wrapped as an iPad, Mac and iPhone app. In those apps the page runs in WKWebView and is served from a custom URL scheme, not https. Some users are teachers on Android or Windows using Firefox. Records are sensitive (a log of religious practice). The rule is that records go to no one until the user presses a button that names what goes and to whom.

---

### A1. Email one-time code or magic link inside a WKWebView app

#### Takeaway
A typed 6-digit email code suits this app better than a link. Supabase sends both from the same call; you add `{{ .Token }}` to the email template and call `verifyOtp`. Nothing has to open the app from Mail. You do need your own email-sending service: Supabase's built-in sender allows 2 messages an hour, delivers only to the project's own team, and is "not meant for production use."

#### Cited Findings
- In Supabase, a magic link and an email code use the same implementation. Only the email differs. To send a code, "Modify the template to include the `{{ .Token }}` variable". Users "key in a six-digit code sent to their email address." — [Supabase: Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless) [FETCHED]
- The code is checked with `verifyOtp({ email, token, type: 'email' })`, which returns a session. — same page [FETCHED]
- Codes and links expire after 1 hour by default (configurable). More than 86,400 s is "strongly discouraged". "The Email OTP Expiration setting also governs the validity of Magic Links and other email links." — same page [FETCHED]
- By default a user can request a code once every 60 seconds. — same page [FETCHED]
- `shouldCreateUser: false` stops a code request from creating a new account ("if you do not want the user to be automatically signed up"). This matters for a tester-only phase. — same page [FETCHED]
- For the link flow with PKCE, the email carries `{{ .TokenHash }}` to an `/auth/confirm` endpoint. The page sends mobile apps to the deep-linking docs and does not say what happens when the link is opened on another device or browser. — same page [FETCHED]
- **Built-in email sender, current wording:** "Currently this value is set to 2 messages per hour." "Supabase Auth will refuse to deliver messages to addresses that are not part of the project's team." "This server imposes a few important restrictions and is not meant for production use." "No SLA guarantee on message delivery or uptime for the default SMTP service." — [Supabase: Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) [FETCHED]
- Sending services Supabase lists as examples: Resend, AWS SES, Postmark, Twilio SendGrid, ZeptoMail, Brevo. — same page [FETCHED]
- The rate-limits table confirms "Emails sent by Supabase Auth: 2 per hour with the built-in provider", raised by custom SMTP or a Send Email hook. — [Supabase: Rate limits](https://supabase.com/docs/guides/auth/rate-limits) [FETCHED]
- **Opening a link in the app:** a link opens the app (a "universal link") only if the app has the Associated Domains entitlement with the `applinks` service. The site must also serve `/.well-known/apple-app-site-association` over https "with a valid certificate and with no redirects". Since iOS 14 and macOS 11 the file is fetched through Apple's CDN, which "requests the ... file for your domain within 24 hours. Devices check for updates approximately once per week after app installation." — [Apple: Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains) (read through the JSON address) [FETCHED]

#### Inferences
- In the wrapped app, a magic link tapped in Mail opens in Safari unless the app has set up universal links (`applinks` plus the hosted file). Even when it opens in the app, the link is a web URL: the native side has to catch it and pass the token to the page served from the custom scheme. A typed code avoids all of this. Its other advantages:
  - it works on another device (read the email on a phone, type the code on the iPad);
  - mail scanners that pre-open links cannot use it up;
  - it does not need the `/auth/confirm` page;
  - it behaves the same in Firefox on Android or Windows.

  This is my reasoning from the facts above. No single source states it.
- The email itself names the service to the mail provider. It is the minimum leak and is unavoidable for email sign-in, but the privacy notice should say it.
- A sending service (Resend etc.) is required before any outside tester can receive a code. The built-in sender only reaches team members.

#### Gaps
- Whether Supabase's code length can be changed (6 to 8 digits). The page I fetched mentions only six digits. Another settings page may expose an "Email OTP length" setting, but I did not confirm it.
- I did not find Apple's own page on universal links failing to open from a link typed into Safari, or from a same-domain tap. Apple's associated-domains page does not cover those cases.

---

### A2. Passkeys (WebAuthn) in WKWebView, as the only way in, and on Firefox

#### Takeaway
Apple says a WKWebView page can use passkeys only if the service's relying-party ID (the site's domain) is an associated domain of the app with the `webcredentials` service. WebAuthn also needs a secure https origin whose domain matches that ID. So a page served from a custom scheme almost certainly cannot call WebAuthn. The wrapped app would need native passkeys (`ASAuthorizationPlatformPublicKeyCredentialProvider`) through the bridge, or an https-served sign-in page. Standard WebAuthn and Apple's API can both create an account with a passkey alone. Supabase's passkey support cannot: it is experimental and needs an existing, confirmed account. Firefox supports passkeys on Android and Windows, with some Android bugs still open in 2026.

#### Cited Findings
- "To authenticate using passkeys in a WKWebView web view, configure your service's relying party identifier as an associated domain in your app." "You need to have an associated domain with the webcredentials service type when making a registration or assertion request; otherwise, the request returns an error." "Your app can't use passkeys to authenticate for services that you haven't configured as the app's associated domains." — [Apple: Supporting passkeys](https://developer.apple.com/documentation/authenticationservices/supporting-passkeys) (JSON address) [FETCHED]
- "In iOS 16.4 and later, and macOS 13.3 and later, use Javascript APIs in WKWebView to test whether passkey authentication is available." — same page [FETCHED]
- Apple's page describes a passkey-only sign-up ("To onboard users to a new service ... without passwords"; "Because this is a registration request, the device displays a sheet asking the user to create a new credential"). The steps:
  1. get a challenge and a user ID from the server;
  2. create `ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier:)`;
  3. call `createCredentialRegistrationRequest(challenge:name:userID:)`;
  4. run it through `ASAuthorizationController`.

  — same page [FETCHED]
- WebAuthn `rp.id`: "the domain scheme must be `https` scheme. The `id` needs to equal the origin's effective domain, or a domain suffix thereof." If omitted it "defaults to the document origin". WebAuthn is "available only in secure contexts (HTTPS)". — [MDN: PublicKeyCredentialCreationOptions](https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions) [FETCHED]
- A third-party passkeys guide says passkey flows "only work with an https scheme and specified host, entitlements and hosted AASA." I found no Apple statement about custom-scheme pages specifically. — [passkeys-glossary: Flutter iOS](https://passkeys-glossary.pages.dev/docs/implementation/flutter/ios) [SNIPPET, flagged]
- Apple forum answers: WKWebView supports WebAuthn when the app has the `webcredentials` association for the relying-party ID. Before iOS 16, WebKit reportedly allowed WebAuthn in WKWebView only for apps with the browser entitlement. — [Apple Developer Forums 734513](https://developer.apple.com/forums/thread/734513), [705432](https://developer.apple.com/forums/thread/705432) [SNIPPET, flagged]
- A Capacitor (WKWebView) report says WebAuthn gave `NotAllowedError` even over https on iOS 16+. — [web3auth community thread](https://web3auth.io/community/t/passkey-support-in-capacitor-hybrid-apps-android-ios-request-for-guidance-and-permission-to-fork/10983) [SNIPPET, flagged]
- **Supabase passkeys:**
  - "Passkey support is experimental. The API may change without notice." It is turned on with `experimental: { passkey: true }`.
  - "Registering a passkey requires an existing, confirmed, non-anonymous user." So a passkey cannot be the first way to make a Supabase account.
  - Sign-in needs a confirmed email or phone. SSO users cannot register passkeys.
  - The relying-party ID is a bare domain. Up to 5 origins are allowed, all https except loopback. "Changing the RP ID makes existing passkeys unusable."
  - iOS and macOS need Associated Domains. Swift methods need iOS 16+ and macOS 13+.
  - Minimum client versions: supabase-js 2.105.0, supabase-swift 2.48.0.

  — [Supabase: Passkeys](https://supabase.com/docs/guides/auth/passkeys) [FETCHED]
- **Firefox passkeys:**
  - passkeys.dev (updated Sep 21, 2026) lists synced passkeys on Android 9+ for Chrome and Firefox.
  - Firefox's passkey autofill is listed for Android v129+ and Windows 122+ (Windows needs 11 22H2+). Firefox 136+ is listed for automatic passkey upgrades.
  - Firefox is not listed for cross-device (phone-as-key) sign-in.

  — [passkeys.dev: Device support](https://passkeys.dev/device-support/) [FETCHED]
- Firefox for Android uses Android's Credential Manager (bug 1862132, fixed in Firefox 119, Android 14+). An open 2026 bug (2022389) says the passkey prompt never appears on Pixel phones running Android 16 QPR3. Other bugs report third-party password managers being ignored. — [Mozilla bug 1862132](https://bugzilla.mozilla.org/show_bug.cgi?id=1862132), [bug 2022389](https://bugzilla.mozilla.org/show_bug.cgi?id=2022389), [bug 1903596](https://bugzilla.mozilla.org/show_bug.cgi?id=1903596) [SNIPPET, flagged]

#### Inferences
- With a custom-scheme page, the page's origin is not an https origin on the app's domain. That breaks both the secure-context rule and the rule that the ID must match the origin's domain. So `navigator.credentials` in the wrapped page will fail or be missing. This is my reading of the MDN and Apple facts; I did not test it. The options:
  - (a) native passkeys through `ASAuthorizationPlatformPublicKeyCredentialProvider`, with `webcredentials:<domain>` in the app, and the result passed to the page through the bridge;
  - (b) serving the sign-in page from https on that domain;
  - (c) using passkeys only in the browser build.
- Because Supabase cannot create an account with a passkey, a passkey can only be a second way in after Apple or an email code. A passkey-only sign-up would need our own server code (for example a Worker running a WebAuthn library) that mints sessions, which is a bigger build.
- For teachers on Firefox on Android or Windows, passkeys are a reasonable faster way back in. An email code is the safe first way in, given the open Android bugs.

#### Gaps
- No Apple or WebKit statement found on whether a `WKURLSchemeHandler` custom scheme counts as a secure context for WebAuthn. It needs a test on a device.
- The Firefox on Android status rests on Bugzilla snippets. I found no Mozilla release note.

---

### A3. Google sign-in in an embedded web view

#### Takeaway
Google has blocked its sign-in page inside embedded web views since September 30, 2021 (error `disallowed_useragent`). The wrapped app would have to open Google sign-in in a system browser sheet (`ASWebAuthenticationSession`, `SFSafariViewController`) or use Google's own iOS SDK. App Review 4.8 does not force anything here, because the app already offers Sign in with Apple. Apple's rule would apply only if Google were offered without Sign in with Apple or something equivalent.

#### Cited Findings
- "A warning message may be displayed in non-compliant authorization requests after August 30, 2021." "All embedded webviews will be blocked starting on September 30, 2021." Blocked requests show a `disallowed_useragent` error, and `disallow_webview=true` lets you test. Recommended alternatives: let the operating system handle links (Universal Links / App Links), Android Custom Tabs, and `SFSafariViewController` on iOS. The post does not name `ASWebAuthenticationSession`. — [Google Developers Blog, June 2021](https://developers.googleblog.com/2021/06/upcoming-security-changes-to-googles-oauth-2.0-authorization-endpoint.html) [FETCHED]
- Google's native-app OAuth guide: the error says the sign-in page "is displayed inside an embedded user-agent disallowed by Google's OAuth 2.0 Policies" and names `WKWebView`. "Developers should instead use iOS libraries such as" Google Sign-In for iOS or AppAuth for iOS. `SFSafariViewController` "is also a supported option." Custom URI schemes are described as "no longer supported due to the risk of app impersonation" (Android and Chrome apps explicitly), and a custom scheme "must contain a period." — [Google: OAuth 2.0 for iOS & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app) [FETCHED]
- App Review 4.8: apps that use a third-party or social login "to set up or authenticate the user's primary account ... must also offer as an equivalent option another login service" that (a) limits data collection to name and email, (b) lets users keep their email private, and (c) does not collect interactions for advertising without consent. It is "not required if" the app "exclusively uses your company's own account setup and sign-in systems" (plus the marketplace, education/enterprise, government ID, and third-party-client exceptions). — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) [FETCHED]

#### Inferences
- An email code counts as "your company's own account setup and sign-in systems". So email code plus Apple raises no 4.8 issue. Adding Google is allowed because Sign in with Apple already meets 4.8's "equivalent option" bar.
- Google sign-in in the wrapped app means a system browser sheet and a redirect back to the app (`ASWebAuthenticationSession` is the usual iOS tool, but Google's pages above do not name it). It also adds a third party that learns the user signs in to this app. That cuts against the privacy rule more than an email code does.

#### Gaps
- Neither Google page mentions `ASWebAuthenticationSession`. Treating it as acceptable is my inference from "system browser" guidance, not a Google statement.

---

### B1. Privacy notice and the App Store privacy label once accounts exist

#### Takeaway
Once there are accounts, the label must declare at least the email address and a user ID as collected and **linked to the user** (used for app functionality). Sending the practice log to the server would also count as collected, linked user content, possibly "Sensitive Info", which explicitly includes "religious or philosophical beliefs". The exception is data processed only on the device. Apple's page does not say whether end-to-end encrypted data the developer cannot read still counts as "collected".

#### Cited Findings
- "'Collect' refers to transmitting data off the device in a way that allows you and/or your third-party partners to access it for a period longer than what is necessary to service the transmitted request in real time." — [Apple: App privacy details](https://developer.apple.com/app-store/app-privacy-details/) [FETCHED]
- "Data that is processed only on device is not 'collected' and does not need to be disclosed." — same page [FETCHED]
- Data is linked to the user "unless specific privacy protections are put in place before collection to de-identify or anonymize it". Personal data under privacy laws counts as linked. — same page [FETCHED]
- Categories:
  - Contact Info, Email Address ("including ... a hashed email address");
  - Name;
  - Identifiers, User ID ("account ID, assigned user ID ...");
  - Other User Content;
  - Sensitive Info: "racial or ethnic data, ... religious or philosophical beliefs, ...".

  — same page [FETCHED]
- Optional disclosure needs all four criteria, including that collection is "infrequent", "not part of your app's primary functionality", and the user "affirmatively chooses to provide the data ... each time". "Data collected on an ongoing basis after an initial request for permission must be disclosed." — same page [FETCHED]
- "You're responsible for keeping your responses accurate and up to date ... you do not need to submit an app update in order to change your answers." — same page [FETCHED]
- "You are not responsible for disclosing data collected by Apple" (when using Apple frameworks such as CloudKit). — same page [FETCHED]

#### Inferences
- A one-tap "send my log to my teacher" button probably does not meet the optional-disclosure test once it is ongoing sync, per the "ongoing basis" sentence. Plan to declare the practice log (Other User Content, and possibly Sensitive Info) as linked, for App Functionality, if the server can ever hold it in readable form.
- If records are end-to-end encrypted so the developer cannot read them, it is arguable they are not "accessible" to the developer. Apple does not say this. Treat it as a question to put to Apple, not a basis for leaving it off the label.

#### Gaps
- Apple's page says nothing on end-to-end encryption or Sign in with Apple disclosure specifically.

### B2. Deleting an account inside the app

#### Cited Findings
- "If your app supports account creation, you must also offer account deletion within the app." The same guideline also says: "If your app doesn't include significant account-based features, let people use it without a login." — [App Review Guidelines 5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/) [FETCHED]

#### Inferences
- The "use it without a login" line supports keeping the offline app fully usable signed out. Accounts would be only for sending or syncing.

(Another researcher covers deletion detail.)

---

### B3. Rate limits and bot protection on sign-in

#### Takeaway
Supabase already rate-limits each IP address and each user:
- 30 sign-in or code requests per 5 minutes per IP;
- one code per user per 60 s;
- 150 token calls per 5 minutes per IP.

It supports Cloudflare Turnstile or hCaptcha through a `captchaToken`. Turnstile probably will not run on a custom-scheme page, so the wrapped app needs an https-hosted challenge page or must skip the CAPTCHA there. Cloudflare's Workers rate-limiting binding is approximate and counted per location, and it advises against keying on IP address.

#### Cited Findings
- Supabase limits (all configurable unless noted):
  - Sign-ups and sign-ins (`signup`, `recover`, `resend`, `magiclink`, `otp`, `user`): 30 per 5 minutes per IP, bursts to 30.
  - Codes or links: one per user per 60 s.
  - `/verify`: 30 per 5 minutes per IP.
  - `/token`: 150 per 5 minutes per IP (covers refresh and ID-token grants).
  - Two-factor challenge and verify: 15 per minute per IP (not configurable).
  - Anonymous sign-ins: 30 per hour per IP.
  - Emails: 2 per hour on the built-in sender.

  — [Supabase: Rate limits](https://supabase.com/docs/guides/auth/rate-limits) [FETCHED]
- Supabase CAPTCHA:
  - Providers are hCaptcha and Cloudflare Turnstile, turned on under Bot and Abuse Protection.
  - It protects sign-up, sign-in and password-reset forms. The page does not say whether email codes are covered.
  - The token is passed as `options: { captchaToken }`. The widget must be on the page.
  - For Turnstile, localhost must be added to the domain allow list when testing locally.

  — [Supabase: Bot detection / CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha) [FETCHED]
- Turnstile in apps: "For native mobile applications, Turnstile does not run natively". You load a web page with the widget in a WebView. Requirements:
  - JavaScript and DOM storage on;
  - access to `challenges.cloudflare.com`;
  - allow `about:blank` and `about:srcdoc`;
  - a consistent User-Agent;
  - allowed origins that include "your own domains".

  Every example loads an https page. The page says nothing about custom schemes. — [Cloudflare: Turnstile mobile implementation](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/) [FETCHED]
- Turnstile hostnames are entered with no scheme, port or path, and no wildcards. — [Cloudflare: Hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/) [SNIPPET, flagged]
- A forum report says Turnstile failed in a WKWebView app served from a custom scheme. The workaround was an https challenge page with the token returned by deep link. — [OutSystems forum](https://www.outsystems.com/forums/discussion/105670/getting-turnstile-working-on-mabs-6/) [SNIPPET, flagged, anecdotal]
- Workers rate-limiting binding:
  - The only type is `simple`, with `limit` and `period` (10 or 60 s).
  - "Rate limits are approximate and apply separately in each Cloudflare location"; counts are eventually consistent and "do not combine into one worldwide limit". For a strict global limit, build it with Durable Objects.
  - "It is not recommended to use IP addresses or locations" as keys.
  - Needs Wrangler 4.36.0+. The page states no pricing or plan limits.

  — [Cloudflare: Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) [FETCHED]

#### Inferences
- For a small tester group, Supabase's built-in limits plus `shouldCreateUser: false` or an allow list (B7) are probably enough. Turnstile is worth adding when sign-up opens to the public, on the https web build first.

---

### B4. Keeping records private from the developer (end-to-end encryption)

#### Takeaway
"We cannot read it" honestly requires that the key is made and kept only on the user's devices and never sent to the server. A lost key means lost data. Three ways to keep the key:
- **iCloud Keychain sync** (`kSecAttrSynchronizable`; Apple devices only);
- **a passphrase** turned into a key (works everywhere; the user must remember it);
- **the passkey PRF extension** (one key per passkey; now broadly supported but uneven).

CloudKit encrypted fields are end-to-end only when the user has turned on Advanced Data Protection. Under standard protection Apple holds the keys.

#### Cited Findings
- `kSecAttrSynchronizable` syncs a keychain item "to other devices through iCloud". Since iOS 14 and macOS 11, keychain sync covers "passwords, certificates, and cryptographic keys". It cannot be combined with `...ThisDeviceOnly` accessibility. "Updating or deleting a synchronizable item affects all copies on all devices." tvOS does not sync. — [Apple: kSecAttrSynchronizable](https://developer.apple.com/documentation/security/ksecattrsynchronizable) (JSON address) [FETCHED]
- Under standard protection, "15 data categories — including Health and passwords in iCloud Keychain — are end-to-end encrypted". For those, "we can't help you recover this data if you lose access to your account." Third-party app data is otherwise "encrypted in transit and on server" (Apple can decrypt it). With Advanced Data Protection, "third-party app data stored in iCloud Backup and CloudKit encrypted fields and assets are end-to-end encrypted". Turning it on requires a recovery contact or recovery key. — [Apple: iCloud data security overview](https://support.apple.com/en-us/102651) [FETCHED]
- CloudKit `encryptedValues`:
  - "CloudKit encrypts the fields' values on-device before saving them to iCloud ... When you enable Advanced Data Protection, the encryption keys are available exclusively to the record's owner" and share participants.
  - Available from iOS 15 and macOS 12.
  - Not allowed in the public database, not indexable, and only on new fields.

  — [Apple: CKRecord.encryptedValues](https://developer.apple.com/documentation/cloudkit/ckrecord/encryptedvalues) (JSON address) [FETCHED]
- PRF support, from a third-party tracker (last updated 29 Sep 2026, checked Aug 2026):
  - Safari 18+ on macOS 15+ and iOS/iPadOS 18+ supports it with iCloud Keychain. iOS 18.0 to 18.3 had data-loss bugs; cross-device was fixed in 18.4+.
  - Chrome and Edge 147+ on Windows 11 24H2/25H2 after the Feb 2026 update support creation and sign-in.
  - Firefox 148+ on Windows supports creation and sign-in with Windows Hello. Firefox 139 supports it on macOS. Firefox 149+ on Android supports it (security keys not yet measured).
  - Chrome on Android supports it (Google Password Manager).
  - Windows 10 does not support it.
  - Password managers vary: Apple Passwords and Google Password Manager work; Dashlane and NordPass do not; Bitwarden is partial.

  — [Corbado: Passkeys PRF](https://www.corbado.com/blog/passkeys-prf-webauthn) [FETCHED; third-party vendor, not a browser vendor]
- The same source warns: "If the passkey is gone, the encrypted data is gone with it, permanently." The output is "bound to one passkey credential". "Treat PRF as an enhancement, not a dependency." "A capability flag is not a promise." — same [FETCHED]
- A Chromium "Intent to Ship: WebAuthn PRF extension" thread and Mozilla's standards-position issue exist. — [blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/iTNOgLwD2bI/m/Oz1C7oEYAgAJ), [mozilla/standards-positions #798](https://github.com/mozilla/standards-positions/issues/798) [SNIPPET, flagged]
- A WebKit bug about Safari returning still-encrypted output from security keys was reported fixed in Safari Technology Preview 241. — [WebKit bug 311099](https://bugs.webkit.org/show_bug.cgi?id=311099) [SNIPPET, flagged]

#### Inferences
- An honest "we cannot read your log" needs all of the following:
  - the key is generated on the device;
  - only ciphertext reaches the server;
  - no key escrow or "forgot key" reset exists;
  - sharing to a teacher re-encrypts to the teacher's key (or a per-share key) at the moment the button is pressed.

  A server password reset cannot restore data. Recovery has to be a recovery code the user saves, or a second device.
- **Fit for this app's users:**
  - Teachers on Android or Windows rule out iCloud Keychain as the only key holder.
  - A passphrase (or a saved recovery code) works on every platform.
  - PRF is now workable on current Safari, Chrome and Firefox. But it is per passkey and depends on the password manager. Use it as a convenience to unlock a stored key, not as the only key.
- CloudKit encrypted fields would only give "Apple cannot read it" for users with Advanced Data Protection on, and only on Apple devices. That is a weaker and narrower promise than an app-held key.

#### Gaps
- PRF version numbers rest on one vendor's tracker. I did not confirm them against Apple, Chrome or Mozilla release notes (the passkeys.dev PRF page returned 404).
- PRF inside WKWebView, or through native `ASAuthorizationPlatformPublicKeyCredentialProvider` (the iOS 18 PRF API), was not researched.

---

### B5. Sessions that last on an iPad (the 7-day storage cap)

#### Takeaway
WebKit's tracking protection deletes all script-writable storage after 7 days without user interaction. That covers localStorage, IndexedDB, cookies set by JavaScript, and service-worker caches. Where it applies:
- **Safari tabs:** it applies.
- **Home-screen web apps:** Apple's tracking-prevention page says their own domain is exempt.
- **WKWebView apps:** tracking protection is on by default since iOS 14, but no Apple or WebKit page I found says whether the 7-day storage cap applies. Third-party sources say it does not.

The safe design for the wrapped app is to keep the refresh token in the iOS Keychain on the native side. Supabase says HttpOnly cookies are not practical for a client-side app.

#### Cited Findings
- The cap deletes "all of a website's script-writable storage after seven days of Safari use without user interaction on the site". That covers IndexedDB, LocalStorage, Media keys, SessionStorage, and service-worker registrations and cache. Home-screen web apps "have their own counter of days of use". The first-party data of such an app is not expected to be deleted (calling that a serious bug). — [WebKit: Full Third-Party Cookie Blocking and More (2020)](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) [FETCHED]
- "ITP deletes all cookies created in JavaScript and all other script-writeable storage after 7 days of no user interaction". User interaction is "a user click, tap, or keyboard entry"; "Scrolling is not considered user interaction". The home-screen app's own domain is "exempt from ITP's 7-day cap on all script-writeable storage". Server-set cookies are capped to 7 days only for third-party CNAME or IP cloaking. The page says nothing about WKWebView apps. — [WebKit: Tracking Prevention](https://webkit.org/tracking-prevention/) [FETCHED]
- "Intelligent Tracking Prevention (ITP), is enabled by default in all WKWebView applications" (iOS 14, macOS Big Sur). Apps can offer a Settings toggle with `NSCrossWebsiteTrackingUsageDescription`. The page does not mention the 7-day cap or custom schemes. — [WebKit: App-Bound Domains](https://webkit.org/blog/10882/app-bound-domains/) [FETCHED]
- Third-party sources (2020) say WKWebView apps keep their own day counter, or none, so hybrid apps are not affected. — [Ionic blog](https://ionic.io/blog/is-apple-trying-to-kill-pwas), [Thinktecture](https://www.thinktecture.com/en/?p=8886) [SNIPPET, flagged, old]
- Supabase sessions:
  - Access tokens last 1 hour by default. "Refresh tokens never expire but can only be used once."
  - Reuse is allowed within 10 s. Other reuse ends the whole session.
  - Session time limits, inactivity timeout and single session per user are Pro plan and up only.
  - A custom `storage` (getItem, setItem, removeItem, async allowed) can be passed to `createClient`.
  - For client-side apps, "using HTTP-Only cookies is not feasible since only your server will be able to read and refresh the session."

  — [Supabase: Sessions](https://supabase.com/docs/guides/auth/sessions) [FETCHED]

#### Inferences
- **Wrapped app:** pass a custom `storage` to supabase-js whose get and set call through the bridge to the native Keychain (`...AfterFirstUnlock`, not synced). The session then survives any WebKit storage clearing, and an app reinstall can be handled on purpose.
- **Safari tab:** an iPad teacher who uses the app in a Safari tab and does not tap it for 7 days loses the session and any local data. This is a reason to steer iPad users to the wrapped app or the home-screen app.
- **HttpOnly cookies:** these would need an https server on the same site as the page. A custom-scheme page has no such site, so tokens stay client-side.

#### Gaps
- No current Apple or WebKit statement found on whether the 7-day cap applies to WKWebView apps, or to custom-scheme origins. It needs a test on a device (set the clock forward, or wait).

---

### B6. Signing out on one device or on all devices

#### Cited Findings
- Supabase `signOut` scopes:
  - `global` ends "all sessions active for the user". It is the default in JS and Swift.
  - `local` "only terminates the current session". It is the default in Dart and Kotlin.
  - `others` ends every session but the current one.

  Revoked sessions' access tokens "stay valid until they expire" (up to 1 hour by default). Other devices fail at their next refresh with "Invalid Refresh Token: Refresh Token Not Found". — [Supabase: Signing out](https://supabase.com/docs/guides/auth/signout) [FETCHED]
- "Single session per user" is enforced at the next refresh (Pro plan). — [Supabase: Sessions](https://supabase.com/docs/guides/auth/sessions) [FETCHED]

#### Inferences
- Use `local` for the ordinary "Sign out" button. Offer "Sign out everywhere" (`global`) separately, so that signing out on the iPad does not quietly sign out the teacher's phone.
- A screen listing "devices signed in" would need custom code. Supabase's docs here offer no session list for users.
- Shared records still need their own "take it back" step: signing out does not revoke what a teacher was sent.

---

### B7. Testers: TestFlight with Sign in with Apple, and an invite list

#### Takeaway
TestFlight builds use the production Sign in with Apple service. Forum reports say it works for testers, but sometimes fails for Apple's beta reviewers, so give the reviewers a working test login. To limit sign-up to testers:
- turn off "Allow new users to sign up" and create the tester accounts yourself; or
- use a Before User Created hook that checks an allow list; and
- use `shouldCreateUser: false` for email codes.

#### Cited Findings
- Developer forum posts report Sign in with Apple working in TestFlight and the simulator but failing for the review team (redirect loops, failed account creation). The practical answer is to provide test credentials in the beta review info. — [Apple Developer Forums 781256](https://developer.apple.com/forums/thread/781256), [808187](https://developer.apple.com/forums/thread/808187), [aso.dev TestFlight info](https://aso.dev/developer/beta-information) [SNIPPET, flagged, anecdotal; no official Apple statement found]
- Supabase "Allow new users to sign up": "If this config is disabled, only existing users can sign in." The page does not say whether this also blocks Apple, OAuth or email-code sign-ups. — [Supabase: General configuration](https://supabase.com/docs/guides/auth/general-configuration) [FETCHED]
- Before User Created hook: runs "immediately before a new user is inserted". It rejects with `{ error: { message, http_code: 4xx } }`. Examples include an email-domain allow list (Edge Function) and a SQL `signup_email_domains` allow/deny table. It does not list which sign-up methods trigger it, and states no plan availability. — [Supabase: Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook) [FETCHED]
- `shouldCreateUser: false` stops an email-code request from creating an account. — [Supabase: Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless) [FETCHED]

#### Inferences
- Allow list by email is awkward with Sign in with Apple. A tester who picks "Hide My Email" arrives with a `privaterelay.appleid.com` address that will not match an invited address. Two workarounds:
  - match on an invite code entered before sign-up; or
  - add the relay address to the list after the first attempt.
- Because the hook's coverage of Apple and ID-token sign-ups is not documented, test it with a real Apple sign-up before relying on it.
- The built-in email sender reaches only team members. Email-code testers therefore need a real sending service before the test starts (see A1).

#### Gaps
- No official Apple page found on Sign in with Apple in TestFlight. Only forum reports.
- Whether "Allow new users to sign up = off" and the Before User Created hook both cover Sign in with Apple through `signInWithIdToken` is undocumented on the pages read.

## Topic 5: How do other Qur'an apps handle accounts?


Date of reading for every source: 2026-11-15. Each claim says whether the page was **FETCHED** (opened in full) or only seen as a **SNIPPET** in search results. Claims resting only on a snippet are marked "(snippet only)".

How the pages were read: most pages were opened with a web fetch tool, which hands back a summary of the page rather than the raw page. Short phrases shown in quotes are the wording that summary gave back, so treat them as close paraphrase unless noted. One page, Tarteel's privacy policy, only shows its text once scripts run, so it was opened in a headless Chrome browser and its rendered text was read directly. Quotes from that page are exact. App Store listings show release dates without the year, so "Oct 31" and similar dates below are as printed.

Apps covered: Quran.com and the Quran Foundation (its shared accounts, its developer sign-in system and its user APIs, and QuranReflect), Tarteel, Mofassal, Quran Companion, Quranly, Muslim Pro and Ayah. Teacher-and-student apps: Sabaq, Hifz Tracker and Hifz Track were read in full. Tahfeez and Mutabaah could not be opened (their store pages returned "not found"). No app named exactly "Hifdh" or "Quran Hifz" was looked at in depth beyond search results.

### Quran.com and the Quran Foundation: how do sign-in and accounts work, and what does an account unlock?

#### Takeaway
Since 12 November 2025, one Quran Foundation account works on both Quran.com and QuranReflect.com. You can sign in with Google, Facebook, Apple or email. Reading and browsing appear to need no account. This is inferred from the privacy policy's wording ("users who choose to create an account"), not stated outright. An account adds notes, reflections, reading streaks, goals, collections and progress synced across browsers. Outside developers can let their own users "Sign in with Quran.com" through a standard sign-in system (OAuth2, authorization code with PKCE). That system comes with scopes for each kind of data, a webhook that fires when a user deletes their account, and strict privacy rules. The Quran.com iPhone app may be an exception. One user's feedback post from April 2026 says it synced bookmarks and notes through iCloud, not through the account. Quran.com has not confirmed this.

#### Cited Findings
**Sign-in methods and the shared account**
- An announcement dated 12 November 2025 says you can sign up or log in with Google, Facebook, Apple and Email. One account now covers both Quran.com and QuranReflect.com. (FETCHED) — [Quran.com: Centralized accounts across Quran Foundation](https://quran.com/product-updates/centralized-accounts-across-quran-foundation)
- The same post lists what Quran.com keeps for a signed-in user: "Notes and reflections", "Reading streaks", "Goal tracking", "Collections" and "Synced progress across browsers". It also says "Your data stays synchronized across platforms; so your progress, notes, and activity travel with you." The post does not mention bookmarks by name. (FETCHED) — [same page](https://quran.com/product-updates/centralized-accounts-across-quran-foundation)
- The Quran.com apps page says: "Sign in once, and your bookmarks, notes and progress travel with you across most of the apps listed below." The only app it names as linking to a Quran.com account is Tazkiya, which keeps "bookmarks, collections, reflections, and reading progress in sync". (FETCHED) — [Quran.com apps](https://quran.com/apps)

**Using it with no account**
- The Quran.com privacy policy covers the account data of users "who choose to create an account". That wording implies the account is optional. The policy describes only email as the account identifier and does not mention Google, Apple or Facebook. (FETCHED) — [Quran.com privacy policy](https://quran.com/privacy)

**What is collected, where it is kept, and deletion**
- The privacy policy says email is collected "to facilitate the account creation process". It is used for login, settings, storing bookmarks and reading history, account recovery and security notices. (FETCHED) — [Quran.com privacy](https://quran.com/privacy)
- Google Analytics is the only outside processor the policy names. The policy does not say where data is stored. It says "We do not sell, trade, or rent your personal information to third parties." (FETCHED) — [Quran.com privacy](https://quran.com/privacy)
- You start account deletion from your profile page. The policy says "all associated personal data will be automatically and permanently removed from our systems" within "a reasonable timeframe", with no number of days given. (FETCHED) — [Quran.com privacy](https://quran.com/privacy)

**The Quran.com iPhone app**
- In an April 10, 2026 feedback post, a user said the iPhone app's Bookmarks page reads "The app uses iCloud to sync bookmarks & notes across your devices". The user said the app had no account sign-in. They had signed up on desktop with an Apple ID, and their bookmarks did not sync to the phone. The Quran.com team's reply on April 12, 2026 thanked them but explained nothing. (FETCHED) — [feedback.quran.com: iOS Syncing Issues](https://feedback.quran.com/mobile-app/p/ios-syncing-issues)
- The App Store listing (Quran Foundation, Inc; version 3.0.2, Oct 9) declares no "Data Linked to You" and no tracking. "Data Not Linked to You" covers Usage Data for analytics and app functionality, plus crash and performance diagnostics. The listing says nothing about accounts, sign-in or iCloud. The app is free and ad-free. (FETCHED) — [App Store: Quran - by Quran.com](https://apps.apple.com/us/app/quran-by-quran-com-%D9%82%D8%B1%D8%A2%D9%86/id1118663303)

**The developer sign-in system ("Quran Foundation accounts" for outside apps)**
- The user APIs cover "personalized notes, bookmarks, goals, streaks, reading sessions, and more". They use OAuth2. For web apps, the docs recommend that the app's server swap the sign-in code for a token. (FETCHED) — [QF docs: User-related APIs](https://api-docs.quran.foundation/docs/user_related_apis_versioned/user-related-apis)
- The user APIs use the OAuth 2.0 Authorization Code flow with PKCE. Content APIs use Client Credentials. The production base address is `https://oauth2.quran.foundation`, with `/oauth2/auth` and `/oauth2/token`. `openid` returns an ID token and `offline_access` returns a refresh token. The `email` claim in the ID token is included "when available". (FETCHED) — [QF docs: Getting started with OAuth2](https://api-docs.quran.foundation/docs/tutorials/oidc/getting-started-with-oauth2/)
- The scopes page lists permission groups for bookmark, collection, reading_session, streak, goal, note (including `note.publish`), post and comment (QuranReflect), room (QuranReflect groups and pages, with invite and join), preference, activity_day, user (profile, follow, followers), app_state (approved app-specific data), and sync (offline-first push and pull). It says "the user must consent to grant access to the scopes your app is requesting." (FETCHED) — [QF docs: OAuth2 Scopes](https://api-docs.quran.foundation/docs/user_related_apis_versioned/scopes)
- When a user who authorized your app deletes their Quran Foundation account, a `user.deleted` webhook fires so you can "delete or anonymize the data you hold for that user". It keys on the same `sub` as the ID token. Merging two accounts also fires `user.deleted` for the account merged away. A user who disconnected your app before deleting their account is not announced to you. (FETCHED) — [QF docs: Webhooks](https://api-docs.quran.foundation/docs/tutorials/webhooks/)
- The developer terms say an app must "Provide users a clear method to revoke tokens and delete their data", "Request only the minimum scopes necessary", and keep a public privacy policy. Apps may not use user data to build advertising profiles or machine-learning models without written consent. (FETCHED) — [QF Developer Terms](https://api-docs.quran.foundation/legal/developer-terms/)
- The developer privacy requirements say an app must get explicit, separate consent before collecting religious data, and must not train AI on user content without specific consent. On deletion, live data must be "hard-deleted within 30 days" and backups within 90 days. Deleting the main Quran Foundation account must delete the app's related notes and bookmarks too. Outside processors must be named. Data must not be sold. The app must state a minimum age (usually 13) and block sign-ups from users found to be under it. (FETCHED) — [QF Developer Privacy Requirements](https://api-docs.quran.foundation/legal/developer-privacy/)
- A production lifecycle page reportedly says "self-service account deletion retains its compatible public entrypoint". (snippet only) — [QF docs: app-state lifecycle](https://api-docs.quran.foundation/docs/user_related_apis_versioned/1.0.0/app-state/lifecycle/)

**QuranReflect**
- QuranReflect shares the same account and the same four sign-in methods. (FETCHED) — [centralized accounts post](https://quran.com/product-updates/centralized-accounts-across-quran-foundation)
- In QuranReflect, groups can be public or private, and whoever creates a group owns it. Private groups need an invitation, and joining can use a room invite token. Admins can switch a post between public and members-only. (snippet only) — [QF docs: Rooms](https://api-docs.quran.foundation/docs/user_related_apis_versioned/rooms/). The `room.invite` and `room.join` scopes are confirmed on the FETCHED [scopes page](https://api-docs.quran.foundation/docs/user_related_apis_versioned/scopes).

#### Inferences
- Quran.com is the clearest model of "read freely, sign in to keep things". The account adds sync, notes, streaks, goals and social reflection, and gates no reading.
- The Quran Foundation's rules for outside apps (minimum scopes, consent before collecting religious data, hard deletion within 30 days, deletion carried through by webhook, no AI training without consent) are a useful bar to measure any Qur'an app's privacy against, even an app that never uses their APIs.
- Two sync systems existed side by side in April 2026: the website used the account and the iPhone app used iCloud. Users find that confusing, as the feedback post shows.

#### Gaps
- Whether the Quran.com iPhone app added account sign-in after April 2026 (version 3.0.2, Oct 9) could not be confirmed. The App Store listing says nothing about it.
- The Quran.com privacy policy names no storage country or host.
- The exact address and permission needed for self-service account deletion through the API was not found (snippet only).

### Tarteel: how does sign-in work, what does an account or Premium unlock, and how is voice data handled?

#### Takeaway
Tarteel offers three sign-in methods: email and password, Apple and Google. The free tier already includes streaks, badges, bookmarks, one goal and "Sync across all your devices". Premium adds the memorisation tools: mistake detection, unlimited test mode, peeking, mistake history, journey planning and advanced analytics. Voice recordings are personal data. They are stored in the US on servers such as AWS. The privacy policy rests AI training on "legitimate interest", not on consent. The switch that turns training off is for Premium users only. Tarteel's own help pages disagree on whether training is opt-in or opt-out, and no page states the default. You can delete your account in the app, but payment records and recordings already used for training are kept.

#### Cited Findings
**Sign-in and guest use**
- "Tarteel offers 3 different ways to sign up": email and password, Apple ID, or Google account. (FETCHED) — [Tarteel help: How to create a Tarteel account](https://support.tarteel.ai/en/articles/12168720-how-to-create-a-tarteel-account)
- If progress, streaks or goals go missing, support tells users to log back in with the same method they first used (email, Google or Apple). (snippet only) — [Tarteel help: progress, streak or goals missing](https://support.tarteel.ai/en/articles/14075443-my-progress-streak-or-goals-are-missing-or-not-updating)
- On Google Play, Tarteel marks email address and user IDs as "optional". That suggests parts of the app work without an account. (FETCHED) — [Google Play data safety: Tarteel](https://play.google.com/store/apps/datasafety?id=com.mmmoussa.iqra&hl=en)

**What is free, and what Premium adds**
- Free: unlimited recitation follow-along, AI voice search, Testing Mode with a daily limit, hide-ayah, translations and tafsirs, recitations, tajweed colours, 4 mushaf layouts, look-alike verse lists, "Streaks, basic analytics, badges, bookmarks and 1 goal", and "Sync across all your devices". Premium "adds AI memorization tools", chiefly mistake detection and unlimited Testing Mode. (FETCHED) — [Tarteel help: Can I use Tarteel for free?](https://support.tarteel.ai/en/articles/12267535-can-i-use-tarteel-for-free)
- The App Store lists Premium as adding live mistake detection, Peeking and Hidden Verses Mode, goal planning and advanced analytics, and mistake history. US prices shown: Monthly $12.99, Annual $99.00, Premium Monthly $19.99 and Premium Yearly $239.99. The listing does not say which are current. Version 5.83.0. (FETCHED) — [App Store: Tarteel](https://apps.apple.com/us/app/tarteel-quran-memorization/id1391009396)
- Premium also adds word-by-word highlighting while listening and colour-coded look-alike verses on the page. (snippet only) — [Tarteel help: What's Tarteel Premium?](https://support.tarteel.ai/en/articles/12414387-what-s-tarteel-premium)

**App Store and Google Play privacy labels**
- On the App Store, data linked to you is email (for marketing, analytics, personalisation and app functionality), purchase history, user ID, and customer-support content. Data not linked to you is audio (for analytics and app functionality), device ID, product interaction and diagnostics. No tracking is declared. (FETCHED) — [App Store: Tarteel](https://apps.apple.com/us/app/tarteel-quran-memorization/id1391009396)
- On Google Play, Tarteel says it shares no data with third parties. It collects voice or sound recordings (for app functionality), email and user IDs (optional), purchase history, in-app search history, app interactions and crash logs. Data is encrypted in transit, and users can ask for deletion. (FETCHED) — [Google Play data safety: Tarteel](https://play.google.com/store/apps/datasafety?id=com.mmmoussa.iqra&hl=en)

**The privacy policy (last updated May 26, 2023)**
- The policy counts voice recordings as personal information: "Personal Information includes the voice recordings which you submit to us through the use of the Site, demographic information that you provide, IP addresses, Device ID, as well as your email when you elect to join a mailing list or create an account." (FETCHED, read in a browser) — [Tarteel privacy policy](https://tarteel.ai/privacy)
- Storage: "Your voice records and personal information are stored on servers located in the United States. No data is stored in the EU and all data stored with server providers in the US have a GDPR compliant Data Processing Addendum." The outside services it names are "Server providers, such as AWS. Analytics providers, such as Mixpanel. Customer Service tools, such as Zendesk." It also uses Google Analytics. (FETCHED, read in a browser) — [Tarteel privacy policy](https://tarteel.ai/privacy)
- The legal basis for AI training is "To train our Artificial Intelligence continuously to improve our services, Art. 6f GDPR, legitimate interest". It is not based on consent. (FETCHED, read in a browser) — [Tarteel privacy policy](https://tarteel.ai/privacy)
- On retention, data is kept "for as long as necessary to fulfill the purposes for which it was collected". Users "may request that we delete your personal information at any time". The service is not directed at children under 13. (FETCHED, read in a browser) — [Tarteel privacy policy](https://tarteel.ai/privacy)
- The help-centre summary of the policy says: "We collect the recordings from your recitation sessions to allow you to listen to them", "and also to be anonymously used as training data for our AI", and "We do not share any user data with third parties nor do we sell it." (FETCHED) — [Tarteel help: Understanding our privacy policy](https://support.tarteel.ai/en/articles/12414462-understanding-our-privacy-policy)
- Apart from AI training, "unless you share your recitations with others, they won't be listened to." Recordings can be deleted in the app. (FETCHED) — [Tarteel help: Who can access my recordings?](https://support.tarteel.ai/en/articles/12414465-who-can-access-my-recordings)
- To opt out of AI training, open Settings, then Privacy, then Data Usage, and turn off "Allow AI training". The article says "opting out of A.I training is available for Premium users only." It does not state the default. (FETCHED) — [Tarteel help: How to opt out of AI training](https://support.tarteel.ai/en/articles/12414504-how-to-opt-out-of-ai-training)
- **The help pages conflict on consent.** The deletion article says recordings used for training are kept only "if you opted in" ([deletion article](https://support.tarteel.ai/en/articles/12414491-how-to-delete-your-account)). The recordings article says a Premium user "can choose to participate" ([recordings article](https://support.tarteel.ai/en/articles/12414465-who-can-access-my-recordings)). Both suggest an opt-in. But an "opt-out" switch that only Premium users have, and a policy that rests training on legitimate interest ([privacy policy](https://tarteel.ai/privacy)), point towards training being on unless you turn it off. No fetched page settles which is true. (all FETCHED)

**Deleting an account**
- In the app, go to Menu, then Account, then "Delete Account", then confirm. If you cannot log in, ask support by chat. Deleting the account does not cancel Premium. Deleted: app activity, account details, mailing-list sign-up, and audio linked to the account. Kept: "Payment records" and anonymised recordings already used for AI training if you opted in. (FETCHED) — [Tarteel help: How to delete your account](https://support.tarteel.ai/en/articles/12414491-how-to-delete-your-account)

**Teachers**
- Tarteel has a schools page that says its AI helps "both students and teachers" in Quran class and works with Google Classroom. (snippet only. The page returned "not found" when opened) — [tarteel.ai/schools](https://www.tarteel.ai/schools)
- A Tarteel blog post suggests using mistake detection "alone or in class with friends or with your teacher". (snippet only) — [Tarteel blog: Memorization Mistake Detection tutorial](https://tarteel.ai/blog/tarteel-tutorials-memorization-mistake-detection/)
- The App Store description lists no feature that links a teacher to a student or shares mistakes with a teacher. (FETCHED) — [App Store: Tarteel](https://apps.apple.com/us/app/tarteel-quran-memorization/id1391009396)

#### Inferences
- Tarteel's AI-training switch sits behind the paywall. If training is on by default (not confirmed), free users would have no way to stop it. Resting training on "legitimate interest" rather than consent is out of step with the Quran Foundation's rule for outside apps ("no AI training without specific consent"), though that rule does not bind Tarteel.
- Tarteel's Apple privacy label and its privacy policy describe audio differently. The label calls audio "not linked to you". The policy calls voice recordings personal information, and deleting an account removes "audio recordings linked to your account".
- Tarteel puts sync in the free tier. The account itself is not what you pay for. The paid tier is the AI memorisation tools.

#### Gaps
- Whether Tarteel can be used without signing in at all could not be confirmed from an official page.
- Whether AI training is on by default, for free or for Premium users, is not stated. The help pages conflict (see above).
- How teachers and students would be linked through Tarteel's schools or Google Classroom offer is unknown. The page could not be opened.
- The privacy policy is dated May 2023 and predates later features.

### Mofassal: how do accounts work, and how are teachers, students and parents linked?

#### Takeaway
Mofassal is a free iPhone hifz app from the Tafsir Center for Quranic Studies. A guest can create a plan without an account and sign up later. The listing does not say whether group features work for guests. Its App Store label says it collects no data. It is built around halaqah groups (study circles) with teacher, student, assistant, supervisor and parent roles. Plans are shared by link or invitation, with view or edit permission. Older release notes mention sign-in by email, Facebook, Gmail and phone number. The current listing names no sign-in method.

#### Cited Findings
- Developer: Abdulrahman Al Shehri, "An initiative of Tafsir Center for Quranic Studies". Free, no in-app purchases shown. Version 3.0.7 (Oct 31). (FETCHED) — [App Store: Mofassal](https://apps.apple.com/us/app/mofassal-quran-hifz-review/id1584188020)
- The privacy label reads: "The developer does not collect any data from this app." The description says "no ads and no trackers". The privacy policy is linked as a Google Doc. (FETCHED) — [same](https://apps.apple.com/us/app/mofassal-quran-hifz-review/id1584188020)
- On guest use, the listing says you can "use Mofassal as a guest and create your plan without an account, then sign up whenever you like". It also supports several accounts on one device, with switching between them. (FETCHED) — [same](https://apps.apple.com/us/app/mofassal-quran-hifz-review/id1584188020)
- On sign-in methods, the release notes mention email sign-in and quick login with Facebook and Gmail (version 2.1.1, 2023), and phone-number login (version 1.3.4, 2022). Apple sign-in is not mentioned. (FETCHED) — [same](https://apps.apple.com/us/app/mofassal-quran-hifz-review/id1584188020)
- Teacher features: you can create a halaqah, add students, and give each a plan and record. Attendance and recitation are recorded, and one dashboard shows the group. The roles are teacher, student, assistant, supervisor and parent, each with owner, editor or viewer permission. Parents see their child's memorisation and review progress. Plans are shared with family "by link or invitation" with view or edit permission. Version 3.0.7 fixed the invite link. (FETCHED) — [same](https://apps.apple.com/us/app/mofassal-quran-hifz-review/id1584188020)
- A search summary of the listing says each session can record "ratings, mistakes, and notes". (snippet only) — [appshunter: Mofassal](https://appshunter.io/ios/app/id1584188020)
- The app works offline. Data is saved on the device and syncs when back online, and a plan can continue on another device. (FETCHED) — [App Store: Mofassal](https://apps.apple.com/us/app/mofassal-quran-hifz-review/id1584188020)

#### Inferences
- Mofassal is the strongest example of "guest first, account later" in a teacher-group hifz app. Its link or invitation sharing with owner, editor and viewer permissions is a concrete pattern for linking a teacher and a student.
- Mofassal's "does not collect any data" label is the developer's own declaration. It sits oddly with the app's accounts, cross-device sync, and the email, Facebook and phone sign-in its release notes describe, all of which need some account data on a server. Treat the label with caution until the privacy policy is read.

#### Gaps
- The privacy policy (a Google Doc) was not found or read, so storage location and the deletion process are unknown.
- The current sign-in methods are not named. It is not known whether Sign in with Apple is offered.
- Exactly how a student joins a halaqah (a code, a link, or being added by phone or email) is not stated.

### Quran Companion, Quranly, Muslim Pro and Ayah: what does an account do in each?

#### Takeaway
- **Muslim Pro** offers email, Google, Apple and Facebook sign-in, plus phone number in Bangladesh. Guests can skip sign-in, but "progress and settings will not be saved". It collects and tracks the most data of the apps here.
- **Quranly** is an account-based habit and streak app. Its policy names email and Facebook sign-in and says the app can be used without an account. Data is stored in the UK.
- **Quran Companion** has not been updated since 2018 and gives Apple no privacy details. Its 2018 policy names no sign-in method and sends data to the US.
- **Ayah** has no account at all. It syncs optionally through the user's own iCloud and declares no data linked to you. It is the clearest "no account, Apple-only sync" example here.

#### Cited Findings
**Muslim Pro (Bitsmedia Pte Ltd)**
- Onboarding offers "Email", "Google" or "Apple". A profile can be "tied to your Google, Apple, Facebook or email account". An account unlocks tracking your trackers and achievements, access to "bookmarks, favorites, and Khatam progress anytime", restoring Premium, and Premium across several devices. Guests can tap X to skip, but "your progress and settings will not be saved." (FETCHED) — [Muslim Pro help: Setting up a profile](https://support.muslimpro.com/hc/en-us/articles/4648775233549-Setting-Up-A-Muslim-Pro-Profile)
- In Bangladesh, the default login screen offers sign-up by mobile number. (snippet only) — [Muslim Pro help: Mobile number vs email (Bangladesh)](https://support.muslimpro.com/hc/en-us/articles/45547333906201-Logging-in-With-Mobile-Number-vs-Email-on-Muslim-Pro-Qalbox-For-Bangladesh-Only)
- App Store labels: data used to track you is location and identifiers. Data linked to you is coarse location, name, email, phone number, photos or videos, user ID and device ID, used for purposes that include third-party advertising. Premium costs $12.99 a month or $34.99 a year in the US. Version 17.11.1. (FETCHED) — [App Store: Muslim Pro](https://apps.apple.com/us/app/muslim-pro-quran-athan-prayer/id388389451)
- The privacy policy (version 3, 22 June 2022) says a Facebook, Apple or Google login sends Bitsmedia your name, email and device identifiers. Without an account, location "will be stored in your device but will not be transmitted to Our servers". With an account, your latest location syncs to their servers. The policy may infer religious beliefs from your use of the app. It shares data with advertising service providers. It names no storage countries. The data controller is in Singapore. Erasure requests go to dpo@bitsmedia.com. (FETCHED) — [Muslim Pro privacy policy](https://support.muslimpro.com/hc/en-us/articles/203485970-Privacy-Policy)
- To delete an account, go to Profile, then Edit Profile, then the red "Delete your account" button, then verify your login and confirm. You "must cancel" any subscription first, or billing continues. Deletion is not available on the web. Lifetime subscribers must contact support. (FETCHED) — [Muslim Pro help: How to delete my account](https://support.muslimpro.com/hc/en-us/articles/7446595463577-How-to-delete-my-Muslim-Pro-Qalbox-account)

**Quranly (Quranly Ltd)**
- App Store labels: tracking covers Usage Data. Data linked to you is email and name, for app functionality. Data not linked to you is product interaction and purchase history. In-app purchases include $4.99 a month, $29.99 a year, and lifetime at $199.99 or $79.99. Release notes mention streaks, a leaderboard, user names and logout. Version 3.0.79 (Nov 6). (FETCHED) — [App Store: Quranly](https://apps.apple.com/us/app/quranly/id1559233786)
- The privacy policy collects email, password, optional gender, daily verse goals and reminder times. It also collects device data, including advertising IDs and sensor readings. It describes email-and-password sign-up and Facebook "convenience log in", and does not list Apple or Google sign-in. Data is stored "on our server in the UK" and partly on the phone. It says "you may use the app without creating an account", with some features limited. Deletion is from the settings menu. Server logs are kept 30 days. (FETCHED) — [Quranly privacy policy](https://quranly.app/privacy-policy)
- One App Store review says a paying user was told they "need to sign in or sign up". (snippet only) — [App Store CZ: Quranly](https://apps.apple.com/cz/app/quranly/id1559233786)

**Quran Companion (Quran Academy; seller Bilal Memon)**
- The privacy label reads "No Details Provided". The privacy policy is at quranacademy.io/privacy. The app is free with 1-month or 1-year subscriptions, no prices shown. It has "Hasanah" points, a leaderboard and group challenges with friends. Version 1.2.3 (2017) mentions background sync of memorisation progress. The latest version is 1.2.5, from 06/20/2018. Accounts and sign-in are not mentioned. (FETCHED) — [App Store: Quran Companion](https://apps.apple.com/us/app/id1111843462)
- The Quran Academy privacy policy was last updated May 25, 2018. It collects email, first and last name, address details, usage data and, with permission, location. It mentions an "account settings section" but names no sign-in method. Facebook and Google appear only as analytics and ad-remarketing services. Data from users outside the US is transferred "to United States and process it there". Deletion is by emailing hello@quranacademy.io. (FETCHED) — [Quran Academy privacy policy](https://quranacademy.io/privacy)

**Ayah (seller Abdullah Bajaber)**
- The labels list only "Data Not Linked to You": user ID, device ID, product interaction, crash and performance data, for analytics and app functionality. Nothing is linked to you. The listing mentions no account, sign-in or sync. "Ayah Membership" costs $1.99 or $12.99 (billing period not shown). Version 2026.1. The privacy policy is at ayahapp.com/privacy. (FETCHED) — [App Store: Ayah](https://apps.apple.com/us/app/ayah-quran-app/id706037876)
- One App Store review praises sync between the reviewer's iOS devices. (snippet only, from a search summary) — [App Store SE: Ayah](https://apps.apple.com/se/app/ayah-quran-app/id706037876?l=en)
- The Ayah privacy policy mentions no accounts. Sync is optional and runs through iCloud: "If sync is enabled, we store your data in Apple's iCloud service in order to enable sync features between all devices signed into your Apple ID." Analytics are "anonymous and not tied to any user". File downloads may log the IP address. No deletion process and no effective date are given (the copyright line reads 2013-2024). (FETCHED) — [Ayah privacy policy](https://ayahapp.com/privacy/)

#### Inferences
- Across these apps, the account mainly does three things: it keeps progress and streaks, it restores a paid plan on a new device, and it feeds social features such as leaderboards and community. Muslim Pro also uses it to sync location.
- Muslim Pro is the cautionary example. It has the broadest sign-in options, but they come with tracking, advertising use and inferred religious belief. Ayah and Mofassal show it is possible to ship with nothing linked to you.

#### Gaps
- Quran Companion's sign-in methods are unknown. Neither its listing nor its 2018 policy names them.
- Ayah's privacy policy gives no deletion process.
- Quranly's policy does not list Apple sign-in. Whether the app actually offers it was not checked (Apple's rules often require it when other social logins are offered, but that was not verified here).

### Which apps let a teacher see a student's memorisation mistakes, and how are teacher and student linked?

#### Takeaway
The apps that show mistakes or recitation records to a teacher are school and halaqah tools, not the big reader apps. Three linking patterns turn up. In the first, a school or admin creates the accounts and links parents (Sabaq, Hifz Track). In the second, a group owner adds members and shares by link or invitation with role-based permissions (Mofassal, QuranReflect groups). In the third, an in-app invite costs money (Hifz Tracker). None of the listings that were read mentions an invite code. Tarteel advertises a schools offer but showed no teacher-sharing feature in what could be read.

#### Cited Findings
- **Sabaq** (Central Jersey Institute of Islamic Sciences): "Parents and teachers need to be given access by schools registered on sabaq.io." Admins manage students, teachers and classes, and link parents to students. Access can be granted by email address without the person creating an account first (version 2.3.4). Teachers record recitations for any student. Mistake labels and self-corrections are recorded (version 2.2.2). Parents can sign off on recitations (version 3.3.0). The label shows only data not linked to you (usage and diagnostics). Free. Version 3.8.5 (Oct 20). (FETCHED) — [App Store: Sabaq](https://apps.apple.com/us/app/sabaq/id1568365115)
- **Hifz Tracker** (Sidr Productions): it offers "Student & Teacher Mode" for "independent users or classroom environments". Version 1.1.8 (11/21/2025) added in-app subscriptions that let users invite others, "applicable only when inviting a teacher or student". Data linked to you is name and email, for app functionality. "License" purchases cost $38.99 to $49.99. How the two are linked and what a teacher sees are not described. Privacy policy at hifztracker.com/privacy-policy. (FETCHED) — [App Store: Hifz Tracker](https://apps.apple.com/us/app/-/id6748594784)
- **Hifz Track** (Mohamed Ismail Rahamathulla): registration is required ("Yes it needs to be registered. Please fill in the form in App Support link"). Teachers and directors create assessments, parents view them and acknowledge, and administrators manage everyone. Data not linked to you is user ID and device ID. Free. (FETCHED) — [App Store: Hifz Track](https://apps.apple.com/us/app/hifz-track/id1525085161)
- **Mofassal**: halaqah roles and sharing by link or invitation. See the Mofassal section above. (FETCHED) — [App Store: Mofassal](https://apps.apple.com/us/app/mofassal-quran-hifz-review/id1584188020)
- **Tahfeez Teacher's Companion**: offers student management, attendance and progress monitoring. Nothing is said about mistakes or invite codes. (snippet only. The store page returned "not found" when opened) — [App Store: Tahfeez](https://apps.apple.com/us/app/id6745488675)
- **Mutabaah**: appeared in search with no usable detail. The store page returned "not found". (snippet only) — [App Store ZA: Mutabaah](https://apps.apple.com/za/app/mutabaah/id6463693463)
- **Quran Record**: teachers add records to student profiles and can email daily records to parents. (snippet only) — [mwm.ai: Quran Record](https://mwm.ai/apps/quranrecord/6751930130)
- **Hifdh Tracker by Riseup Labs**: offers "tools to review mistakes, provide comments, and suggest improvements" for teachers. (snippet only) — [Riseup Labs: Hifdh tracker](https://riseuplabs.com/quran-memorization-through-technology-riseuplabs-develops-hifdh-tracker/)
- **Tarteel**: a schools page mentions Google Classroom (snippet only). No teacher-sharing feature appears in the App Store listing (FETCHED). See the Tarteel section above.

#### Inferences
- In these apps, mistakes are recorded by the teacher about the student, during or after a recitation (Sabaq, Hifz Track, Mofassal). They are not detected by AI and then forwarded. No app read here forwards AI-detected mistakes to a teacher.
- When an app links a teacher and a student, the account is required. Mofassal and Sabaq soften this. Mofassal lets you start as a guest. In Sabaq, a school grants access by email, so the person does not have to create an account first.

#### Gaps
- No listing read here describes an invite-code flow. Whether any app uses short join codes is unconfirmed.
- The privacy policies of Sabaq, Hifz Tracker and Hifz Track were not read, so how they store children's data is unknown.

### Which sources were fetched, and which were only seen as snippets?

#### Takeaway
34 pages were fetched in full. One of them, Tarteel's privacy policy, was opened in a browser because its text only appears after scripts run. Four addresses returned "not found". About a dozen claims rest only on search snippets and are marked "(snippet only)" above. All sources were read on 2026-11-15.

#### Cited Findings
FETCHED:
- [QF User-related APIs](https://api-docs.quran.foundation/docs/user_related_apis_versioned/user-related-apis) · [QF OAuth2 getting started](https://api-docs.quran.foundation/docs/tutorials/oidc/getting-started-with-oauth2/) · [QF Scopes](https://api-docs.quran.foundation/docs/user_related_apis_versioned/scopes) · [QF Webhooks](https://api-docs.quran.foundation/docs/tutorials/webhooks/) · [QF Developer Terms](https://api-docs.quran.foundation/legal/developer-terms/) · [QF Developer Privacy](https://api-docs.quran.foundation/legal/developer-privacy/)
- [Quran.com privacy](https://quran.com/privacy) · [Quran.com centralized accounts](https://quran.com/product-updates/centralized-accounts-across-quran-foundation) · [Quran.com apps](https://quran.com/apps) · [Quran.com iOS syncing feedback](https://feedback.quran.com/mobile-app/p/ios-syncing-issues) · [App Store: Quran by Quran.com](https://apps.apple.com/us/app/quran-by-quran-com-%D9%82%D8%B1%D8%A2%D9%86/id1118663303)
- [Tarteel privacy policy (read in a browser)](https://tarteel.ai/privacy) · [App Store: Tarteel](https://apps.apple.com/us/app/tarteel-quran-memorization/id1391009396) · [Google Play data safety: Tarteel](https://play.google.com/store/apps/datasafety?id=com.mmmoussa.iqra&hl=en) · Tarteel help articles: [delete account](https://support.tarteel.ai/en/articles/12414491-how-to-delete-your-account), [privacy summary](https://support.tarteel.ai/en/articles/12414462-understanding-our-privacy-policy), [create account](https://support.tarteel.ai/en/articles/12168720-how-to-create-a-tarteel-account), [free use](https://support.tarteel.ai/en/articles/12267535-can-i-use-tarteel-for-free), [who can access recordings](https://support.tarteel.ai/en/articles/12414465-who-can-access-my-recordings), [opt out of AI training](https://support.tarteel.ai/en/articles/12414504-how-to-opt-out-of-ai-training)
- [App Store: Mofassal](https://apps.apple.com/us/app/mofassal-quran-hifz-review/id1584188020) · [App Store: Quran Companion](https://apps.apple.com/us/app/id1111843462) · [App Store: Muslim Pro](https://apps.apple.com/us/app/muslim-pro-quran-athan-prayer/id388389451) · [Muslim Pro profile](https://support.muslimpro.com/hc/en-us/articles/4648775233549-Setting-Up-A-Muslim-Pro-Profile) · [Muslim Pro delete account](https://support.muslimpro.com/hc/en-us/articles/7446595463577-How-to-delete-my-Muslim-Pro-Qalbox-account) · [Muslim Pro privacy](https://support.muslimpro.com/hc/en-us/articles/203485970-Privacy-Policy) · [App Store: Quranly](https://apps.apple.com/us/app/quranly/id1559233786) · [Quranly privacy](https://quranly.app/privacy-policy) · [App Store: Ayah](https://apps.apple.com/us/app/ayah-quran-app/id706037876) · [Ayah privacy](https://ayahapp.com/privacy/) · [Quran Academy privacy](https://quranacademy.io/privacy) · [App Store: Hifz Tracker](https://apps.apple.com/us/app/-/id6748594784) · [App Store: Sabaq](https://apps.apple.com/us/app/sabaq/id1568365115) · [App Store: Hifz Track](https://apps.apple.com/us/app/hifz-track/id1525085161)

RETURNED "NOT FOUND" WHEN OPENED (only the snippet was seen): [tarteel.ai/schools](https://www.tarteel.ai/schools) · [App Store: Tahfeez](https://apps.apple.com/us/app/id6745488675) · [App Store ZA: Mutabaah](https://apps.apple.com/za/app/mutabaah/id6463693463) · www.tarteel.ai/privacy-policy (the right address turned out to be tarteel.ai/privacy).

SNIPPET ONLY: [Tarteel progress missing](https://support.tarteel.ai/en/articles/14075443-my-progress-streak-or-goals-are-missing-or-not-updating) · [Tarteel What's Premium](https://support.tarteel.ai/en/articles/12414387-what-s-tarteel-premium) · [Tarteel mistake-detection tutorial](https://tarteel.ai/blog/tarteel-tutorials-memorization-mistake-detection/) · [Muslim Pro Bangladesh mobile login](https://support.muslimpro.com/hc/en-us/articles/45547333906201-Logging-in-With-Mobile-Number-vs-Email-on-Muslim-Pro-Qalbox-For-Bangladesh-Only) · [QF Rooms](https://api-docs.quran.foundation/docs/user_related_apis_versioned/rooms/) · [QF app-state lifecycle](https://api-docs.quran.foundation/docs/user_related_apis_versioned/1.0.0/app-state/lifecycle/) · [appshunter Mofassal](https://appshunter.io/ios/app/id1584188020) · [Quran Record](https://mwm.ai/apps/quranrecord/6751930130) · [Riseup Labs Hifdh tracker](https://riseuplabs.com/quran-memorization-through-technology-riseuplabs-develops-hifdh-tracker/) · [Quranly CZ review](https://apps.apple.com/cz/app/quranly/id1559233786) · [Ayah SE review](https://apps.apple.com/se/app/ayah-quran-app/id706037876?l=en)

#### Inferences
- The claims marked "(snippet only)" should be re-checked before anything is built on them. That matters most for Tarteel's schools offer and the QuranReflect group-invite rules.

#### Gaps
- Not looked at: Google Play listings for apps other than Tarteel, and the privacy policies of Mofassal, Sabaq, Hifz Tracker and Hifz Track.
