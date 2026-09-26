# An older page move could land after a newer one

## What was seen

One of the page-fit checks on the desktop failed now and then, but only when the machine was
busy: run alone it passed, and run twelve copies at once, five to eight of them failed. The
check opens a link to page 1, switches to one page at a time, and then jumps to another page.
In the failures the app's header said the new page, but the stage kept showing page 1.

## What we first suspected, and why it was not that

A slow render or a check that did not wait long enough. Giving it more time changed nothing:
the wrong page stayed up for the full twenty seconds. Nothing was slow. The wrong page had
simply been put back.

## What it actually was

Every move to a page waits for that page to be ready before it shows it. A page already
loaded is ready at once. A page not yet loaded waits for its download. So two moves made
close together could finish in the reverse of the order they were asked for. Opening a link
starts one move, to a page still downloading. A jump right after it goes to a page already
loaded, and so it finishes first. Then the first move's download arrives and shows its page on
top, putting the reader back where they had just left.

On a quiet machine the download always won the race, so nobody had seen it.

## What changed

Every move now takes a number when it starts. After its wait, a move only goes ahead if no
newer move has started in the meantime; otherwise it quietly steps down. A page turn counts
as a move as well, so a jump still waiting cannot land on top of a turn.

A small test now stages the race on purpose, holding one page's download open by hand. It
fails on the old code (the older page reappears) and passes on the new. The page-fit check
then passed 156 runs out of 156 under the same load that used to break it.
