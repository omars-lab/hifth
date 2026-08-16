# Hifth — operational front door.
#
# Two kinds of targets:
#   1. Everyday dev + the exact CI sequence (so `make ci` locally == green CI).
#   2. The loop workflow from docs/PLAN.md, made executable: start a loop, see
#      the roadmap, verify a loop's gates, serve a phone preview, run the
#      on-device perf capture. The plan feeds these — it is the source of truth;
#      these targets just drive it.
#
# Run `make` or `make help` for the annotated list.

# Use pnpm everywhere; fail loudly on any pipe stage.
SHELL := /bin/bash
PNPM  := pnpm
# `-C <dir>`, not `--filter <pkg>`. Same package, same scripts, but --filter goes
# through pnpm's recursive runner, and that runner replaces the last thing on
# your screen with its own banner when a command fails — for `exec` it prints a
# bare `undefined` where the error should be. The last lines of a failing test
# run are the ones you read. Exit codes propagate identically.
WEB   := $(PNPM) -C apps/web
CORE  := $(PNPM) -C packages/core
ETL   := $(PNPM) -C packages/etl

# LAN IP so the phone-preview target can print a URL you can open on a device.
LAN_IP := $(shell ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "<your-lan-ip>")
PORT   := 4173

.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Everyday development
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install deps + wire the gitleaks pre-commit hook (runs "prepare")
	$(PNPM) install

.PHONY: dev
dev: ## Start the web app in dev mode (Vite HMR) — the main local dev loop
	$(WEB) dev

.PHONY: build
build: node-ok ## Production build (core first — package exports resolve to its dist/)
	$(CORE) build
	$(WEB) build

.PHONY: preview
preview: build ## Build, then serve the production bundle locally
	$(WEB) preview --port $(PORT)

.PHONY: etl
etl: core ## Run the full ETL (pages + adjacency + root + tajweed shards) into assets
	$(ETL) extract:pages
	$(ETL) build:adjacency
	$(ETL) build:roots
	$(ETL) build:tajweed

.PHONY: clean
clean: ## Remove all build output (the "clean-state" discipline — see loop-0.md)
	rm -rf packages/core/dist apps/web/dist packages/etl/dist \
	       apps/web/dev-dist apps/web/playwright-report apps/web/test-results

# ---------------------------------------------------------------------------
# Quality gates — each target is one CI step; `ci` runs them in CI order
# ---------------------------------------------------------------------------

.PHONY: lint typecheck test e2e
lint:      ## eslint across the workspace (incl. the layer-boundary rules)
	$(PNPM) lint
typecheck: core ## tsc --noEmit in every package
	$(PNPM) typecheck
test: core ## Vitest unit/contract tests in every package
	$(PNPM) test
e2e: core ## Playwright mobile e2e (iPhone WebKit + Android Chromium + golden images)
	$(WEB) build
	$(WEB) test:e2e

.PHONY: report
report: ## Open the last e2e run's report — traces, image diffs, the failing screen
	@# Playwright's own report, not a hand-rolled one. It answers "did the
	@# automated tier hold, and exactly where did it break"; `make validate` and
	@# `make guide` answer "what does a human still have to do". Neither restates
	@# the other. Which artifact answers which question: /review-reports.
	@#
	@# It serves on :9323 and holds the terminal until Ctrl-C — the report embeds
	@# the trace viewer, which is a web app and needs an origin to run in.
	@test -f apps/web/playwright-report/index.html || { \
	  echo ""; \
	  echo "  No report yet — nothing has been run in this working tree."; \
	  echo "  Run 'make e2e' first (the report is written whether it passes or fails)."; \
	  echo ""; \
	  exit 1; \
	}
	$(WEB) exec playwright show-report

.PHONY: core
core: node-ok ## Build @hifth/core only (needed before typecheck/test — the Loop 0 lesson)
	$(CORE) build

# Everything slow hangs off `core` or `build`, so guarding those two guards the
# lot. Cheap enough (one `node --version`) to sit in front of every one of them.
.PHONY: node-ok
node-ok: ## Check the running node against .nvmrc + package.json engines
	@scripts/require-node.sh

