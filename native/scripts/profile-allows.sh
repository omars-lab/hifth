#!/bin/sh
# Says whether a signing profile allows one permission, such as Sign in with
# Apple, without printing anything else from it. A profile holds the team id in
# several places, so it is never shown whole; this prints the profile's name,
# which devices it is for, whether it is for the store or for development, and
# yes or no.
#
#   profile-allows.sh <profile file> <permission>   one profile
#   profile-allows.sh --installed <permission>      every profile Xcode has downloaded
#   profile-allows.sh - <permission>                a profile's text on standard input (tests)
#
# <permission> is the key Apple uses, like com.apple.developer.applesignin.
# Exits 0 when every profile read allows it, 1 when one does not, 2 when a
# profile cannot be read.
key="$2"
[ -n "$key" ] || { echo "usage: profile-allows.sh <profile | --installed | -> <permission>"; exit 2; }

one() {
  plist="$1"
  field() { printf '%s\n' "$plist" | plutil -extract "$1" raw -o - - 2>/dev/null; }
  name=$(field Name)
  if [ -z "$name" ]; then
    echo "  cannot read this profile."
    return 2
  fi
  case "$(field Platform.0)" in
    OSX) devices="Mac" ;;
    iOS) devices="iPad and iPhone" ;;
    *) devices="unknown devices" ;;
  esac
  # A store profile lists no devices; a development or test profile does.
  if printf '%s\n' "$plist" | plutil -extract ProvisionedDevices raw -o - - >/dev/null 2>&1 ||
     [ "$(field ProvisionsAllDevices)" = "true" ]; then
    kind="development"
  else
    kind="store"
  fi
  # Look for the key among the permission names only; their values hold the team id.
  if printf '%s\n' "$plist" | plutil -extract Entitlements xml1 -o - - 2>/dev/null |
     grep -q "^[[:space:]]*<key>$key</key>"; then
    answer=yes
  else
    answer=no
  fi
  echo "  $name ($devices, $kind): allows $key: $answer"
  if [ "$answer" = no ]; then
    echo "    Tick it on the app's ID in Apple's developer site (Certificates, Identifiers & Profiles,"
    echo "    Identifiers), then let Xcode download the profile again."
    return 1
  fi
  return 0
}

status=0
if [ "$1" = "-" ]; then
  one "$(cat)" || status=$?
elif [ "$1" = "--installed" ]; then
  found=0
  for f in "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/"*.provisionprofile \
           "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/"*.mobileprovision; do
    [ -f "$f" ] || continue
    found=1
    one "$(security cms -D -i "$f" 2>/dev/null)" || { s=$?; [ "$s" -gt "$status" ] && status=$s; }
  done
  [ "$found" = 1 ] || { echo "  Xcode has downloaded no signing profiles on this Mac."; status=2; }
else
  one "$(security cms -D -i "$1" 2>/dev/null)" || status=$?
fi
exit "$status"
