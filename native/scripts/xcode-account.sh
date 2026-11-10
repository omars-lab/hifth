#!/bin/sh
# Checks that an Apple account is signed in to Xcode. A signed build for a
# real iPhone, iPad or Mac asks Apple for the app's signing profile, and only
# a signed-in account can ask; without one Xcode fails minutes into the build
# with "No Accounts". This says so before the build starts.
#
#   xcode-account.sh      read Xcode's own settings
#   xcode-account.sh -    read that same settings text from standard input (tests)
#
# Quiet and exit 0 with an account; a plain message and exit 1 without.
if [ "$1" = "-" ]; then
  lists=$(cat)
else
  lists=$(defaults read com.apple.dt.Xcode DVTDeveloperAccountManagerAppleIDLists 2>/dev/null)
fi
printf '%s\n' "$lists" | grep -q 'identifier' && exit 0
echo ""
echo "  Xcode has no Apple account signed in, so it cannot ask Apple to sign the app."
echo "  Open Xcode → Settings → Accounts → +, choose Apple ID, and sign in with the"
echo "  account that holds the paid membership. Then run this again."
echo ""
exit 1
