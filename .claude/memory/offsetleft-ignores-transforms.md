---
name: offsetleft-ignores-transforms
description: "to read an element's REST position while a CSS transform has warped it, use offsetLeft/offsetWidth (layout, transform-free), never getBoundingClientRect (post-transform) or a hand-derived formula"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-23T04:14:09.397Z
---

When a magnification effect warps a marker's box with `transform: translateX(...)`,
measuring its centre off `getBoundingClientRect()` feeds the warp back on itself, and
re-deriving the position by hand from the CSS (RTL `inset-inline-start` sums, `--thumb`,
page fraction) drifts — in the page-bar fisheye my hand formula was ~21px off, which
silently mis-centred the option-C grow so it peaked *beside* the tick, not on it.

**Use `offsetLeft` + `offsetWidth`** — they are layout metrics and ignore CSS transforms,
so they return the untransformed rest position even mid-warp. Rest centre in viewport X:
`parent.getBoundingClientRect().left + parent.clientLeft + m.offsetLeft + m.offsetWidth/2`
(parent = `m.offsetParent`). No feedback loop, no formula to drift.

**Why:** it tracks the real element by construction instead of a re-derivation that can be
wrong. **How to apply:** any imperative fisheye/dock/lens that both warps position and needs
each element's rest anchor — read the anchor from `offsetLeft`, not from the painted box.

Caught by the existing detents e2e ([[juz-jump-leaf-alignment]] neighbourhood): the grow
test asserted the hovered marker swells >1.5×, and the wrong analytic centre dropped it to
1.08×. A fix ships with the test that would have caught it — here the test already existed.
