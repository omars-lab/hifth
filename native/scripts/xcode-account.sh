#!/bin/sh
# Checks that Xcode is signed in to an Apple account that has a paid team.
#
# A signed build for a real iPhone, iPad or Mac asks Apple for the app's
# signing profile, and only a signed-in account can ask; without one Xcode
# fails minutes into the build with "No Accounts". And an account with only
# a free "Personal Team" can install, but that install stops opening after
# 7 days, where a paid team's lasts a year. This says so before the build.
#
#   xcode-account.sh      read Xcode's own settings
#   xcode-account.sh -    read that same settings text from standard input (tests):
#                         the account list, then the team list
#
# Quiet and exit 0 with a paid team; a plain message and exit 1 otherwise.
if [ "$1" = "-" ]; then
  accounts=$(cat)
  teams=$accounts
else
  accounts=$(defaults read com.apple.dt.Xcode DVTDeveloperAccountManagerAppleIDLists 2>/dev/null)
  teams=$(defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null)
fi

if ! printf '%s\n' "$accounts" | grep -q 'identifier'; then
  echo ""
  echo "  Xcode has no Apple account signed in, so it cannot ask Apple to sign the app."
  echo "  Open Xcode → Settings → Accounts → +, choose Apple ID, and sign in with the"
  echo "  account that holds the paid membership. Then run this again."
  echo ""
  exit 1
fi

printf '%s\n' "$teams" | grep -q 'isFreeProvisioningTeam = 0;' && exit 0

echo ""
echo "  Xcode is signed in, but it sees only a free \"Personal Team\" (or no team yet)."
echo "  An install from a free team stops opening after 7 days; the paid team's lasts a year."
echo "  Open Xcode → Settings → Accounts and click your account, so Xcode asks Apple"
echo "  again. The team should read your name with no \"(Personal Team)\" after it."
echo "  If it still says Personal Team, the membership may not be active yet: check"
echo "  https://developer.apple.com/account. Then run this again."
echo ""
exit 1
