#!/usr/bin/env bash
# env-set.sh NAME — save one secret: the owner types or pastes it at a hidden
# prompt, it goes into .env (mode 600), and the committed .env.encrypted is
# brought up to date. From the cloudflare-onboarding skill.
#
# The owner runs this in his OWN terminal, not through Claude (not even with
# `!`, which puts what is typed into the conversation). Why not `dotenvx set
# NAME value`: the value would sit in shell history and on the command line,
# and in this setup it would write ciphertext into the plaintext .env.
#
# The value is read at a hidden prompt (or from a pipe, for tests), passed to
# the writer on stdin, and never printed or put in a command line.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAME="${1:-}"
FILE="${2:-.env}"
[ -n "$NAME" ] || { echo "usage: $0 NAME [file]   (then type the value at the hidden prompt)" >&2; exit 2; }

# Check Node before asking for or writing anything: otherwise the value lands in
# .env and the encrypt step then refuses, leaving the committed copy behind.
# shellcheck source=lib/dotenvx.sh
. "$HERE/lib/dotenvx.sh"
need_dotenvx

if [ -t 0 ]; then
  printf 'Paste the value for %s (it will not show), then press Return: ' "$NAME" >&2
  IFS= read -rs value; echo >&2
else
  IFS= read -r value || true
fi

printf '%s\n' "$value" | python3 "$HERE/lib/envfile.py" set "$NAME" "$FILE" || { unset value; exit 1; }
unset value

bash "$HERE/env-sync.sh" encrypt || exit 1
echo "  Next: commit .env.encrypted. If a new key was made, back it up: make env-keys-push"
