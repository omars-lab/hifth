# Merging every branch back into main: what broke with no conflict to show it

**2026-09-29.** Five branches and their checkouts were brought back into main with every conflict
worked by hand (PR #152), and then deleted. Three things came up that the conflicts themselves did not
show. Each is written down here so the next merge of this kind knows to look for it.

## Two branches used one page tag for different things, and no line conflicted

One branch tagged each page's outer frame with its page number. Another branch added the same tag,
with the same name, to an element inside that frame. Git merged both without a conflict, because the
two changes were in different lines. Afterwards, anything that counted pages by that tag counted every
page twice, and the spread-fit browser test failed.

The inner element now has a tag of its own, and a comment beside it says why it is not the shared
name. **The lesson:** a clean merge only means no line was changed on both sides. Two branches can
still give the same name two meanings. Run the full browser suite after a merge, not only the checks
that run on each commit. Here, that suite was the only thing that caught the problem.

## The published-pages check lost two rules, and nothing tests the check itself

The published-pages check was written on a branch before 2026-09-01, the day decision pages moved
onto the app's own site. Two of its rules no longer fit main:

- It required a row's link to equal its decision's address. Those are now two different copies, the
  site address and a copy put elsewhere for a conversation.
- It required a row for every design page. The site's front door already lists every page.

Both rules were dropped, and the file says so. Only two things show that the rules that were left
still work: the check that every check is registered, and one real run over the list (13 published
pages, 4 of them with no copy anywhere). The repository's own checks, the thirty-odd in the top-level
scripts folder, have no tests of their own. The build scripts do. That gap is now open question ⑦
on the validation page (`docs/design/robust-validation.md`), with its row in the issue list.

## The main checkout had been switched into a mode with no working files

Partway through, git began treating the main checkout as if it had no working files. The cause was a setting (`core.bare`) that had been flipped to `true` in the
checkout's config. Setting it back (`git config core.bare false`) fixed it straight away, and nothing
was lost.

What flipped it is not known. The likeliest suspect is a worktree command run by another session
while several checkouts shared one repository, but that was not proved. **If it happens again:**
check that setting first, before assuming files have gone missing, and note which sessions were
running at the time.
