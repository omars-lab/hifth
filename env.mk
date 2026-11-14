# written by cloudflare-onboarding - rerun the skill's install.sh to update; edits here are overwritten.
#
# Secrets: .env (plaintext, ignored) is what everything reads; .env.encrypted
# (ciphertext) is what is committed; .env.keys (the private key, ignored) is
# backed up in LastPass as dotenvx/<repo>. None of these targets prints a value.

ENV_SCRIPTS := scripts/env

.PHONY: env-set env-encrypt env-check env-check-staged env-bootstrap \
        env-keys-pull env-keys-push env-keys-status cf-tokens cf-zone push-secrets

## env-set NAME=X   save one secret: you paste it at a hidden prompt (run in your own terminal)
env-set:
	@test -n "$(NAME)" || { echo "usage: make env-set NAME=CLOUDFLARE_API_TOKEN" >&2; exit 2; }
	@bash $(ENV_SCRIPTS)/env-set.sh $(NAME)

## env-encrypt      rebuild .env.encrypted from .env (after editing .env by hand)
env-encrypt:
	@bash $(ENV_SCRIPTS)/env-sync.sh encrypt

## env-check        no plaintext secret is tracked, .env matches its encrypted copy, and each saved value is the shape expected
env-check:
	@sh $(ENV_SCRIPTS)/check-env-encrypted.sh
	@bash $(ENV_SCRIPTS)/env-sync.sh check
	@python3 $(ENV_SCRIPTS)/lib/envfile.py shapes .env

## env-check-staged no plaintext secret is about to be committed (for the pre-commit hook)
env-check-staged:
	@sh $(ENV_SCRIPTS)/check-env-encrypted.sh --staged

## env-bootstrap    a new machine: rebuild .env from .env.encrypted (after env-keys-pull)
env-bootstrap:
	@bash $(ENV_SCRIPTS)/env-sync.sh bootstrap

## env-keys-pull / env-keys-push / env-keys-status   the private key and LastPass
env-keys-pull:
	@bash $(ENV_SCRIPTS)/env-keys.sh pull
env-keys-push:
	@bash $(ENV_SCRIPTS)/env-keys.sh push
env-keys-status:
	@bash $(ENV_SCRIPTS)/env-keys.sh status

## cf-tokens        do the saved Cloudflare tokens still work, and when do they end?
cf-tokens:
	@python3 $(ENV_SCRIPTS)/cf-token-check.py $(NAMES)

## cf-zone DOMAIN=x has the domain moved to Cloudflare yet?
cf-zone:
	@test -n "$(DOMAIN)" || { echo "usage: make cf-zone DOMAIN=example.app" >&2; exit 2; }
	@python3 $(ENV_SCRIPTS)/cf-zone-check.py $(DOMAIN)

## push-secrets ARGS="--github owner/repo NAME ..."   check (default) or --push secrets to GitHub / Pages
push-secrets:
	@python3 $(ENV_SCRIPTS)/push-secrets.py $(ARGS)
