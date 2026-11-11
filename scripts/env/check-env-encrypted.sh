#!/usr/bin/env sh
# check-env-encrypted.sh — no plaintext secret may enter this repo's history.
#
# From the cloudflare-onboarding skill (ported from bikar, 2026-11-11). A repo set
# up by that skill keeps a plaintext .env (ignored) and commits .env.encrypted,
# where every value is `encrypted:BB…`, readable only with the private key in
# .env.keys (ignored, backed up in LastPass). That committed copy is what lets a
# second machine rebuild .env from one LastPass entry.
#
# The ignore rules cannot tell a real encrypted copy from a plaintext file saved
# under the same name, or from a `.env` someone force-adds. This can. Any file
# named .env* that is staged or tracked must hold only ciphertext, and .env.keys
# may never be committed at all.
#
# Usage:
#   check-env-encrypted.sh --staged   # what is about to be committed (hook)
#   check-env-encrypted.sh            # what is tracked right now (make / CI)
#
# Exit 0 clean / 1 a violation or an unreadable line / 2 misuse. Needs no
# secrets, no network, and not even dotenvx — it reads shape, not content.

set -u

MODE="${1:-tracked}"

# .env.example is exempt and tracked on purpose: it is the key list a new
# machine reads before it has any keys. Its secret-bearing values are
# placeholders; the real ones it does carry (account IDs, project names,
# domains) are identifiers, not credentials. gitleaks still scans it.
ENV_PATTERN='(^|/)\.env($|\.)'
EXEMPT='(^|/)\.env\.example$'

case "$MODE" in
  --staged) files=$(git diff --cached --name-only --diff-filter=ACM) ;;
  tracked)  files=$(git ls-files) ;;
  # --file is for env-sync.sh, which needs to verify the sidecar it just wrote
  # BEFORE it is staged. Encrypting and not checking the result is how a
  # plaintext value ends up committed under a filename that says otherwise.
  --file)   files="${2:-}"; [ -n "$files" ] || { echo "usage: $0 --file <path>" >&2; exit 2; } ;;
  *) echo "usage: $0 [--staged | --file <path>]" >&2; exit 2 ;;
esac

candidates=$(printf '%s\n' "$files" | grep -E "$ENV_PATTERN" | grep -vE "$EXEMPT" || true)

work=$(mktemp) || exit 2
trap 'rm -f "$work"' EXIT INT TERM

violations=0
report() { violations=$((violations + 1)); echo "  $1" >&2; }

for f in $candidates; do
  # The private key. Never committed, in any repo, under any name — this is the
  # one file whose leak makes every encrypted value in the repo readable.
  case "$f" in
    *.keys|*.keys.*)
      report "BLOCK $f — this is the dotenvx PRIVATE KEY. It must never be committed."
      continue
      ;;
  esac

  # In --staged mode read the staged blob, not the worktree file: those differ
  # exactly when someone edits after `git add`, which is the case worth catching.
  if [ "$MODE" = "--staged" ]; then
    git show ":$f" >"$work" 2>/dev/null || { report "BLOCK $f — cannot read the staged blob."; continue; }
  else
    [ -f "$f" ] || continue
    cat "$f" >"$work"
  fi

  # Redirected, not piped: a `while` on the right of a pipe runs in a subshell
  # and its count of what it found dies with it.
  line_no=0
  while IFS= read -r line || [ -n "$line" ]; do
    line_no=$((line_no + 1))
    case "$line" in
      ''|'#/'*) continue ;;             # blank, or dotenvx's own `#/…` banner
      '#'*)
        # A commented-out KEY=value is where a plaintext secret hides in plain
        # sight: dotenvx leaves comments untouched when it encrypts, and a check
        # that skips every `#` line waves it straight through. Only a comment that
        # un-comments to a KEY=<plaintext> assignment is blocked; ordinary prose
        # comments (no `KEY=` shape) and commented ciphertext/empty values pass.
        ckey=$(printf '%s' "$line" | sed -n 's/^[[:space:]]*#[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}\([A-Za-z_][A-Za-z0-9_]*\)=.*$/\2/p')
        [ -z "$ckey" ] && continue
        case "$ckey" in DOTENV_PUBLIC_KEY*) continue ;; esac
        cval=$(printf '%s' "$line" | sed 's/^[[:space:]]*#[[:space:]]*//; s/^[^=]*=//; s/^["'\'']//; s/["'\'']$//')
        case "$cval" in
          encrypted:*|'') continue ;;
          *) report "BLOCK $f:$line_no — commented-out \`$ckey\` carries a PLAINTEXT value. dotenvx does not encrypt comments; delete the line." ;;
        esac
        continue
        ;;
    esac

    key=$(printf '%s' "$line" | sed -n 's/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}\([A-Za-z_][A-Za-z0-9_]*\)=.*$/\2/p')

    # A line this reader cannot classify is an error, not a skip. A checker that
    # silently ignores what it does not understand is a checker that waves
    # through the one file it existed to stop.
    if [ -z "$key" ]; then
      report "BLOCK $f:$line_no — not a comment and not KEY=value; cannot verify it is encrypted."
      continue
    fi

    case "$key" in
      DOTENV_PUBLIC_KEY*) continue ;;   # the public half; publishing it is the point
    esac

    value=$(printf '%s' "$line" | sed 's/^[^=]*=//; s/^["'\'']//; s/["'\'']$//')
    case "$value" in
      encrypted:*) ;;                   # good
      '') ;;                            # an empty value discloses nothing
      *) report "BLOCK $f:$line_no — \`$key\` is PLAINTEXT. Run: make env-encrypt" ;;
    esac
  done <"$work"
done

if [ "$violations" -gt 0 ]; then
  echo "" >&2
  echo "check-env-encrypted: $violations problem(s). Refusing." >&2
  echo "  This repo's .env files are committed ENCRYPTED. A plaintext value here" >&2
  echo "  would be published to GitHub, and a pushed credential is compromised" >&2
  echo "  whether or not the commit is later removed." >&2
  echo "  Encrypt:  make env-encrypt" >&2
  echo "  Verify:   make env-check" >&2
  exit 1
fi

echo "check-env-encrypted: OK (all committed env values are encrypted)."
exit 0
