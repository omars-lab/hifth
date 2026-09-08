# When a new way of taking in Qur'an data arrives, how does it join the ways already here?

**Decided — one shared plugin interface (option B), by omar on 2026-09-07.**

## A few words first

- **Outside library** — the public collection of Qur'an data this project draws on (page
  layouts, per-word text, look-alike verse pairs, and more).
- **A ruler** — something outside the project we measure our own work against but copy nothing
  from, the way you check a drawing against a straight edge without tracing it.
- **The held copy** — a copy of some of the outside library kept in a database the owner
  controls, off the code and off what the app ships, so the building tools can read it.

## What is being decided?

The app now has two different ways of taking in Qur'an data. The first, and older, builds the
app's own pages and word groupings from what the project already owns, and checks them against
outside rulers without keeping any of the rulers' own bytes. The second holds a copy of the
outside library's page pieces, so the tools can draw our own page and stand it beside the
printed one to check it. The question is how the second one joins the first — and how a third,
whenever it comes, joins both.

## Why is this being asked now?

Because the second way has just become real. Until this month the project had only the first,
so there was nothing to fit anything into. The moment a second arrived, there was a fork in the
road: bolt it onto the existing build as a special case, or decide once how any number of
sources sit side by side. Deciding it now, with exactly two, is far cheaper than deciding it
later with five and a tangle of special cases already set.

## What happens if nobody decides?

The second source becomes a script off to the side that nobody's build knows about — run by
hand, remembered by one person, and easy to let rot. Or worse, it gets wired straight into the
shipping build as a branch, and now the build that must stay checkable offline and identical
byte-for-byte depends on a database and a copy of outside text. Both are the kind of mess that
is invisible for a while and expensive to unpick once a third source has copied the pattern.

## What does the app do today, and what does it cost?

Today the shipping build is a fixed chain of four steps run one after another. It reads only
what is in the project and writes only what ships, so it needs no database and no network, and
its whole output can be re-derived and compared byte-for-byte on a fresh checkout. That is a
real strength and the decision must not spend it. The cost is only that the chain is a hard-coded
list with no room in its shape for a second kind of source: a new source has nowhere to be
except appended to the same line, which is exactly how the held copy would have ended up wired
into the shipping build by accident.

## What do other projects do about this?

This is an ordinary software pattern — a program that can take in more than one kind of thing
gives each kind the same named shape and keeps a list of them, rather than a branch per kind.
Build tools, editors, and data pipelines converge on it because the alternative — a special
case per source — is the thing everyone regrets. We did not survey specific mus'haf projects
for this; the pattern is general and the reasons for it do not depend on the subject being
Qur'an data. So it is named here as the well-worn default it is, not as a claim about what any
particular other app does.

## What have we already decided that touches this?

Two decisions rule out half the space before the options even open:

- The decision on **whether the app may hold a copy of the outside library at all** settled
  that it may — but only in a store the owner controls, off the code and off what ships, and
  only after each item's licence is read. That means the held-copy source can never be folded
  into the shipping build, because the shipping build must stay copy-free and offline. Any
  option that blurs the two is already off the table.
- The decision on **what the held copy is for** settled that it draws our own page to check the
  printed one against — a checking tool, not part of what readers receive. So the held-copy
  source is, by design, a thing that ships nothing. An interface that assumed every source
  ships would not fit it.

Both point the same way: the two sources are genuinely different in what they touch and what
they produce, so they need a shape that holds two unlike things as equals — not one built around
the first with the second bolted on.

## The options

**Option A — fold each new source into the existing build chain.** Add the held copy as more
steps on the same line. Cheapest today, and wrong tomorrow: it drags a database and a copy of
outside text into the build that must stay offline and copy-free, and it makes the shipping
build fail on a clean checkout the moment it reaches for a store that isn't there. It also
teaches the next source to do the same.

**Option B — one shared interface every source enters by (chosen).** Each source is a named
thing of the same shape: what it reads, what it writes, what it needs, and how to run it. A
small list holds them; one runner drives whichever is asked for. The shipping sources run under
the plain everyday command and stay byte-for-byte checkable; the held copy is one named command
away and keeps its own licence gate inside itself. Adding a third source is adding one file and
one line, and nothing about the runner changes. Slightly more scaffolding than option A on day
one, and it pays for itself the first time a source needs anything the build cannot have.

**Option C — keep the held copy as a separate script nobody's build knows about.** No wiring
at all: the held copy stays a thing you run by hand. Honest about the two being different, but
it leaves the second source undiscoverable — not in any list, not in any runner — so it is the
one that rots. It also answers nothing about the third source, which will face this same fork
again with no precedent to follow.

## What else could we consider, and why is it not here?

We could have made the held copy a genuinely separate program in its own right — its own tree,
its own tooling — rather than a source alongside the first. Left off because it is option C's
undiscoverability with more ceremony: the point of a shared shape is that a reader finds every
source in one place, and a wholly separate program is the opposite of that.

## What would change the answer?

If it turned out the app only ever had one way of taking in Qur'an data — if the held copy were
abandoned and nothing replaced it — then the shared interface would be scaffolding around a
single thing, and option A's plain chain would be the honest shape. The interface earns its keep
exactly when there is more than one source, which there now is, and more coming.

## What this is not settling

It does not settle whether any particular future source is worth adding — only how one joins if
it is. It does not settle what the held copy contains beyond what the earlier two decisions
fixed. And it does not change one byte of what the app ships: the shipping build runs the same
steps in the same order and produces the same output; only the door it enters by is now shared.

## Appendix — where this lives in the code

The shape is the `etl-plugins` feature in the code map: a registry
(`packages/etl/scripts/lib/etl-plugins.mjs`) lists the sources, a runner
(`packages/etl/scripts/etl.mjs`) drives them, and each source is one descriptor under
`packages/etl/scripts/plugins/`. The everyday build command runs the shipping sources through
the runner and its output is unchanged. The tenet is stated in `CLAUDE.md` ("Every source of
Qur'an data is a plugin"). The two decisions this one builds on are
[qul-reliance](qul-reliance.md) — whether a copy may be held — and
[qul-store-purpose](qul-store-purpose.md) — what the held copy is for.
