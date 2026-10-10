# A press of + right after a link drew the page smaller — the buttons read a number that had not caught up

**2026-10-10.** A pitch test in Firefox (closed to one page, the page zoomed wider than the room the
roots list leaves) failed about one run in twenty. It passed on retry, so the push got through, but
the failure said the page had grown *narrower* after a press of "Zoom in": 462 pixels before, 372
after.

## What the evidence showed

A throwaway probe ran the same steps 40 times and logged the page's width and the zoom readout
every 100 ms around the press. A link lands the page at 155%, and the page stops moving about half
a second in, but the readout still says 100% until the landing has finished, up to a second later.
The test waits only for the page to stop moving, so in the runs where it pressed "+" inside that
gap, the buttons stepped from the stale 100% to the next step, 125%, and the page shrank from 155%
to 125%. The page then sat at 125% and the readout agreed with it, so nothing looked wrong
afterwards.

That is not only the test. A reader who presses "+" the moment a link lands gets the same smaller
page.

## What replaced it

The buttons step from the level the page is drawn at the moment of the press, which the page itself
reports, and fall back to the readout only where nothing reports it. The readout is unchanged. A unit
test (a readout at 100% with the page at 155%: "+" asks for 200%, "−" for 150%) failed first. The
probe, run 60 times afterwards, caught the gap five times, and each press went from 155% to 200%;
the pitch test passed 40 of 40 in Firefox.

Left alone: the readout itself still catches up only once the landing finishes. Making it follow the
page as it moves would mean telling the app the level on every frame of the glide, which is a cost
with nothing for the reader to act on in that half second.
