# Can the owner install Hifth on their own iPhone, iPad and Mac through TestFlight, instead of a cable?

*Research note, 2026-11-09. Question from the owner. Constraint: the private build carries The
Study Quran's commentary, and the decision [native-testflight-licence](../decisions/native-testflight-licence.md)
says nothing is uploaded to Apple until a qualified person has read the licences.*

## The short version

- **Yes, technically.** As the account holder you can be an internal tester (someone on your own
  developer team). Internal builds need no Apple review before you install them. One tester can use
  up to 30 devices, and a build lasts 90 days.
- **But it is still an upload to Apple.** The build is processed and re-signed on Apple's servers in
  the US. Apple's developer agreement lets Apple use any build sent to TestFlight for compatibility,
  bug and security testing. Apple does not say whether a person ever opens an internal build.
- **So under today's decision, TestFlight is blocked.** It does not meet "nothing seen by anyone outside".
- **You can go cable-free without uploading anything.** Xcode now pairs and installs over Wi-Fi on
  the same network. With iOS/iPadOS 27 no cable is needed at all. On older versions, one cable pairing
  first, then Wi-Fi from then on. This laptop is an Apple-silicon Mac, so the Mac app installs here
  directly, with no transfer.
- **What to do:** use Wi-Fi installs from Xcode now. Add "is an internal-only TestFlight test, to the
  owner alone, a distribution?" to the licence brief as a narrower question than the outside-tester one.

## A few words, defined once

- **TestFlight**: Apple's app for installing test builds before an app is in the store.
- **Internal tester**: a member of your own App Store Connect team (the account holder counts).
  **External tester**: anyone else, invited by email or a public link.
- **Beta App Review**: Apple's check of a build before external testers can install it.
- **Ad hoc build**: a build signed to run only on devices whose ID you have registered with Apple.
- **Provisioning profile**: the file that says which devices and which team a build may run on.
- **App Sandbox**: a macOS setting that walls an app off from the rest of the Mac.
- **Notarizing**: uploading a Mac app to Apple for an automated malware check, so it opens without
  a warning outside the App Store.
- **Apple silicon**: Macs with Apple's own chips (M1 and later). These can run iPad apps.

## 1. Can the owner install their own build through TestFlight, with no review?

**Yes, from what Apple documents.** Apple's TestFlight page:
"Designate up to 100 members of your development team who hold the Account Holder, Admin, App
Manager, Developer, or Marketing role as beta testers." The account holder is one of those roles.

- **Review.** Apple ties review only to outside testers. TestFlight overview: "If you invite external
  testers, your beta build may require review." Developer agreement §6.5: "If You would like to
  distribute Your Application to Beta Testers outside of Your company or organization through
  TestFlight, You must first submit Your Application to Apple for review." The page on adding internal
  testers does not mention review at all. Internal distribution (§7.4A) is "solely for their internal
  use in testing, evaluating and/or developing Your Applications".
- **Devices.** "Testers can access all available beta builds you've shared with them, on up to 30
  devices" (TestFlight page). Apple's help pages do not repeat the number.
- **How long.** "You can test a build for up to 90 days" (TestFlight overview). A new upload starts
  a new 90 days.
- **Platforms.** The overview lists iOS and macOS (the iPad uses the iOS build). "To use TestFlight
  for Mac, build your macOS apps with Xcode 13 or later."
- **An internal-only lock exists.** When uploading, Xcode offers "TestFlight Internal Only", which
  "restricts access to your team". App Store Connect then marks the build internal, and "you can't
  submit them for external testing or to customers" (add-internal-testers page).

## 2. What does uploading hand to Apple, and who at Apple can see it?

**What Apple says happens:**

- The build goes to a US server: "When you submit your app to TestFlight or the App Store, you upload
  your app to a server in the United States" (encryption export page).
- Apple processes it: "the build needs to be processed in Apple's system before it appears in App
  Store Connect" (upload-builds page). Apple also runs "validation tests". Xcode's own pre-check is
  "a limited, automated initial validation".
- Apple re-packages it: "Testers download and install thinned variants of your app" (TestFlight
  overview). So Apple opens and rebuilds the package per device.
- Apple may sign or refuse it, "in its sole discretion" (§6.9).

**What the agreement lets Apple do with it** (§6.6, Developer Program License Agreement dated
October 29, 2026): "if Your Application is submitted for distribution via the App Store, Custom App
Distribution or TestFlight, You agree that Apple may use Your Application for the limited purpose
of compatibility testing of Your Application with Apple products and services, for finding and
fixing bugs and issues in Apple products and services and/or Your Applications, for internal use in
evaluating ... performance issues ..., for security testing". This clause makes no internal/external split.

**What Apple does not say:** whether any person at Apple opens an internal-only build. No page I
read says one does, and none says one doesn't. The honest summary is:

