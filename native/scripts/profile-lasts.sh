#!/bin/sh
# Says how long an app built for a real iPad will keep opening, and stops the
# install when a free team signed it.
#
# The build puts the signing profile Apple gave it inside the app. A paid
# team's profile lasts a year; a free "Personal Team"'s lasts 7 days, after
# which the app stops opening on the iPad. This reads the profile itself,
# because Xcode's saved settings can still say "Personal Team" after the
# paid team shows in its Accounts screen (seen 2026-11-09).
#
#   profile-lasts.sh <path/to/Hifth.app>   read the profile inside the built app
#   profile-lasts.sh -                     read the profile's text from standard input (tests)
#   profile-lasts.sh <app or -> <udid>     also stop when the profile does not list that iPad
#                                          (device-udid.mjs finds the id from the iPad's name)
#
# Counts from today, not from when the profile was made: Xcode can reuse a
# profile months later, and what matters is whether it outlasts the pitch.
# PROFILE_NOW (like 2026-11-09T12:00:00Z) stands in for today in the tests.
#
# Prints how many days the profile has left and exits 0 when it is 30 days
# or more; a plain message and exit 1 otherwise.
if [ "$1" = "-" ]; then
  plist=$(cat)
else
  plist=$(security cms -D -i "$1/embedded.mobileprovision" 2>/dev/null)
fi

field() {
  printf '%s\n' "$plist" | plutil -extract "$1" raw -o - - 2>/dev/null
}
seconds() {
  date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$1" +%s 2>/dev/null
}

made=$(seconds "$(field CreationDate)")
ends=$(seconds "$(field ExpirationDate)")
if [ -z "$made" ] || [ -z "$ends" ]; then
  echo ""
  echo "  The built app has no signing profile this can read, so there is no telling"
  echo "  how long it would keep opening on the iPad. Build it again for a real device"
  echo "  (not the simulator) and run this again."
  echo ""
  exit 1
fi

# The plugged-in iPad must be in the profile, or the iPad refuses the app
# ("This provisioning profile cannot be installed on this device"), and only
# after a full build and copy (seen 2026-11-10).
if [ -n "$2" ] && ! printf '%s\n' "$plist" | plutil -extract ProvisionedDevices json -o - - 2>/dev/null | grep -q "\"$2\""; then
  echo ""
  echo "  The signing profile does not list this iPad, so the iPad would refuse the app."
  echo "  Register it in Xcode → Window → Devices and Simulators (it uses one of the"
  echo "  account's 100 iPad slots for the year), or let Xcode add it by building with"
  echo "  the iPad picked as the destination, then run this again. Nothing was installed."
  echo ""
  exit 1
fi

if [ -n "$PROFILE_NOW" ]; then now=$(seconds "$PROFILE_NOW"); else now=$(date +%s); fi
lasts=$(( (ends - made) / 86400 ))
days=$(( (ends - now) / 86400 ))
if [ "$days" -ge 30 ]; then
  echo "  The signing profile has $days days left, so the app keeps opening on the iPad until then."
  exit 0
fi

if [ "$lasts" -ge 30 ]; then
  echo ""
  echo "  The signing profile has only $days days left, so the app would stop opening"
  echo "  on the iPad soon. Xcode reused an old profile. Delete it from"
  echo "  ~/Library/Developer/Xcode/UserData/Provisioning Profiles and build again, so"
  echo "  Xcode asks Apple for a new one. Nothing was installed."
  echo ""
  exit 1
fi

echo ""
echo "  The signing profile lasts only $lasts days: a free \"Personal Team\" signed it,"
echo "  so the app would stop opening on the iPad after that. The paid team's lasts"
echo "  a year. In Xcode → Settings → Accounts, check the team reads \"Developer Team\","
echo "  then build again. Nothing was installed."
echo ""
exit 1
