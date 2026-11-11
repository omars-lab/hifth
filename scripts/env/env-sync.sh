#!/usr/bin/env bash
# env-sync.sh — keep the committed encrypted copy in step with the local .env.
# From the cloudflare-onboarding skill (ported from bikar's scripts/env-sync.sh).
#
#   .env              plaintext, ignored     <- every script and Make target reads this
#   .env.encrypted    ciphertext, COMMITTED  <- what a new machine clones
#   .env.keys         private key, ignored   <- backed up in LastPass (env-keys.sh)
#
# Why a separate encrypted copy and not dotenvx's own "encrypt .env in place":
# every existing reader of .env (`set -a; . .env`, `grep | xargs`, `dotenvx run`
# with no key) keeps working unchanged, and none of them can ever hand a
# literal `encrypted:BB…` string onward as if it were the value. The cost is
# drift (.env edited, copy not regenerated); `check` makes that loud.
#
# Usage:
#   env-sync.sh encrypt     .env -> .env.encrypted   (env-set.sh runs this for you)
#   env-sync.sh check       do the two hold the same keys and values?
#   env-sync.sh bootstrap   .env.encrypted -> .env   (a new machine, after env-keys.sh pull)
#
# Never prints a value. Key names only.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/dotenvx.sh
. "$HERE/lib/dotenvx.sh"

CMD="${1:-}"
die() { echo "ERROR: $*" >&2; exit 1; }

# Plaintext files and their encrypted copies, found rather than listed, so a new
# .env.<name> is covered the day it is made.
plaintext_files() {
  for f in .env .env.*; do
    [ -e "$f" ] || continue
    case "$f" in
      *.encrypted|*.example|*.keys|*.keys.*|*.bak|*.orig) continue ;;
    esac
    echo "$f"
  done
}

sidecar_files() {
  for f in .env.encrypted .env.*.encrypted; do
    [ -e "$f" ] && echo "$f"
  done
}

# ── encrypt ─────────────────────────────────────────────────────────────────
# The trap: regenerate the copy with no public-key line and no .env.keys on disk,
# and dotenvx mints a NEW keypair. The key in LastPass then opens nothing, and
# nothing errors until the next machine tries. So the existing public-key line
# is carried over, and a run that would mint a new pair says so out loud.
cmd_encrypt() {
  need_dotenvx
  local any=0
  for f in $(plaintext_files); do
    any=1
    local sidecar="$f.encrypted" header=""
    [ -f "$sidecar" ] && header=$(grep -E '^DOTENV_PUBLIC_KEY[A-Z_]*=' "$sidecar" || true)
    if [ -z "$header" ] && [ ! -f .env.keys ]; then
      echo "NOTE: $sidecar has no public key and .env.keys is absent."
      echo "      This run MAKES A NEW KEY. Anything encrypted with an older key"
      echo "      becomes unreadable. If you meant to reuse the key: make env-keys-pull"
    fi
    # Only KEY=value lines go in: dotenvx does not encrypt comments, so a
    # commented-out secret in .env would ride into the committed copy as plaintext.
    { [ -n "$header" ] && echo "$header"; grep -vE '^[[:space:]]*(#|$)' "$f"; } > "$sidecar"
    dotenvx_isolated "$f" encrypt $NO_NATIVE --no-armor -f "$sidecar" >/dev/null 2>&1 \
      || die "dotenvx could not encrypt $sidecar"
    sh "$HERE/check-env-encrypted.sh" --file "$sidecar" >/dev/null \
      || die "$sidecar still holds a plaintext value after encrypting."
    echo "  encrypted  $f -> $sidecar"
  done
  [ "$any" = 1 ] || die "no plaintext .env files in $(pwd)"
  [ -f .env.keys ] && chmod 600 .env.keys
  cmd_check
}

# ── check ───────────────────────────────────────────────────────────────────
# Compares names AND values; reports names only. Values are compared inside
# python, so none is echoed, put in a shell word, or written to a temp file.
# `decrypt`, not `get`: get expands $VAR inside values, decrypt returns them as stored.
cmd_check() {
  need_dotenvx
  local rc=0 any=0
  for sidecar in $(sidecar_files); do
    any=1
    local f="${sidecar%.encrypted}"
    if [ ! -f "$f" ]; then
      echo "  skip       $sidecar (no local $f; run: make env-bootstrap)"
      continue
    fi
    local decrypted
    decrypted=$(dotenvx_isolated "$sidecar" decrypt $NO_NATIVE --stdout -f "$sidecar" 2>/dev/null) || {
      echo "  FAIL       $sidecar cannot be decrypted. Is .env.keys here? (make env-keys-pull)" >&2
      rc=1; continue
    }
    DEC_ENV="$decrypted" python3 "$HERE/lib/envfile.py" compare "$f" "$sidecar" || rc=1
  done
  [ "$any" = 1 ] || echo "  (no encrypted copies in $(pwd); nothing to compare)"
  return $rc
}

# ── bootstrap ───────────────────────────────────────────────────────────────
# A second machine from one LastPass entry. Never overwrites an existing .env.
cmd_bootstrap() {
  need_dotenvx
  [ -f .env.keys ] || die ".env.keys not found. Run: make env-keys-pull"
  local any=0
  for sidecar in $(sidecar_files); do
    any=1
    local f="${sidecar%.encrypted}"
    if [ -f "$f" ]; then
      echo "  skip       $f already exists (not overwriting; move it aside first if you mean to)"
      continue
    fi
    ( umask 077
      dotenvx_isolated "$sidecar" decrypt $NO_NATIVE --stdout -f "$sidecar" 2>/dev/null \
        | grep -vE '^#/|^DOTENV_PUBLIC_KEY[A-Z_]*=' > "$f" ) \
      || die "could not decrypt $sidecar (is .env.keys the right key?)"
    [ -s "$f" ] || { rm -f "$f"; die "decrypting $sidecar gave an empty $f"; }
    chmod 600 "$f"
    echo "  bootstrapped  $sidecar -> $f  ($(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "$f") keys, mode 600)"
  done
  [ "$any" = 1 ] || die "no .env*.encrypted files here; nothing to rebuild from"
  cmd_check
}

case "$CMD" in
  encrypt)   cmd_encrypt ;;
  check)     cmd_check ;;
  bootstrap) cmd_bootstrap ;;
  *) echo "usage: $0 {encrypt|check|bootstrap}" >&2; exit 2 ;;
esac
