#!/usr/bin/env bash
# env-keys.sh — move .env.keys between this machine and LastPass.
# From the cloudflare-onboarding skill (copied from bikar's scripts/env-keys.sh).
#
# `lpass login` and the push itself are the owner's to run: login asks for his
# password and second factor, and push overwrites the vault copy.
#
# .env.keys holds the dotenvx PRIVATE key. It is the one file that is never
# committed and never backed up anywhere but the vault: with it, every value in
# the committed .env.encrypted is readable; without it, none are.
#
# The vault entry is named after the repository — `dotenvx/<repo>` — because
# these sibling repos will not share a keypair. One entry per repo means a
# rotation in one cannot silently invalidate another, and the entry name tells
# you which checkout it belongs to without opening it.
#
# Usage:
#   env-keys.sh pull    LastPass -> .env.keys   (new machine; refuses to clobber)
#   env-keys.sh push    .env.keys -> LastPass   (after minting or rotating a key)
#   env-keys.sh status  is a key present here, in the vault, and do they match?
#
# The key value is never passed as a command-line argument (argv is world-
# readable via ps), never echoed, and never written to a temp file. It moves
# through a pipe or not at all. `status` compares fingerprints, not keys.
set -uo pipefail

CMD="${1:-}"
KEYFILE=".env.keys"
# Derive the entry name from the origin remote, not the directory: this repo is
# routinely checked out under worktree names like `bikar-lego-lab`, and a
# directory-derived name would silently mint a second vault entry per worktree.
REPO_NAME=$(basename -s .git "$(git remote get-url origin 2>/dev/null)" 2>/dev/null)
[ -n "$REPO_NAME" ] || REPO_NAME=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
ENTRY="dotenvx/${REPO_NAME}"

die() { echo "ERROR: $*" >&2; exit 1; }

need_lpass() {
  command -v lpass >/dev/null 2>&1 || die "lpass not installed. Run: brew install lastpass-cli"
  # `lpass login` is interactive (it prompts for a password, and for 2FA). It
  # cannot be driven from here, so say what to run rather than hanging on a
  # prompt nobody can see.
  lpass status >/dev/null 2>&1 || {
    echo "Not logged in to LastPass. Run this yourself, then re-run:" >&2
    echo "    lpass login <your-lastpass-email>" >&2
    exit 1
  }
}

# A short, non-reversible fingerprint, so `status` can answer "do these match?"
# without either copy of the key reaching the terminal.
fingerprint() { shasum -a 256 | cut -c1-12; }

cmd_pull() {
  need_lpass
  [ -f "$KEYFILE" ] && die "$KEYFILE already exists. Refusing to overwrite a key that is already here.
  If you are deliberately replacing it:  mv $KEYFILE $KEYFILE.old && make env-keys-pull"
  lpass show --notes "$ENTRY" > "$KEYFILE" 2>/dev/null \
    || { rm -f "$KEYFILE"; die "no LastPass entry '$ENTRY' (or it has no note). Create it with: make env-keys-push"; }
  [ -s "$KEYFILE" ] || { rm -f "$KEYFILE"; die "LastPass entry '$ENTRY' is empty."; }
  grep -q '^DOTENV_PRIVATE_KEY' "$KEYFILE" || {
    rm -f "$KEYFILE"
    die "'$ENTRY' does not look like a .env.keys file (no DOTENV_PRIVATE_KEY line). Nothing written."
  }
  chmod 600 "$KEYFILE"
  echo "  pulled     $ENTRY -> $KEYFILE  (mode 600, $(grep -c '^DOTENV_PRIVATE_KEY' "$KEYFILE") key(s))"
  echo "  key names: $(grep -o '^DOTENV_PRIVATE_KEY[A-Z_]*' "$KEYFILE" | tr '\n' ' ')"
  echo "  Next:      make env-bootstrap"
}

cmd_push() {
  need_lpass
  [ -f "$KEYFILE" ] || die "$KEYFILE not found — nothing to push."
  # Piped, never argv: a key passed as an argument is visible to every process
  # on the machine for as long as the command runs, and lands in shell history.
  if lpass show --name "$ENTRY" >/dev/null 2>&1; then
    lpass edit --non-interactive --sync=now --notes "$ENTRY" < "$KEYFILE" \
      || die "lpass edit failed for '$ENTRY'"
    echo "  updated    $KEYFILE -> $ENTRY"
  else
    lpass add --non-interactive --sync=now --notes "$ENTRY" < "$KEYFILE" \
      || die "lpass add failed for '$ENTRY'"
    echo "  created    $KEYFILE -> $ENTRY"
  fi
  echo "  key names: $(grep -o '^DOTENV_PRIVATE_KEY[A-Z_]*' "$KEYFILE" | tr '\n' ' ')"
}

cmd_status() {
  local here="(absent)" there="(absent)"
  [ -f "$KEYFILE" ] && here=$(fingerprint < "$KEYFILE")
  if command -v lpass >/dev/null 2>&1 && lpass status >/dev/null 2>&1; then
    # Read through a fresh sync, not the local cache. Observed 2026-07-31:
    # `env-keys.sh push` succeeded and `status` immediately after reported
    # "key is NOT backed up" — the entry existed in the vault but not yet in
    # this machine's cache. That false alarm invites a redundant push, and a
    # push is the one operation here that overwrites the vault copy.
    lpass sync >/dev/null 2>&1 || true
    there=$(lpass show --notes "$ENTRY" 2>/dev/null | fingerprint) || there="(absent)"
    [ "$there" = "$(printf '' | fingerprint)" ] && there="(absent)"
  else
    there="(not logged in)"
  fi
  echo "  entry      $ENTRY"
  echo "  local      $KEYFILE  $here"
  echo "  vault      $there"
  if [ "$here" = "$there" ] && [ "$here" != "(absent)" ]; then
    echo "  ✓ in sync"
  elif [ "$here" = "(absent)" ]; then
    echo "  → no local key. Run: make env-keys-pull"
  elif [ "$there" = "(absent)" ]; then
    echo "  → key is NOT backed up. Run: make env-keys-push"
    echo "    Until you do, losing this machine loses every secret in .env.encrypted."
    exit 1
  elif [ "$there" != "(not logged in)" ]; then
    echo "  ✗ THEY DIFFER. One of them cannot decrypt .env.encrypted."
    echo "    Do not run 'make env-keys-push' blindly — that would overwrite the"
    echo "    vault copy. Work out which key opens the committed sidecar first."
    exit 1
  fi
}

case "$CMD" in
  pull)   cmd_pull ;;
  push)   cmd_push ;;
  status) cmd_status ;;
  *) echo "usage: $0 {pull|push|status}" >&2; exit 2 ;;
esac