.PHONY: gates
gates: build ## The static gates: no <text> in SVG, license present, JS budget <150KB gz
	$(PNPM) gates

.PHONY: lighthouse
lighthouse: build ## Lighthouse CI gate (all four categories ≥90) against the built app
	@# lhci is run via `dlx`, not a devDependency: it drags in Lighthouse and a
	@# Chrome launcher that nothing else here needs, and it runs once per push.
	@# On macOS it cannot find Chrome by itself; point it at the app bundle.
	CHROME_PATH="$${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}" \
	  $(PNPM) dlx @lhci/cli@0.14.x autorun

# ---------------------------------------------------------------------------
# Golden images — the visual gate (PLAN §Testing plan, "golden-image diff")
#
# Baselines are rasterized geometry, so they are per-platform: the committed set
# under e2e/__screenshots__/darwin is what you diff against locally, and
# .../linux is what CI diffs against. Regenerate BOTH when a highlight's
# geometry legitimately changes, and eyeball the diff before committing it —
# an accepted baseline is the only place a wrong wash can hide forever.
#
# "Per-platform" is not strict enough, and the first CI run of this tier is the
# proof: the linux baselines rendered by `make golden-linux` in the container
# below failed against a bare ubuntu-latest at 5–11% of pixels, against a 0.5%
# tolerance. Same OS, same Playwright — different fonts, and an Arabic app with
# no Arabic fonts lays out every line at a different width. So the axis that
# matters is the IMAGE, not the platform: GOLDEN_IMAGE is what renders the linux
# baselines here and what CI's e2e job runs inside, and gate:golden-env fails the
# build if those two, or the installed @playwright/test, ever disagree.
#
# Which of the three tiers runs where:
#   make golden        → golden project, this machine   → darwin baselines
#   make golden-linux  → golden project, GOLDEN_IMAGE   → linux baselines
#   make e2e           → iphone + android + golden, this machine
#   CI job `e2e`       → iphone + android + golden, inside GOLDEN_IMAGE
# ---------------------------------------------------------------------------

GOLDEN_IMAGE := mcr.microsoft.com/playwright:v1.61.1-noble

.PHONY: golden
golden: core ## Run the golden-image diff on this machine (darwin baselines)
	$(WEB) build
	$(WEB) exec playwright test --project=golden

.PHONY: golden-update
golden-update: core ## Accept new golden baselines for THIS platform — review the diff first
	$(WEB) build
	$(WEB) exec playwright test --project=golden --update-snapshots
	@echo ""
	@echo "  Baselines rewritten. Run 'git diff --stat -- apps/web/e2e/__screenshots__'"
	@echo "  and open the changed PNGs before committing: this is the gate agreeing"
	@echo "  with you, not the other way round."
	@echo ""
	@echo "  THIS PLATFORM ONLY. CI runs the linux set, which is a separate"
	@echo "  committed tree ({platform} in snapshotPathTemplate). A change that"
	@echo "  moves geometry moves both, so run 'make golden-linux UPDATE=1' too"
	@echo "  or CI will fail on shots that pass here."

.PHONY: budget-update
budget-update: core ## Accept a new JS bundle baseline — review the diff first
	$(WEB) build
	$(PNPM) gate:budget --update
	@echo ""
	@echo "  Run 'git diff -- scripts/budget-baseline.json' and read the numbers."
	@echo "  That diff is the point: it is where 'this PR adds 9 KB' becomes visible"
	@echo "  to a reviewer. Accepting it without reading it makes the gate decorative."

