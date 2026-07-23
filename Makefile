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
WEB   := $(PNPM) --filter @hifth/web
CORE  := $(PNPM) --filter @hifth/core
ETL   := $(PNPM) --filter @hifth/etl

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
etl: core ## Run the full ETL (extract pages + build adjacency shards) into assets
	$(ETL) extract:pages
	$(ETL) build:adjacency

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
e2e: core ## Playwright mobile e2e (iPhone WebKit + Android Chromium)
	$(WEB) build
	$(WEB) test:e2e

.PHONY: core
core: ## Build @hifth/core only (needed before typecheck/test — the Loop 0 lesson)
	$(CORE) build

.PHONY: gates
gates: build ## The static gates: no <text> in SVG, license present, JS budget <150KB gz
	$(PNPM) gates

.PHONY: secrets
secrets: ## Scan the working tree + history for committed secrets (gitleaks)
	@command -v gitleaks >/dev/null 2>&1 || { echo "gitleaks not installed: brew install gitleaks"; exit 1; }
	gitleaks git --redact --config .gitleaks.toml
	gitleaks dir . --redact --config .gitleaks.toml

.PHONY: ci
ci: core ## Full local mirror of the CI build-test-gate job, IN CI ORDER
	$(ETL) extract:pages
	$(ETL) build:adjacency
	@git diff --quiet -- apps/web/public/assets \
	  || { echo "::error:: ETL output differs from committed assets (run: make etl)"; exit 1; }
	$(PNPM) lint
	$(PNPM) typecheck
	$(PNPM) test
	$(PNPM) audit:corpus
	$(PNPM) gate:notext
	$(PNPM) gate:license
	$(CORE) build && $(WEB) build
	$(PNPM) gate:budget
	@echo ""
	@echo "  ✓ build-test-gate mirror passed. (CI also runs the e2e job: make e2e)"

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
loop-verify: ci ## Verify a loop is landable: full CI mirror + e2e (its on-device check is manual)
	@$(MAKE) e2e
	@echo ""
	@echo "  ✓ CI mirror + e2e green. Now do the on-device check in §Loop $(N) of PLAN.md,"
	@echo "    then write docs/decisions/loop-$(N).md and update the Status table."

# ---------------------------------------------------------------------------
# On-device checks (open these on a real phone on the same Wi-Fi)
# ---------------------------------------------------------------------------

.PHONY: phone
phone: build ## Serve the built app for your phone; prints the LAN URL to open
	@echo ""
	@echo "  Open on your phone (same Wi-Fi):  http://$(LAN_IP):$(PORT)"
	@echo ""
	$(WEB) exec vite preview --host --port $(PORT)

.PHONY: perf
perf: ## Run the pan/zoom perf harness (emulated baseline; prints the on-device recipe)
	@echo "  Follow-up ① (gates Loop 4): capture real-device fps — see the recipe this prints."
	$(WEB) perf

# ---------------------------------------------------------------------------

.PHONY: help
help: ## List targets (this)
	@echo "Hifth — make targets:"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | sort \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  Loop workflow:  make status | make loop N=2 | make loop-verify N=2"
	@echo "  On device:      make phone | make perf"
