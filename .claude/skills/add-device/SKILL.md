---
name: add-device
description: Add a new iPad, iPhone or Mac to the devices the Hifth app can be installed on by cable, and see which devices are registered and how many of Apple's 100-a-year slots of each kind are left. Use when asked "add my iPad", "put the app on another device", "how many devices can we still add", "which devices are registered", when an install stops with "the signing profile does not list this iPad", or before showing the pitch on a borrowed device.
---

# Add a device

Apple lets a developer account register **100 devices of each kind** (iPhone, iPad, Apple Watch,
Mac, Apple TV, Apple Vision Pro) per membership year. A device removed during the year still
holds its slot until the year ends. So adding one is cheap, but it can't be undone until the
year ends. **Ask the owner before registering a device**, and say which slot it takes.

## The short version

| step | what | command |
|---|---|---|
| 1 | See what is registered, and the slots left | `make app-devices` |
| 2 | Ask the owner: register this device? (it takes one slot of its kind for the year) | AskUserQuestion |
| 3 | On the device: plug it in, unlock it, tap **Trust**, turn on **Developer Mode** (Settings → Privacy & Security; it restarts) | the owner, by hand |
| 4 | Register it and install | `make app-device-register DEVICE="<name>"` |
| 5 | After that, every release | `make app-release-ipad DEVICE="<name>"` |

The device's name is the one `xcrun devicectl list devices` prints (watch for the curly
apostrophe in names like "Omar Eid’s iPad").

## What each step does

**1. The device list.** `make app-devices` reads the signing profiles Xcode downloaded to this
laptop. They list every registered device of their platform. It matches each one against the
devices this Mac has seen, to get a name and kind. It prints ids shortened to their last 6
characters; `make app-devices CSV=1` gives a spreadsheet row per device with the full id. Keep
that file off the repo: device ids never go in a commit. The slot count is the most that could be
left. It can't see devices removed earlier this year, which still hold their slot. Apple's own
list is at <https://developer.apple.com/account/resources/devices/list>. Once an App Store
Connect key is on this laptop (the app-setup skill, step ⑤), the list could ask Apple directly;
that is in the backlog, not built.

**2. Ask.** A judgment call the owner makes. Lay out the choice: the slot it takes and how many
are left of that kind, against what the device is for (the pitch, a tester, a spare).

**4. Register and install.** `make app-device-register` builds the app with this device as the
destination and lets Xcode register it with Apple if it is not registered yet. That is
`-allowProvisioningDeviceRegistration`: a device that is already registered uses no new slot.
Then it runs the normal install, which checks that the signing profile lists the device before
copying anything. Without that check, the iPad refuses the app only after a full build and copy.
That happened on 2026-11-10.

> Not yet run on a real device: on 2026-11-10 the session was not allowed to run a command that
> registers devices with Apple. The first real run is on the manual-testing checklist; when it
> passes, delete this note.

## Scripts — when to use each

| script | what it does | when to reach for it | command |
|---|---|---|---|
| `scripts/device-list.mjs` | Lists the devices on this laptop's signing profiles, their kind and name, and the slots of each kind left at most | Before adding a device, or to answer "which devices are registered" | `make app-devices` (`CSV=1` for a spreadsheet) |
| `native/scripts/device-udid.mjs` (shared with the install) | Turns a device's name into the hardware id Apple and the profile use | Run by the register and install commands | `node native/scripts/device-udid.mjs --device "<name>"` |
| `native/scripts/profile-lasts.sh` (shared) | Stops the install when the profile does not list the device, or runs out within 30 days | Run by every install | `make app-device-install` |

## Open questions, and what would answer each

### ① How many slots are really left? · **open**

`make app-devices` counts the devices on this laptop's signing profiles. A device removed
earlier this year still holds its slot but is gone from the profiles, so the number shown is
the most that could be left. Apple's own device list knows the exact count. **What would answer
it:** once the App Store Connect key is on this laptop (app-setup skill, step ⑤), ask Apple's
list directly and keep the profile count for when there is no key.

## Related

- `native-shell` skill: building, testing and installing the app.
- `crash-logs` skill: what to do when the app closes on the new device.
- `app-setup` skill: the Apple account, the app ID and the upload key.