.PHONY: golden-linux
golden-linux: core ## Run/refresh the CI-shaped (linux) baselines in the Playwright container
	@# The preview server stays on the host — its node_modules are built for the
	@# host arch. Only the browser runs in the container, reaching back over
	@# host.docker.internal; HIFTH_BASE_URL is what stops Playwright from trying
	@# to start a second server inside it. UPDATE=1 rewrites the linux baselines.
	@#
	@# --host 0.0.0.0 is required, not incidental: vite preview binds loopback by
	@# default, so host.docker.internal resolves fine and then refuses the
	@# connection. It does mean this build is reachable from the local network
	@# for the seconds the run takes — it is a static preview of a public app,
	@# and it dies with the trap below.
	$(WEB) build
	@set -e; \
	  trap 'pkill -f "vite preview --port $(PORT)" 2>/dev/null || true' EXIT; \
	  $(WEB) exec vite preview --port $(PORT) --strictPort --host 0.0.0.0 >/dev/null 2>&1 & \
	  until curl -sf http://localhost:$(PORT)/ >/dev/null 2>&1; do sleep 1; done; \
	  docker run --rm -v "$$PWD:/w" -w /w/apps/web \
	    --add-host=host.docker.internal:host-gateway \
	    -e HIFTH_BASE_URL=http://host.docker.internal:$(PORT) \
	    $(GOLDEN_IMAGE) \
	    npx playwright test --project=golden $(if $(UPDATE),--update-snapshots,)

.PHONY: secrets
secrets: ## Scan the working tree + history for committed secrets (gitleaks)
	@command -v gitleaks >/dev/null 2>&1 || { echo "gitleaks not installed: brew install gitleaks"; exit 1; }
	gitleaks git --redact --config .gitleaks.toml
	gitleaks dir . --redact --config .gitleaks.toml

.PHONY: ci
ci: core ## Full local mirror of the CI build-test-gate job, IN CI ORDER
	$(ETL) extract:pages
	$(ETL) build:adjacency
	$(ETL) build:roots
	$(ETL) build:tajweed
	@git diff --quiet -- apps/web/public/assets \
	  || { echo "::error:: ETL output differs from committed assets (run: make etl)"; exit 1; }
	$(PNPM) lint
	$(PNPM) typecheck
	$(PNPM) test
	$(PNPM) audit:corpus
	$(PNPM) gate:notext
	$(PNPM) gate:text-sources
	$(PNPM) gate:license
	$(PNPM) gate:license-copy
	$(PNPM) gate:notices
	$(PNPM) gate:validation
	$(PNPM) gate:verified-edges
	$(PNPM) gate:edges
	$(PNPM) gate:gates
	$(PNPM) gate:ci-artifacts
	$(PNPM) gate:golden-env
	$(PNPM) gate:golden-size
	$(PNPM) gate:assets
	$(PNPM) gate:pages
	$(PNPM) gate:words
	$(PNPM) gate:align
	$(PNPM) gate:map
	$(PNPM) gate:use-cases
	$(PNPM) gate:issues
	$(PNPM) gate:tasks
	$(PNPM) gate:decisions
	$(PNPM) gate:quran-meta
	$(PNPM) gate:tajweed
	$(PNPM) gate:revision-privacy
	$(PNPM) gate:i18n
	$(PNPM) gate:params
	$(CORE) build && $(WEB) build
	$(PNPM) gate:budget
	@echo ""
	@echo "  ✓ build-test-gate mirror passed."
	@echo "    CI also runs two more jobs: make e2e, make lighthouse."

# ---------------------------------------------------------------------------
# The loop workflow (docs/PLAN.md → executable)
# ---------------------------------------------------------------------------

.PHONY: status
status: ## Show the roadmap: the Status & tracking table + open follow-ups from PLAN.md
	@awk '/^## Status & tracking/{f=1} /^## 1\./{f=0} f' docs/PLAN.md
	@echo ""
	@echo "  Decision records written:"
	@for f in docs/decisions/loop-*.md; do echo "    - $$f"; done

