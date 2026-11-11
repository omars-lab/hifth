#!/usr/bin/env python3
"""push-secrets.py - copy secrets from .env to GitHub Actions and/or a Cloudflare Pages project.

From the cloudflare-onboarding skill.

  push-secrets.py --github owner/repo [--pages project] NAME [NAME ...]          report only
  push-secrets.py --github owner/repo [--pages project] --push NAME [NAME ...]   actually send

Without --push it only says, for each name, whether it is in .env and whether a secret of
that name already exists on GitHub / Pages (neither lets anyone read a value back, so
"there" means the name exists, not that the value matches). Pushing is the owner's call:
it replaces what the deploy uses.

Each value goes to `gh secret set` / `wrangler pages secret put` on stdin, so it is never
on a command line and never printed. wrangler is run with this repo's own
CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from .env, so it acts on this repo's
Cloudflare account, never on whatever account the laptop happens to be logged in to; if
.env has neither, a Pages push is refused.

Exit 0 all there (report) or all sent (--push) / 1 something missing or a send failed /
2 usage.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True  # no __pycache__ left in the repo to be staged by mistake
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import envfile  # noqa: E402


def wrangler_cmd():
    local = os.path.join('node_modules', '.bin', 'wrangler')
    if os.path.exists(local):
        return [local]
    if shutil.which('wrangler'):
        return ['wrangler']
    return ['npx', '-y', 'wrangler@4']


def run(cmd, stdin='', env=None):
    try:
        return subprocess.run(cmd, input=stdin, capture_output=True, text=True, timeout=120, env=env)
    except (OSError, subprocess.TimeoutExpired) as e:
        return subprocess.CompletedProcess(cmd, 127, '', f'{type(e).__name__}')


def github_names(repo):
    p = run(['gh', 'secret', 'list', '-R', repo, '--json', 'name'])
    if p.returncode != 0:
        return None
    try:
        return {s['name'] for s in json.loads(p.stdout or '[]')}
    except ValueError:
        return None


def pages_names(project, env):
    p = run(wrangler_cmd() + ['pages', 'secret', 'list', '--project-name', project], env=env)
    if p.returncode != 0:
        return None
    return set(re.findall(r'^\s*-\s*([A-Za-z_][A-Za-z0-9_]*):', p.stdout, re.M))


def main(argv):
    ap = argparse.ArgumentParser(prog='push-secrets.py', add_help=True)
    ap.add_argument('--github', metavar='OWNER/REPO')
    ap.add_argument('--pages', metavar='PROJECT')
    ap.add_argument('--push', action='store_true')
    ap.add_argument('names', nargs='+')
    try:
        a = ap.parse_args(argv)
    except SystemExit:
        return 2
    if not a.github and not a.pages:
        print('usage: give --github owner/repo and/or --pages project', file=sys.stderr)
        return 2
    if not os.path.exists('.env'):
        print('no .env here. On a new machine: make env-keys-pull && make env-bootstrap', file=sys.stderr)
        return 1

    env = envfile.read('.env')
    problems = []
    for n in a.names:
        v = env.get(n, '')
        if not v:
            problems.append(f'{n}: not in .env (save it first: make env-set NAME={n})')
        elif v.startswith('encrypted:'):
            problems.append(f'{n}: .env holds the encrypted form, not the value (make env-bootstrap)')

    wenv = None
    if a.pages:
        tok, acct = env.get('CLOUDFLARE_API_TOKEN', ''), env.get('CLOUDFLARE_ACCOUNT_ID', '')
        if not tok or not acct or tok.startswith('encrypted:'):
            problems.append('Pages: .env needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, so wrangler acts on'
                            " this repo's account and not the one this laptop is logged in to")
        else:
            wenv = dict(os.environ, CLOUDFLARE_API_TOKEN=tok, CLOUDFLARE_ACCOUNT_ID=acct)

    if a.push:
        if problems:
            for p in problems:
                print('  refused    ' + p)
            print('Nothing was sent.')
            return 1
        failed = 0
        for n in a.names:
            if a.github:
                p = run(['gh', 'secret', 'set', n, '-R', a.github], stdin=env[n])
                print(f'  {"sent" if p.returncode == 0 else "FAILED":<10} {n} -> GitHub {a.github}')
                failed += p.returncode != 0
            if a.pages:
                p = run(wrangler_cmd() + ['pages', 'secret', 'put', n, '--project-name', a.pages], stdin=env[n], env=wenv)
                print(f'  {"sent" if p.returncode == 0 else "FAILED":<10} {n} -> Pages {a.pages}')
                failed += p.returncode != 0
        return 1 if failed else 0

    # Report only.
    gh = github_names(a.github) if a.github else None
    pg = pages_names(a.pages, wenv) if (a.pages and wenv) else None
    missing = bool(problems)
    for p in problems:
        print('  problem    ' + p)
    for n in a.names:
        cells = [f'{n}:', 'in .env' if env.get(n) else 'NOT in .env']
        if a.github:
            if gh is None:
                cells.append('GitHub: could not ask (gh auth status?)'); missing = True
            elif n in gh:
                cells.append('on GitHub')
            else:
                cells.append('not on GitHub'); missing = True
        if a.pages:
            if pg is None:
                cells.append('Pages: could not ask'); missing = True
            elif n in pg:
                cells.append('on Pages')
            else:
                cells.append('not on Pages'); missing = True
        print('  ' + '  '.join(cells))
    print('("on" means a secret with that name exists; nobody can read it back to compare values.)')
    if missing:
        print('To send them: add --push (it replaces what the deploy uses).')
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
