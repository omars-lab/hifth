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
#
# Prints how many days the profile lasts and exits 0 when it is 30 days or
# more; a plain message and exit 1 otherwise.
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

days=$(( (ends - made) / 86400 ))
if [ "$days" -ge 30 ]; then
  echo "  The signing profile lasts $days days, so a paid team signed it."
  exit 0
fi

echo ""
echo "  The signing profile lasts only $days days: a free \"Personal Team\" signed it,"
echo "  so the app would stop opening on the iPad after that. The paid team's lasts"
echo "  a year. In Xcode → Settings → Accounts, check the team reads \"Developer Team\","
echo "  then build again. Nothing was installed."
echo ""
exit 1