.PHONY: loop
loop: ## Print the kickoff prompt for a loop:  make loop N=2
	@test -n "$(N)" || { echo "usage: make loop N=<loop-number>"; exit 2; }
	@echo "Copy this into Claude Code to start Loop $(N):"
	@echo ""
	@echo "  Start Loop $(N) of Hifth. Read docs/PLAN.md (§Loop $(N)) and"
	@echo "  docs/reference/linker-spec.md first. Scope: exactly the Loop $(N)"
	@echo "  deliverables — do not pull work forward. Definition of done: the"
	@echo "  Loop $(N) exit criterion, the applicable testing-plan tiers passing"
	@echo "  in CI, and a demo I can open on my phone. Finish by writing"
	@echo "  docs/decisions/loop-$(N).md and telling me what to check on my phone."
	@echo ""
	@echo "  This loop's plan section:"
	@awk -v n="$(N)" '$$0 ~ ("^### Loop " n " ") {f=1} /^### Loop /{if(f && $$0 !~ ("^### Loop " n " ")) f=0} f' docs/PLAN.md | sed 's/^/    /'

.PHONY: loop-verify
loop-verify: ci ## Verify a loop is landable: CI mirror + e2e + Lighthouse (on-device check is manual)
	@$(MAKE) e2e
	@$(MAKE) lighthouse
	@echo ""
	@echo "  ✓ CI mirror + e2e + Lighthouse green. Now do the on-device check in §Loop $(N) of PLAN.md,"
	@echo "    then write docs/decisions/loop-$(N).md and update the Status table."

# ---------------------------------------------------------------------------
# Parallel agents on one tree (docs/PARALLEL-AGENTS.md)
#
# Several agents share this checkout and this branch. Anything that builds,
# installs, or stages takes the lock first — two builds writing one dist/, or
# two agents staging one index, fail as bugs in the code rather than in the
# choreography, which is the expensive kind.
# ---------------------------------------------------------------------------

.PHONY: lock
lock: ## Run a command holding the shared-tree lock:  make lock L=build CMD="pnpm -r test"
	@test -n "$(CMD)" || { echo 'usage: make lock L=<label> CMD="<command>"'; exit 2; }
	scripts/with-lock.sh "$(if $(L),$(L),make)" "$(CMD)"

.PHONY: lock-status
lock-status: ## Who holds the shared-tree lock (a live PID is contention, not a deadlock)
	@if [ -d .git/hifth-agent.lock ]; then \
	  echo "  held:"; sed 's/^/    /' .git/hifth-agent.lock/owner 2>/dev/null || echo "    (no owner file yet — a holder mid-acquire)"; \
	  pid=$$(awk -F= '/^pid=/{print $$2}' .git/hifth-agent.lock/owner 2>/dev/null); \
	  if [ -n "$$pid" ] && kill -0 "$$pid" 2>/dev/null; then \
	    echo "    → alive. This is contention: wait, do not break it."; \
	  elif [ -n "$$pid" ]; then \
	    echo "    → gone. The next 'make lock' run breaks it automatically."; \
	  fi; \
	else \
	  echo "  free."; \
	fi

# ---------------------------------------------------------------------------
# On-device checks (open these on a real phone on the same Wi-Fi)
# ---------------------------------------------------------------------------

.PHONY: phone
phone: build ## Serve the built app for your phone; prints the LAN URL to open
	@echo ""
	@echo "  Open on your phone (same Wi-Fi):  http://$(LAN_IP):$(PORT)"
	@echo ""
	$(WEB) exec vite preview --host --port $(PORT)

.PHONY: phone-perf
phone-perf: ## Serve a probe build so the PHONE measures itself — the follow-up ① capture
	@# VITE_PERF_PROBE is read at build time only (src/main.tsx), so this bundle
	@# is a throwaway: never deploy dist/ after running this target. `make build`
	@# or `make ci` overwrites it with a clean one.
	$(CORE) build
	VITE_PERF_PROBE=1 $(WEB) build
	@echo ""
	@echo "  On your phone (same Wi-Fi):  http://$(LAN_IP):$(PORT)"
	@echo ""
	@echo "  A dark bar sits at the top — tap ابدأ, then follow it for 15s:"
	@echo "    pan with one finger · pinch in and out · tap different ayahs"
	@echo "  Then long-press the JSON, copy it, and paste it into the"
	@echo "  perf-verdict-on-device entry in docs/validation/ledger.json."
	@echo ""
	@echo "  Run it TWICE if you can: once as a browser tab, once from the Home"
	@echo "  Screen install. Standalone gets its own compositor path, and the"
	@echo "  JSON stamps which one you were in."
	@echo ""
	$(WEB) exec vite preview --host --port $(PORT)