| | Internal test (you only) | External test (invited people) |
|---|---|---|
| Copy held on Apple's servers | Yes | Yes |
| Automated processing and re-packaging | Yes | Yes |
| Apple allowed to use it for testing (§6.6) | Yes | Yes |
| A reviewer opens it before testers get it | Not documented | Yes, first build (§6.5) |

I did **not** read the App Store Connect Terms of Service or the separate TestFlight Terms, which
may add more about how Apple handles the build. A licence reader should check both.

## 3. What must be in place before the first upload?

- **Encryption answer.** Every new version brings export questions unless the app's settings carry
  `ITSAppUsesNonExemptEncryption` = NO. Apple: HTTPS through the system "is exempt from export
  documentation upload requirements". Hifth only uses Apple's own HTTPS, so NO fits.
  Apple adds that exempt apps "might alternatively be required to submit a year-end
  self-classification report" (that applies when distributing outside the US/Canada).
- **Privacy manifest** (`PrivacyInfo.xcprivacy`, a file listing what data the app collects and which
  sensitive system calls it uses). Apple: "Starting May 1, 2024, apps that don't describe their use of
  required reason API in their privacy manifest file aren't accepted by App Store Connect." That
  applies to any upload, TestFlight included. The data-collection part is needed on all platforms.
  The sensitive-calls part is needed on iOS/iPadOS, not macOS.
- **Build numbers.** "The build string is used to uniquely identify the build throughout the
  system" (upload-builds page). Each upload needs a new, higher number. Xcode can raise it for you
  ("Manage version and build number").
- **Provisioning.** "For builds to be eligible for TestFlight, they must include application
  identifiers within the provisioning profiles" (overview).
- **Icon.** I found no Apple page in this pass that states the icon rule for TestFlight uploads.
  From general knowledge, a missing App Store icon fails validation. *Unverified.*
- **Mac: App Sandbox.** Apple's own pages say only: "To distribute a macOS app through the Mac App
  Store, you must enable the App Sandbox capability." That TestFlight Mac builds *also* need it rests
  on developer-forum threads (search snippets only). [testflight-plan.md](../design/testflight-plan.md)
  states it as fact. It is very likely true, since TestFlight for Mac uses the Mac App Store signing
  path, but no Apple page I opened says so.
- **Mac: is a Mac build needed at all?** This laptop is Apple silicon (`uname -m` = arm64). Apple
  lets the iPad build run on such Macs through TestFlight: a per-group setting, "Test iPhone and iPad
  apps on Apple silicon Macs, click Enable". **Unclear:** the app record also has a native macOS
  version. Apple says you "might choose to opt out of running your iOS app in macOS" when "You already
  created a Mac version". Apple does not say how TestFlight chooses between the two when both exist.
  A forum snippet says universal apps also need "Designed for iPad" in their supported destinations.
  *Snippet only.*

## 4. What other ways are there to install without a cable?

