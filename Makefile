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
build: ## Production build (core first — package exports resolve to its dist/)
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
core: ## Build @hifth/core only (needed before typecheck/test — the Loop 0 lesson)
	$(CORE) build

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
	$(PNPM) gate:validation
	$(PNPM) gate:verified-edges
	$(PNPM) gate:ci-artifacts
	$(PNPM) gate:golden-env
	$(PNPM) gate:golden-size
	$(PNPM) gate:map
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

.PHONY: validate
validate: ## Outstanding manual checks — or one check's full runbook:  make validate CHECK=<id>
	@if [ -n "$(CHECK)" ]; then \
	  node scripts/gate-validation.mjs --check "$(CHECK)"; \
	else \
	  node scripts/gate-validation.mjs; \
	  node scripts/gate-verified-edges.mjs; \
	fi

.PHONY: guide
guide: ## Render the runbooks to docs/validation/guide.html and serve them to your phone
	@# The checks happen with a phone in one hand; the instructions have always
	@# lived in a terminal the phone cannot see. Same source as `make validate`
	@# CHECK=<id> — docs/validation/ledger.json — rendered for the device.
	@LAN_IP="$(LAN_IP)" node scripts/build-validation-guide.mjs --serve

.PHONY: record
record: ## Bank a manual result:  make record CHECK=<id> RESULT='the verdict, in words'
	@test -n "$(CHECK)" || { echo "usage: make record CHECK=<id> RESULT='<the verdict>'"; exit 2; }
	@node scripts/record-validation.mjs --check "$(CHECK)" --result "$(RESULT)" \
	  $(if $(STATUS),--status $(STATUS),) $(if $(ON),--on $(ON),)

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

.PHONY: audit-edges
audit-edges: ## Draw a seeded sample of edges for a mushaf spot-audit:  make audit-edges N=20 SEED=1
	@# node directly, not `pnpm sample:edges --`: pnpm forwards the separator
	@# itself, and the extra "--" lands in argv where the flag parser sees it.
	@node packages/etl/scripts/sample-edges.mjs \
	  $(if $(N),--n $(N),) $(if $(SEED),--seed $(SEED),) $(if $(NEW),--skip-verified,)

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
	@echo "  Validation:     make validate         (what are we waiting on, and what it blocks)"
	@echo "                  make validate CHECK=<id>      (one check's full runbook, here)"
	@echo "                  make guide                    (the same runbooks, on your phone)"
	@echo "                  make record CHECK=<id> RESULT='…'  (bank the verdict)"
	@echo "                  make shots                    (recapture the guide's screenshots)"
	@echo "                  make audit-edges N=20 SEED=1  (seeded draw for a mushaf spot-audit)"
	@echo "                  the full catalogue: .claude/skills/validate/SKILL.md"
	@echo "  Golden images:  make golden        (diff against this platform's baselines)"
	@echo "                  make golden-update (accept new ones — review the PNG diff!)"
	@echo "                  make golden-linux UPDATE=1  (refresh the CI/linux set)"
	@echo "  Parallel work:  make lock L=build CMD=\"pnpm -r test\" | make lock-status"
	@echo "                  the protocol: docs/PARALLEL-AGENTS.md"