.PHONY: perf
perf: ## Run the pan/zoom perf harness (emulated baseline; prints the on-device recipe)
	@echo "  Follow-up ① (gates Loop 4): capture real-device fps — see the recipe this prints."
	$(WEB) perf

# ---------------------------------------------------------------------------
# Validation (the "validate" skill drives these; see .claude/skills/validate/)
#
# Automated tiers live above — this section is the half a machine cannot run and
# the ledger that stops those results from evaporating into prose.
# ---------------------------------------------------------------------------

.PHONY: map
map: ## Where each feature lives:  make map  ·  make map FEATURE=<id> for the walkthrough
	@# docs/map.json is the source; this and the /extend skill are its renderers.
	@# It stores symbols, never line numbers — the `file:line` printed below is
	@# computed now, so it is true now. gate:map (CI + pre-commit) fails the build
	@# if any of it stops resolving, which is the only reason it can be trusted.
	@if [ -n "$(FEATURE)" ]; then \
	  node scripts/gate-map.mjs --feature "$(FEATURE)"; \
	else \
	  node scripts/gate-map.mjs --list; \
	fi

.PHONY: use-cases
use-cases: ## Who uses Hifth and what proves it:  make use-cases  ·  make use-cases ACTOR=<id>
	@# docs/use-cases.json is the source. The map answers "where do I change this";
	@# this answers "what did we promise, and what fails if we break it". Every
	@# entry names a test or a gate — gate:use-cases refuses one that names nothing,
	@# and refuses a pointer or a test title that has stopped resolving.
	@if [ -n "$(ACTOR)" ]; then \
	  node scripts/gate-use-cases.mjs --actor "$(ACTOR)"; \
	else \
	  node scripts/gate-use-cases.mjs --list; \
	fi

.PHONY: use-cases-doc
use-cases-doc: ## Re-render docs/use-cases.md (the mermaid map) from docs/use-cases.json
	@node scripts/build-use-cases.mjs

.PHONY: issues
issues: ## What is still open, worst first:  make issues  ·  make issues ID=<id>
	@# docs/issues.json is the source, and it is an index: no titles, no
	@# descriptions, no reproductions. Those live in PLAN.md's follow-ups,
	@# backlog.md, a design doc's open-questions section, or the validation
	@# ledger — whichever owns the item. What this adds is what none of those can
	@# hold: severity, owner, what blocks it, and the fact that two registers are
	@# describing the same thing. Everything printed below is read out of the
	@# owning document at the moment you run it.
	@if [ -n "$(ID)" ]; then \
	  node scripts/gate-issues.mjs --id "$(ID)"; \
	else \
	  node scripts/gate-issues.mjs --list; \
	fi

.PHONY: issues-doc
issues-doc: ## Re-render docs/issues.md from docs/issues.json and its four registers
	@node scripts/build-issues-doc.mjs

.PHONY: tasks
tasks: ## What is still open, by whose turn it is:  make tasks
	@# The same facts as `make issues`, cut the other way. Worst-first is the
	@# order you want when you are choosing what to fix; whose-turn-is-it is the
	@# order you want when you have an hour and are asking what only you can
	@# move. Two of the three registers it reads — the open decisions and the
	@# checks a machine cannot run — appear in the issue index only as bare
	@# identifiers, so this is the only page that shows them by name.
	@node scripts/gate-tasks.mjs --list

.PHONY: tasks-doc
tasks-doc: ## Re-render docs/tasks.md from the decisions, ledger, issues and PLAN registers
	@node scripts/build-tasks-doc.mjs

.PHONY: decisions
decisions: ## What has been decided and what is still open:  make decisions  ·  make decisions ID=<id>
	@# docs/decisions.json is the source, and like the issue catalog it is an
	@# index: the only prose it stores is the question, in plain words, because
	@# the records' own titles are sentences and nobody scans a directory of
	@# sentences to find their question. Everything else — the title, the answer,
	@# the argument — is read out of the record that owns it as you run this.
	@if [ -n "$(ID)" ]; then \
	  node scripts/gate-decisions.mjs --id "$(ID)"; \
	else \
	  node scripts/gate-decisions.mjs --list; \
	fi

