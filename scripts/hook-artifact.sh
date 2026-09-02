#!/usr/bin/env bash
# The reminder that runs the moment a page is published.
#
# Wired as a PostToolUse hook in .claude/settings.json. Its whole job is to find
# node and hand the hook's payload to scripts/artifact-sweep.mjs, which decides
# whether docs/artifacts.json already knows about the page that just went out.
#
# Why a shell wrapper rather than `node scripts/artifact-sweep.mjs --hook`
# straight in the settings file: settings.json is checked in and therefore
# shared, and a hook runs in whatever environment the editor happens to have. On
# a machine where node lives under nvm and nothing has sourced it, the bare form
# fails with `node: command not found` — and a hook that fails is reported as an
# error against the publish that just succeeded. That teaches people to delete
# the hook. So: look for node, and if there is genuinely none, say nothing and
# leave. A reminder that cannot run must not be mistaken for a broken publish.
#
# `set -e` is deliberately NOT set. Nothing this script can encounter is worth
# interrupting a publish over.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 0

if ! command -v node >/dev/null 2>&1; then
  # nvm keeps its versions in one of two places depending on how it was
  # installed. Take the last match rather than the first: the glob sorts
  # lexically, so the last is the newest of a same-major set, and this repo's
  # floor is well below anything nvm has installed recently.
  for dir in "$HOME/.nvm/versions/node"/*/bin /usr/local/bin/nvm/versions/node/*/bin; do
    [ -x "$dir/node" ] && found="$dir"
  done
  [ -n "${found-}" ] && PATH="$found:$PATH"
fi

command -v node >/dev/null 2>&1 || exit 0

exec node scripts/artifact-sweep.mjs --hook
