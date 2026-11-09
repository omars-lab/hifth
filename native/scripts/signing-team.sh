#!/bin/sh
# Prints the Apple team id the iPad install signs with: the "OU" field of the
# first Apple Development certificate in the keychain. The ten letters in
# brackets at the end of the certificate's name are the certificate's own id,
# not the team's, so they are never used.
#
#   signing-team.sh      read the certificate from the keychain
#   signing-team.sh -    read a PEM certificate from standard input (tests)
#
# Prints nothing when there is no certificate; the install step then says so.
if [ "$1" = "-" ]; then
  pem=$(cat)
else
  pem=$(security find-certificate -c "Apple Development" -p 2>/dev/null)
fi
[ -n "$pem" ] || exit 0
printf '%s\n' "$pem" | openssl x509 -noout -subject -nameopt multiline 2>/dev/null |
  sed -n 's/^ *organizationalUnitName *= *\([A-Z0-9]\{10\}\) *$/\1/p' | head -1