.PHONY: decisions-doc
decisions-doc: ## Re-render docs/decisions/README.md from docs/decisions.json
	@node scripts/build-decisions-doc.mjs

.PHONY: validate
validate: ## Outstanding manual checks — or one check's full runbook:  make validate CHECK=<id>
	@# The edge coverage table rides along with the outstanding-checks list
	@# because it answers the same question about the one tier no gate can
	@# reach: not "how much has been audited" but "which kinds of edge has
	@# nobody ever looked at". A class with no verdict in it is a class where
	@# a wrong pair survives every check this repo has.
	@if [ -n "$(CHECK)" ]; then \
	  node scripts/gate-validation.mjs --check "$(CHECK)"; \
	else \
	  node scripts/gate-validation.mjs; \
	  node scripts/gate-verified-edges.mjs; \
	  node packages/etl/scripts/sample-edges.mjs --coverage; \
	fi

.PHONY: validate-auto
validate-auto: ## Run the machine half of the manual checks:  make validate-auto [CHECK=<id>]
	@# Runs each check's declared `evidence.run` and writes the real exit code to
	@# docs/validation/evidence/<id>.json. Those records are what let `make
	@# validate` and the guide strike a runbook step off — so they are produced
	@# by the command, never hand-written, exactly like `make shots`.
	@#
	@# NOT in `make ci` or `pnpm gates`, and it exits 0 even when a producer goes
	@# red. Same reasoning as `make source-offer`, which is one of the producers:
	@# these commands reach the network and the answer is a finding, not a broken
	@# build. `gate:validation` is what fails, and it fails on the ledger lying
	@# about its evidence — never on the evidence being bad news.
	@node scripts/validate-auto.mjs $(if $(CHECK),--check "$(CHECK)",)

.PHONY: guide
guide: ## Render the runbooks to docs/validation/guide.html and serve them to your phone
	@# The checks happen with a phone in one hand; the instructions have always
	@# lived in a terminal the phone cannot see. Same source as `make validate`
	@# CHECK=<id> — docs/validation/ledger.json — rendered for the device.
	@LAN_IP="$(LAN_IP)" node scripts/build-validation-guide.mjs --serve

.PHONY: session
session: ## Work one check with the answers banked as you go:  make session CHECK=<id>
	@# `make guide` is the reading surface — every check, tickable, nothing
	@# written down. This is the writing one: a single check, and every box you
	@# tick and every note you type lands in a transcript under
	@# docs/validation/sessions/ the moment you make it.
	@#
	@# The gap it closes is an ordering problem, not a documentation one. The
	@# ledger's `result` has always been typed on the laptop after the walkthrough
	@# is over, so whatever you noticed at step four survives only if you were
	@# still holding it at step ten. Here the observation is on disk while the
	@# step is still in front of you, and `make record` at the end summarises a
	@# file instead of a memory.
	@#
	@# Resumes an unbanked transcript by default; NEW=1 starts a fresh one.
	@test -n "$(CHECK)" || { echo "usage: make session CHECK=<id>   (ids: make validate)"; exit 2; }
	@# `$(origin PORT)`, not `$(PORT)`. This file already defines PORT := 4173 for
	@# the preview server, so a plain `$(if $(PORT),…)` is always true and pins
	@# every session to the app's own port. That is not just a clash: macOS `open`
	@# reuses an existing tab pointed at the same URL without reloading it, so a
	@# stale preview tab from an earlier `make phone-perf` comes to the front
	@# looking like the session, and the session is what gets blamed. Only a PORT
	@# given on the command line counts as one the user asked for.
	@LAN_IP="$(LAN_IP)" node scripts/session.mjs --check "$(CHECK)" \
	  $(if $(NEW),--new,) $(if $(filter command line,$(origin PORT)),--port $(PORT),)