| Route | Uploads to Apple? | Cable? | Lasts | Trade-offs |
|---|---|---|---|---|
| **Xcode over Wi-Fi** (run from Xcode, or `devicectl`) | No | None on iOS/iPadOS 27+; else one cable pairing, then Wi-Fi | 1 year (paid team) | Laptop and device on the same Wi-Fi, with IPv6. Re-pair after each OS update |
| **Ad hoc `.ipa` installed from Device Hub** (Xcode's device window) | No | Same as above, once paired | Until the profile expires | Each device ID registered (100 per device type per year). No updates unless pushed |
| **Ad hoc install link** (`itms-services` web link) | No, but to *our* web server | None | Profile expiry | Apple documents this only for Enterprise in-house apps. Ad hoc use is from third-party guides. The build sits on an HTTPS host we run, so it must be private |
| **Apple Configurator** | No | *Unverified*: Apple's page did not say whether USB is required | Profile expiry | Adds `.ipa` files to selected devices. Mostly for fleets of devices |
| **Mac app as a file** (development-signed, Mac registered) | No | None (AirDrop or copy) | 1 year | Only on Macs registered to the team. The laptop needs no transfer at all |
| **Mac app notarized** (Developer ID) | **Yes** | None | No expiry | §5.3: "automated scanning, testing, and analysis ... and, in limited cases, a manual, technical investigation", and Apple "may retain and use Your Application". Wider exposure than TestFlight internal |
| **TestFlight, internal only** | **Yes** | None | 90 days | See §2 |

Apple on Wi-Fi pairing (Device Hub page): "Upgrade your iPhone or iPad to iOS or iPadOS 27 or later to
wirelessly pair it; otherwise, use a cable. First, ensure that the device is on the same Wi-Fi network
as your Mac". After pairing by cable: "You can disconnect the physical cable and run apps on the device
through Xcode using Wi-Fi with IPv6 enabled on the same network as your Mac."
Apple on device limits: "up to 100 ... devices, per product family, per membership year".
Apple frames ad hoc as an alternative to TestFlight that skips review: "distribute builds to a limited
set of testers on known devices without having to go through beta app review".

## 5. Which route fits "my own devices, no cable, nothing seen outside"?

**Fits today, with no change to the decision:**

1. **Xcode installs over Wi-Fi** to the iPhone and iPad. This is the same signed build as now and
   lasts a year. The one thing the owner checks: each device's iOS/iPadOS version. On 27 or later, no
   cable ever. Below that, plug in once to pair, then Wi-Fi from then on.
2. **The Mac app installs on this laptop directly.** For a second Mac, register it and copy the app over.
3. Ad hoc `.ipa` files through Device Hub, if a build is wanted that Xcode isn't running at the time.

None of these sends the build anywhere but the owner's own devices.

**Needs the licence decision changed first:**

- **TestFlight, even internal-only.** It puts the commentary on Apple's US servers, and §6.6 lets Apple
  use the build for testing. It is not "nothing uploaded".
- **Notarizing the Mac app.** It is also an upload, with a possible manual look written into §5.3.
- **An install link on a web host**, if that host is anyone else's. It is a copy off the owner's devices.

**Suggestion for the licence brief.** [testflight-licence-brief.md](../design/testflight-licence-brief.md)
asks only about an outside-tester test. Add a narrower first question: "Is an internal-only TestFlight
build, installed only by the owner, given to Apple under §6.6, a distribution?" If the reader says no
to that, TestFlight on the owner's devices could start before any outside tester does. Option B in the
decision record (upload a build without the GPL-derived verse links) remains the fallback.

## Sources

Fetched means I opened the page. Data file means Apple's page body was read from its JSON data file,
because the normal page renders blank to a fetch. Snippet means I saw only a search result.

- TestFlight overview, <https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview>: fetched
- Add internal testers, <https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers>: fetched
- TestFlight page, <https://developer.apple.com/testflight/>: fetched (source of the 30 devices)
- Upload builds, <https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds>: fetched
- Developer Program License Agreement (PDF, dated October 29, 2026), <https://developer.apple.com/support/downloads/terms/apple-developer-program/Apple-Developer-Program-License-Agreement-English.pdf>: fetched in full. §5.3, §6.5, §6.6, §6.9, §7.3, §7.4 read
- Complying with encryption export regulations, <https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations>: data file
- Privacy manifest files, <https://developer.apple.com/documentation/bundleresources/privacy-manifest-files>: data file
- Describing use of required reason API, <https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api>: data file
- App Sandbox, <https://developer.apple.com/documentation/security/app-sandbox> and Configuring the macOS App Sandbox, <https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox>: data file
- Running your iOS apps in macOS, <https://developer.apple.com/documentation/apple-silicon/running-your-ios-apps-in-macos>: data file
- Distributing your app for beta testing and releases, <https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases>: data file
- Distributing your app to registered devices, <https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices>: data file
- Test iPhone and iPad apps on Apple silicon Macs, <https://developer.apple.com/help/app-store-connect/test-a-beta-version/test-iphone-and-ipad-apps-on-macs-with-apple-silicon>: fetched
- Device Hub, <https://developer.apple.com/documentation/xcode/device-hub.md>: fetched. Managing devices in Device Hub, <https://developer.apple.com/documentation/xcode/managing-your-simulated-and-physical-devices-in-device-hub.md>: fetched. Managing apps on devices, <https://developer.apple.com/documentation/xcode/managing-apps-on-devices.md>: fetched
- Devices overview (limits), <https://developer.apple.com/help/account/devices/devices-overview>: fetched
- Distribute in-house apps (install links), <https://support.apple.com/guide/deployment/distribute-proprietary-in-house-apps-depce7cefc4d/web>: fetched
- Apple Configurator, add apps, <https://support.apple.com/guide/apple-configurator-mac/add-apps-to-a-device-cad4cd08c03/mac>: fetched. Connect devices page: fetched but came back empty, so the USB question is **unverified**
- Sandbox needed for TestFlight Mac builds, forum threads e.g. <https://developer.apple.com/forums/thread/702678>, <https://developer.apple.com/forums/thread/733942>: **snippet only**
- "Designed for iPad" destination for TestFlight on Mac, <https://developer.apple.com/forums/thread/813576>: **snippet only**
- Ad hoc install links via `itms-services`, third-party guides (e.g. <https://dev.to/kaushalrola/how-to-install-ipa-files-over-the-air-ota-4nh2>): **snippet only**
- Not read: App Store Connect Terms of Service; TestFlight Terms and Conditions, <https://www.apple.com/legal/internet-services/itunes/testflight/>
