# Retro: page comments turned on, first comments answered (2026-11-06)

## Snags

- **development-manager:enable-page-comments** (`enable.mjs --detect`) guessed port 8000. The app's dev server is on 7122 (`apps/web/vite.config.ts`), so the target had to be given by hand.
- **enable.mjs --check** failed the first time only because the dev server was not running. Start `make dev` before the check.
- **The commit hook's lint** (`eslint .`) failed on the plugin's copied-in loader `.page-comments/vite.mjs`. Fixed by adding `.page-comments/**` to the ignore list in `eslint.config.js`. Enable could add that line itself.
- **The comment box swallowed no keys.** The plugin draws its box inside a shadow root, so the app's "is the reader typing?" check saw only the host div, and letters switched tools (F went full screen). Fixed in the app (`typingIn` in `apps/web/src/mark-history.ts` now looks inside shadow roots). The plugin should also stop key presses from its own bar, as it already does for clicks. That change belongs in the marketplace repo.

## Worth copying

- **Proving a browser test is wired to the real behaviour:** switch the fix off, rebuild `dist`, watch the Playwright test fail for the right reason, then switch it back on.
- **development-manager:answer-page-comments:** several comments asking for one redesign became one backlog item on the owning design page, with one reply per comment pointing at it, not several items.

## Didn't work

- An ambiguous comment ("the corner is not symmetric and doesn't blend in") could not be fixed from the picture alone. It got one clarifying question with three concrete readings.
