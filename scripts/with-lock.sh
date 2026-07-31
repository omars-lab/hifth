#!/usr/bin/env bash
#
# Run a command while holding the shared working-tree lock.
#
#   scripts/with-lock.sh <label> <command> [args...]
#   scripts/with-lock.sh build "pnpm -r test"        # a single string also works
#
# Why this exists
# ---------------
# Parallel agents share one checkout and one branch. Two of them running a
# build, or staging an index, at the same time corrupts both. The lock is a
# `mkdir` on a directory: atomic on every filesystem we care about, no daemon,
# no dependency.
#
# The naive version of that — `until mkdir $L; do sleep 5; done` with a
# `trap "rmdir $L" EXIT` — deadlocked this repo twice in one morning, for ten
# and twenty minutes. Everything below is one of those failures written down:
#
#   1. THE LOCK RECORDED NO OWNER. When a holder died without its EXIT trap
#      firing, nothing could tell "held" from "abandoned". Diagnosis meant
#      pgrep-ing every waiter by hand to prove they were all parked in `sleep`.
#      Now the holder writes its PID, host, label and start time, and any
#      waiter can read them.
#
#   2. THE TRAP USED A RELATIVE PATH. It ran from whatever directory the
#      command left behind, so `rmdir .git/hifth-agent.lock` silently failed
#      and orphaned the lock. Every path here is absolute, resolved from the
#      script's own location before anything else runs.
#
#   3. RELEASE USED `rmdir`. The moment an owner file was written *into* the
#      lock directory, `rmdir` began failing with "Directory not empty" — the
#      hardening attempt created a fresh orphan. Release is `rm -rf`.
#
#   4. A DEAD HOLDER BLOCKED EVERYONE UNTIL A HUMAN INTERVENED. A waiter now
#      breaks a lock whose recorded PID is gone, and says so loudly.
#
#   5. IT COULD NOT RUN FROM A WORKTREE AT ALL. The lock lived at `$ROOT/.git/…`,
#      and in a linked worktree `.git` is a *file*, not a directory — so `mkdir`
#      failed with ENOTDIR on every single poll, forever, and the waiter sat
#      there silently until it hit the 30-minute timeout. An agent lost ninety
#      minutes to it. The lock now lives in the *common* git dir, which is the
#      only correct home for it anyway: worktrees are exactly the case the lock
#      exists to serialise, and a per-worktree lock would have serialised
#      nothing.
#
# What it deliberately does NOT do: it does not touch git. Committing is the
# caller's job, and the rule there is `git commit -F <msgfile> -- <explicit
# paths>`. A bare `git commit` commits the whole index, which in a shared tree
# means burying another agent's staged work inside your commit. That has also
# already happened once.
set -euo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The one lock every checkout of this repo shares.
#
# `--git-common-dir` is the point: from the main worktree it is `$ROOT/.git`, and
# from a linked worktree it is *still* the main repo's `.git` — where `$ROOT/.git`
# would be the gitdir *file* that worktree was created with, and `mkdir` on a path
# under a regular file fails with ENOTDIR on every poll until the timeout. It also
# happens to be the only home that makes the lock mean anything: agents in
# separate worktrees are precisely what it exists to serialise.
#
# Resolved to absolute (git answers relatively at a worktree root) and falls back
# to `$ROOT/.git` if git is unavailable, so the script still runs somewhere the
# repo has been exported rather than cloned.
_common_git_dir() {
  local d
  d="$(git -C "$ROOT" rev-parse --git-common-dir 2>/dev/null)" || { echo "$ROOT/.git"; return; }
  case "$d" in
    /*) echo "$d" ;;
    *) (cd "$ROOT/$d" && pwd) ;;
  esac
}
readonly LOCK="$(_common_git_dir)/hifth-agent.lock"
readonly OWNER="$LOCK/owner"

readonly WAIT_SECONDS="${HIFTH_LOCK_WAIT:-1800}"   # give up after 30 min
readonly POLL_SECONDS=5

if [ $# -lt 2 ]; then
  echo "usage: with-lock.sh <label> <command> [args...]" >&2
  exit 64
fi

label="$1"; shift

log() { echo "[lock:$label] $*" >&2; }

# Is the recorded holder still alive? A lock with no readable owner file is
# treated as alive: it may be a holder that has not finished writing it yet,
# and racing that is how you end up with two builders.
holder_is_alive() {
  local pid
  pid="$(awk -F= '/^pid=/{print $2}' "$OWNER" 2>/dev/null || true)"
  [ -z "$pid" ] && return 0
  kill -0 "$pid" 2>/dev/null
}

acquire() {
  local waited=0
  until mkdir "$LOCK" 2>/dev/null; do
    if ! holder_is_alive; then
      log "holder $(awk -F= '/^pid=/{print $2}' "$OWNER" 2>/dev/null) is gone — breaking abandoned lock"
      log "  it was: $(tr '\n' ' ' < "$OWNER" 2>/dev/null)"
      rm -rf "$LOCK"
      continue
    fi
    if [ "$waited" -ge "$WAIT_SECONDS" ]; then
      log "TIMEOUT after ${waited}s. Held by: $(tr '\n' ' ' < "$OWNER" 2>/dev/null || echo unknown)"
      log "  That holder is alive, so this is contention, not a deadlock — nothing was broken."
      exit 75   # EX_TEMPFAIL: retryable, distinct from the command's own failures
    fi
    # `|| true` matters: under `set -e` an && chain whose guard is false returns
    # nonzero and would kill the waiter mid-wait.
    if [ "$waited" -gt 0 ] && [ "$((waited % 60))" -eq 0 ]; then
      log "waiting ${waited}s for $(awk -F= '/^label=/{print $2}' "$OWNER" 2>/dev/null || echo 'an unnamed holder')"
    fi || true
    sleep "$POLL_SECONDS"
    waited=$((waited + POLL_SECONDS))
  done

  # Won the race. Record who we are so the next waiter can reason about us.
  {
    echo "pid=$$"
    echo "label=$label"
    echo "host=$(hostname -s)"
    echo "since=$(date '+%Y-%m-%d %H:%M:%S')"
    echo "cmd=$*"
  } > "$OWNER"
}

release() { rm -rf "$LOCK"; }

acquire "$@"
trap release EXIT INT TERM

log "acquired $(date '+%H:%M:%S')"
start=$SECONDS

# One argument means a shell string ("pnpm -r test && pnpm lint"); several mean
# an argv the caller already split. Both are useful and neither should be
# re-quoted by accident.
#
# `set +e` around it is required, not stylistic: with `set -e` a failing command
# exits here, the release log never prints, and the caller loses the exit code
# to the trap. The lock still releases — but silently, which is how you end up
# debugging the wrapper instead of the failure.
set +e
if [ $# -eq 1 ]; then
  bash -c "$1"
else
  "$@"
fi
status=$?
set -e

log "released after $((SECONDS - start))s (exit $status)"
exit $status
