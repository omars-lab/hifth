# Running agents in parallel on one tree

Loop 6a was written by three agents at once, into **one checkout on one branch**. It
worked — no lost edits, no rebase — and it cost about thirty minutes of deadlock plus one
defect that only existed once every agent's work was mounted together. This file is that
experience written down so the next parallel loop pays the tuition once.

It is a protocol for *agents*, and it is deliberately short. Everything here exists
because its absence broke something.

## The shape

**One tree, one branch, many commits.** Agents do not get worktrees or feature branches.
The tree is shared on purpose: it is the only configuration where an agent discovers that
its own correct change breaks a peer's correct change *while there is still time to fix
it*. Isolation would defer every collision to a merge that nobody scheduled.

The cost is that the working tree is a shared mutable resource, and the two rules below
are what keep it from being a corrupted one.

## Rule 1 — take the lock for anything that builds, installs, or stages

```bash
scripts/with-lock.sh <label> "<command>"      # or:  make lock L=build CMD="pnpm -r test"
```

Two agents running `pnpm build` at the same time write the same `dist/`. Two agents
staging at the same time interleave one index. Both produce failures that read as bugs in
the code rather than in the choreography, which is the expensive kind.

The lock is a `mkdir` on `.git/hifth-agent.lock` — atomic everywhere, no daemon, no
dependency. `with-lock.sh` records the holder's PID, label and start time inside it, and a
waiter breaks a lock whose PID is gone. Read the header of that script before changing it:
every defensive line in it is a specific failure (a relative path in an `EXIT` trap firing
from the wrong directory; `rmdir` refusing a non-empty lock; an owner-less lock nobody
could diagnose).

`make lock-status` says who holds it, or that nobody does.

**Do not clear another agent's lock, and never ask a peer to run a command your own
permission check refused.** That happened in Loop 6a; the peer refused, and was right to.
Permission laundering is still laundering when the command turns out to be harmless. If a
lock looks stuck, look at `make lock-status`: a live PID is contention, not a deadlock.

## Rule 2 — commit by explicit path, with a message file

```bash
git commit -F <msgfile> -- <path> [<path>...]
```

A bare `git commit` commits the whole index. In a shared tree that means burying a peer's
staged work inside your commit, where they will not find it and cannot cleanly revert it.
Name every path you mean. This has already gone wrong once.

Two corollaries:

- **Never `--no-verify`.** The pre-commit hook is the gitleaks secret scan. An agent that
  skips it is the one case the scan exists for.
- **A change that only compiles as a set commits as a set.** Loop 6a produced an untracked
  new module plus edits to five files that referenced it; committing any subset would have
  put a red tree on the branch. If you cannot commit the whole thing, hand it over rather
  than committing half.

## What each agent must not touch

- `docs/PLAN.md` and `docs/decisions/**` belong to the orchestrator. Agents report findings
  in their final message; the orchestrator decides what becomes a follow-up. Three agents
  editing the plan concurrently produces a plan nobody wrote.
- Another agent's assigned files. Propose the change to them instead — twice in Loop 6a a
  refused suggestion turned out to be the better call, and the argument itself is what
  produced the decision worth recording.

## The merge pass is not optional

Every agent's work passing its own tier proves nothing about the product. Loop 6a's real
defect was **semantic and composite**: two agents each added an in-flow strip above the
stage, each for the same good reason (neither may cover an ayah), and stacked they ate a
third of a phone's stage on the first-run visit. Neither agent could have seen it. It was
resolved in the one place that can see both.

So the loop budgets a final pass, run by the orchestrator on the merged tree:

```bash
make loop-verify        # ci mirror + e2e + lighthouse
```

plus a first-run check on a small viewport, because composition defects concentrate in the
chrome. Expect the merge pass to find something. In Loop 6a it also found a test that had
been green for a whole loop for the wrong reason — see
[`loop-6a.md`](decisions/loop-6a.md) §The merge pass, and `apps/web/e2e/ayah.ts`.

## Kicking one off

Give each agent: its scope, the files it owns, the two rules above, the instruction not to
touch the plan or the decision records, and the requirement that its final message name
everything it declined, deferred, or found outside its scope. That last part is what the
orchestrator merges — the code is usually the easy half.
