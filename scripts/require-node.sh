#!/usr/bin/env bash
# Refuse to start a build on a node that cannot finish it.
#
# `make ci` promises "locally == green CI". On the wrong node it is a coin flip
# instead: nvm's default here was 18, and on 18 the vite build dies deep inside
# @rollup/plugin-terser → serialize-javascript with `ReferenceError: crypto is
# not defined` — 40 seconds in, with a stack that names neither node nor this
# repo. Everything before it passes, so the failure reads as a bundler bug.
#
# One line up front is worth more than any amount of debugging that trace. This
# runs before the first slow step of every build target.
#
# Two numbers, both read from files rather than written here:
#   - the floor comes from package.json `engines.node` — below it, hard fail;
#   - the reference comes from .nvmrc, which is also what CI's setup-node steps
#     read (node-version-file), so the version is named once rather than three
#     times. The e2e job is the exception and deliberately so: it runs inside
#     the pinned Playwright image and uses that image's node, which
#     gate:golden-env pins by its own argument.
# A major above the floor but different from CI's only warns: it will probably
# work, and blocking it would make .nvmrc a lockstep requirement rather than the
# version we actually test against.
set -euo pipefail

cd "$(dirname "$0")/.."

have=$(node --version 2>/dev/null || echo "none")
if [ "$have" = "none" ]; then
  echo "  ✗ node is not on PATH. Install it (see .nvmrc) and try again." >&2
  exit 1
fi

# ">=20" → 20. Deliberately simple: engines here is a floor, not a range.
floor=$(sed -n 's/.*"node"[[:space:]]*:[[:space:]]*"[^0-9]*\([0-9][0-9]*\).*/\1/p' package.json | head -1)
ci=$(tr -dc '0-9.' < .nvmrc | cut -d. -f1)
major=${have#v}
major=${major%%.*}

if [ -z "$floor" ] || [ -z "$ci" ]; then
  echo "  ✗ cannot read the required node version (package.json engines / .nvmrc)." >&2
  exit 1
fi

if [ "$major" -lt "$floor" ]; then
  cat >&2 <<EOF

  ✗ node $have is below this repo's floor of $floor (package.json engines.node).

    The build will not fail here — it will fail 40 seconds from now inside the
    bundler, with an error that names neither node nor this repo. Stopping now.

    Fix:  nvm install && nvm use        # reads .nvmrc ($ci)

EOF
  exit 1
fi

if [ "$major" != "$ci" ]; then
  echo "  ! node $have; CI runs $ci (.nvmrc). Above the floor, so proceeding — but a"
  echo "    green run here is not quite the same evidence as a green run in CI."
fi
