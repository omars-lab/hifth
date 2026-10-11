# The early ask slipped past a browser test's fake network on the iPhone

**2026-10-11.** After PLAN item 65 (the verse a control offers to play is asked for as the
control opens), the iPhone run of the recitation test "the play control appears on selection
and asks the CDN for that verse" failed two times in three. Android and Firefox stayed green.

## What the evidence showed

The test answers every request to the recitation host with an empty file, so nothing real is
downloaded, and it records the address the player was handed. On the iPhone the player was
handed a saved copy, not the address. An empty answer is never kept as a copy, so the file had
come from the real host: the early ask uses fetch, the built app's service worker made that
fetch, and in WebKit a service worker's request goes past the test's fake network. When the
real file arrived before the tap, the tap played it from the copy, which is the app working as
designed. The test only passed when the file came in too late.

## What replaced it

That group of tests turns the service worker off, as the offline tests next to it already did.
The early ask then meets the empty answer, nothing is kept, and the tap streams from the
verse's address. Five runs on iPhone, Android and Firefox: all green. The shared player helper
the other recitation tests use fakes fetch inside the page, so nothing slips past it.

A test that fakes the recitation host with a route must also turn the service worker off, or
anything the app fetches early reaches the real host.