.PHONY: record
record: ## Bank a manual result:  make record CHECK=<id> RESULT='the verdict, in words'
	@test -n "$(CHECK)" || { echo "usage: make record CHECK=<id> RESULT='<the verdict>'"; exit 2; }
	@node scripts/record-validation.mjs --check "$(CHECK)" --result "$(RESULT)" \
	  $(if $(STATUS),--status $(STATUS),) $(if $(ON),--on $(ON),)

.PHONY: deploy-cloudflare
deploy-cloudflare: ## Publish to Cloudflare Pages from this machine (GitHub Pages is the default; see .github/workflows/ci.yml)
	@# Not how Hifth normally ships. A push to main that clears all four CI jobs
	@# deploys to GitHub Pages by itself, and the same workflow will publish to
	@# Cloudflare on request (Actions › CI › Run workflow › target: cloudflare) —
	@# from the artifact the gates measured, which is the safer of the two.
	@#
	@# This target is the third door: a laptop, wrangler's own login, no CI. It
	@# exists because the day you need it is a day GitHub is the thing that is
	@# broken, and a documented command is worth more then than a correct one you
	@# have to reconstruct. Kept in the front door rather than a comment so it is
	@# read occasionally instead of discovered never.
	@#
	@# The dirty-tree refusal is not tidiness. Hifth is GPL-3.0-or-later and a
	@# static deploy conveys the program, so the bundle bakes in the commit its
	@# reader is offered (apps/web/vite.config.ts sourceCommit()). Off CI there is
	@# no CF_PAGES_COMMIT_SHA or GITHUB_SHA, so that falls back to `git rev-parse
	@# HEAD` — which names a commit that does not contain the uncommitted changes
	@# being published. The colophon would then offer corresponding source that
	@# does not correspond, which is the §6 failure this repo already spent a
	@# follow-up closing. Cheaper to refuse than to explain.
	@git diff --quiet && git diff --cached --quiet || { \
	  echo "  refusing: the working tree is dirty, so the commit baked into the"; \
	  echo "  bundle would not be the source it offers its reader. Commit first."; \
	  exit 2; \
	}
	@echo "  deploying $$(git rev-parse --short HEAD) to Cloudflare Pages project 'hifth'"
	$(CORE) build
	$(WEB) build
	cd apps/web && $(PNPM) dlx wrangler pages deploy dist --project-name hifth

.PHONY: shots
shots: ## Recapture the guide's screenshots from the real app into docs/validation/shots/
	@# Two passes, because the perf probe is a build-time flag and not a URL
	@# param (src/main.tsx) — deliberately, so a readable param can never put a
	@# measurement slab over someone's mushaf. So the probe shots need their own
	@# bundle, and it is a throwaway: the plain build at the end is what stops a
	@# probe dist being left behind for `make phone` or a deploy to pick up.
	$(CORE) build
	VITE_PERF_PROBE=1 $(WEB) build
	HIFTH_SHOTS=1 $(WEB) exec playwright test --project=shots --grep @probe
	$(WEB) build
	HIFTH_SHOTS=1 $(WEB) exec playwright test --project=shots --grep @app
	node scripts/build-validation-guide.mjs
	@echo ""
	@echo "  Screenshots refreshed. Review them before committing — they are"
	@echo "  documentation, so a wrong one teaches a wrong expectation."
	@echo ""

.PHONY: source-offer
source-offer: ## Follow the GPL §6 offer as a stranger would:  make source-offer URL=<deployed>
	@# NOT part of `make ci` or `pnpm gates`, and the script is named `check-`
	@# rather than `gate-` to say so: it reaches the public internet, and a check
	@# that can go red because GitHub is having a bad morning does not belong in
	@# front of every commit. Same reasoning that cancelled the KFGQPC watcher.
	@#
	@# Anonymous by construction — no gh, no token. Signed in as ourselves a
	@# private repo looks public, which is the exact failure the manual runbook
	@# opens a private window to avoid.
	@#
	@# With URL=<deployed> it also reads what the deployed bundle actually
	@# offers, which is the only form of this question that can be answered
	@# about a build we are not sitting next to.
	@node scripts/check-source-offer.mjs $(if $(URL),--url $(URL),) $(if $(COMMIT),--commit $(COMMIT),)

