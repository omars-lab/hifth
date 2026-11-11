#!/usr/bin/env bash
# dotenvx.sh — the ONE way these scripts run dotenvx. Sourced, never run.
# From the cloudflare-onboarding skill (ported from bikar's scripts/lib/dotenvx.sh).
#
# Pinned on purpose. dotenvx 1.x -> 2.x moved the private key: v2 puts it in the
# macOS Keychain and writes no .env.keys, which silently breaks the "back the key
# up in LastPass, pull it on the next machine" model. An unpinned `npx dotenvx`
# picks whatever is cached. Change the pin here and nowhere else.
DOTENVX="npx -y @dotenvx/dotenvx@2.28.0"

# --no-native turns off v2's Keychain / 1Password / Bitwarden use, so `encrypt`
# writes the key to .env.keys and `decrypt` reads the key ONLY from .env.keys.
# Without it a machine with no .env.keys could still decrypt from its Keychain,
# and the "no key file = refuse" checks would pass when they should not.
# shellcheck disable=SC2034  # used by every script that sources this
NO_NATIVE="--no-native"

# dotenvx lets an exported shell variable with the same name override the file's
# value, on encrypt, decrypt and get, without a word. Run it with the file's own
# key names removed from the environment so the file is the only source. Key
# NAMES are plaintext even in the encrypted copy, so reading them leaks nothing.
dotenvx_isolated() {
  local keyfile="$1"; shift
  local unsets="" n
  while IFS= read -r n; do
    [ -n "$n" ] && unsets="$unsets -u $n"
  done <<EOF
$(grep -oE '^(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*=' "$keyfile" | sed -E 's/^(export[[:space:]]+)?//; s/=$//')
EOF
  # shellcheck disable=SC2086
  env $unsets $DOTENVX "$@"
}

# Bare `node` on this Mac is v18, and dotenvx under it fails in ways that look
# like a wrong key or a missing permission. Refuse up front and say what to do.
need_dotenvx() {
  command -v npx >/dev/null 2>&1 || { echo "ERROR: npx not found. Node 20 or newer is needed (nvm use)." >&2; exit 1; }
  node -e 'process.exit(+process.versions.node.split(".")[0] < 20 ? 1 : 0)' 2>/dev/null || {
    echo "ERROR: Node $(node -v 2>/dev/null) is too old for dotenvx. Run: nvm use (Node 20 or newer)." >&2
    exit 1
  }
}
