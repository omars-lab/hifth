# The arrow turn "stood 5 px outside the paper" — it was the test reading the number

**2026-09-29.** The browser test that watches an arrow-key page turn failed now and then, always
saying the turning leaf stood 5 px above the paper. It passed on retry, so pushes got through, and
the failure was easy to shrug off as the machine being busy.

## What we first thought

That the test's recording window was too short: it records frames for a fixed 2.5 s, and under
load the turn might fall outside it. That would have given "the leaf never went over", not a
measured 5 px, so it did not fit once the real message was kept.

## What the evidence showed

Running the test 30 times, six at once, failed it twice. The test now prints the worst frame whole
when it fails, and that frame said the leaf was flat on the paper with a sideways shift of
`-6e-05` px, a number written in exponent form. The browser writes near-zero numbers that way. The
test pulled numbers out of the text with a digits-only pattern, which split `-6e-05` into `-6` and
`-05`, pushed every number after it along one place, and read the `5` as a vertical shift. The turn
itself was right all along; the geometry cannot move the leaf up or down on an arrow turn.

## What replaced it

The test lets the browser read its own matrix (`DOMMatrixReadOnly`) and reads the outline's numbers
with a pattern that allows the exponent form. 60 of 60 runs pass under the same load. The worst-frame
readout stays in the failure message, so a real failure would say why.

The other tests that read a position by pattern were checked: the scale readers never see a
near-zero value, and the sideways one falls back to 0 when it cannot match, which is right to within
a ten-thousandth of a pixel.

## Found on the way

Every checkout served its browser tests on port 4173, so two worktrees testing at once collided and a
push could fail for nothing to do with the change. Each worktree now gets its own port
(`scripts/lib/e2e-port.mjs`); the main checkout keeps 4173.