.PHONY: audit-edges
audit-edges: ## Draw a seeded sample of edges for a mushaf spot-audit:  make audit-edges N=20 SEED=1
	@# node directly, not `pnpm sample:edges --`: pnpm forwards the separator
	@# itself, and the extra "--" lands in argv where the flag parser sees it.
	@#
	@# NEW=1 skips pairs a verdict already settles. COVERAGE=1 shows which
	@# classes have never been looked at. UNIFORM=1 draws flat instead of
	@# stratified — for when the *rate* of bad edges is the question, though
	@# gate:edges already carries the rate on every commit.
	@node packages/etl/scripts/sample-edges.mjs \
	  $(if $(N),--n $(N),) $(if $(SEED),--seed $(SEED),) $(if $(NEW),--skip-verified,) \
	  $(if $(UNIFORM),--uniform,) $(if $(COVERAGE),--coverage,)

.PHONY: probe-reference
probe-reference: core ## A second opinion on the print: make probe-reference [PAGES=1] [ALL=1]
	@# Bare: which published references answer today, measured now. PAGES=1
	@# diffs 24 sampled pages of our ayah→page table against an independently
	@# published one; ALL=1 does all 604 and prints only what disagrees.
	@#
	@# NOT in `make ci` and never will be, for the reason SOURCES.md already
	@# gives about the quran-meta tables: a gate that reaches the network fails
	@# when a host is down, which teaches everyone to skip it. Same reasoning
	@# that cancelled the KFGQPC watcher and named `check-source-offer.mjs`
	@# `check-` instead of `gate-`. This one is `probe-` for the same reason.
	@#
	@# Verse KEYS only — no `fields` parameter, so no Quran text crosses the
	@# wire. See .claude/skills/mushaf-reference/SKILL.md for what a reference
	@# can settle, what it cannot, and which archive.org scans are the wrong
	@# qira'a to compare against.
	@node scripts/probe-reference.mjs \
	  $(if $(PAGES)$(ALL),--page-table,) $(if $(ALL),--all --quiet,)

# ---------------------------------------------------------------------------

.PHONY: help
help: ## List targets (this)
	@echo "Hifth — make targets:"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | sort \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  Loop workflow:  make status | make loop N=2 | make loop-verify N=2"
	@echo "  On device:      make phone | make perf"
	@echo "  Orientation:    make map              (where does each feature live)"
	@echo "                  make use-cases        (what did we promise, and what proves it)"
	@echo "                  make use-cases ACTOR=<id>     (one actor's whole picture)"
	@echo "  Validation:     make validate         (what are we waiting on, and what it blocks)"
	@echo "                  make validate CHECK=<id>      (one check's full runbook, here)"
	@echo "                  make validate-auto            (run the machine half; strikes steps off)"
	@echo "                  make source-offer [URL=…]     (does the GPL §6 offer resolve?)"
	@echo "                  make guide                    (the same runbooks, on your phone)"
	@echo "                  make record CHECK=<id> RESULT='…'  (bank the verdict)"
	@echo "                  make shots                    (recapture the guide's screenshots)"
	@echo "                  make audit-edges N=20 SEED=1  (seeded draw for a mushaf spot-audit)"
	@echo "                  make audit-edges NEW=1        (only pairs no verdict has settled)"
	@echo "                  the full catalogue: .claude/skills/validate/SKILL.md"
	@echo "  Golden images:  make golden        (diff against this platform's baselines)"
	@echo "                  make golden-update (accept new ones — review the PNG diff!)"
	@echo "                  make golden-linux UPDATE=1  (refresh the CI/linux set)"
	@echo "  Bundle size:    make budget-update (accept a new JS baseline — read the diff!)"
	@echo "  Parallel work:  make lock L=build CMD=\"pnpm -r test\" | make lock-status"
	@echo "                  the protocol: docs/PARALLEL-AGENTS.md"
