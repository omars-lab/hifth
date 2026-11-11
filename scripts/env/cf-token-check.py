#!/usr/bin/env python3
"""cf-token-check.py - do the Cloudflare tokens saved in .env still work, and when do they end?

From the cloudflare-onboarding skill.

  cf-token-check.py                       check every CLOUDFLARE_*TOKEN* / CF_*TOKEN* in .env
  cf-token-check.py NAME [NAME ...]       check only these
  cf-token-check.py --session-start       for a SessionStart hook: silent when all is well;
                                          otherwise prints what is wrong and tells the session
                                          to ask the owner. Never blocks (always exits 0).

Cloudflare checks a token in one of two places, depending on where it was made:
  a token made in the user profile   GET /client/v4/user/tokens/verify
  a token made under the account     GET /client/v4/accounts/<id>/tokens/verify
The user-profile check is asked first; if it refuses and CLOUDFLARE_ACCOUNT_ID is set, the
account check is asked too.

A token is never printed and never put on a command line: it reaches curl on stdin
(`-H @-`), so it does not show up in `ps` or in a log of commands. Exit 0 when every
token works and has more than 14 days left; 1 otherwise.
"""
import datetime
import json
import os
import re
import subprocess
import sys

sys.dont_write_bytecode = True  # no __pycache__ left in the repo to be staged by mistake
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import envfile  # noqa: E402

API = 'https://api.cloudflare.com/client/v4'
WARN_DAYS = 14
TOKEN_NAME = re.compile(r'^(CLOUDFLARE|CF)_.*TOKEN')


class CouldNotCheck(Exception):
    pass


def verify(url, token):
    """Cloudflare's answer as a dict. Raises CouldNotCheck when there is no answer."""
    try:
        p = subprocess.run(
            ['curl', '-sS', '--max-time', '15', '-H', '@-', url],
            input=f'Authorization: Bearer {token}\n', capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        raise CouldNotCheck(f'curl did not run ({type(e).__name__})')
    if p.returncode != 0:
        raise CouldNotCheck(f'could not reach Cloudflare (curl exit {p.returncode})')
    try:
        return json.loads(p.stdout)
    except ValueError:
        raise CouldNotCheck('Cloudflare sent back something that is not JSON')


def check_one(name, token, account_id):
    """(ok, line) for one token. The line names the token, never its value."""
    if token.startswith('encrypted:'):
        return False, f'{name}: holds an encrypted value, not a token. Rebuild .env: make env-bootstrap'
    where, ans = 'user profile', verify(f'{API}/user/tokens/verify', token)
    if not ans.get('success') and account_id:
        where, ans = 'account', verify(f'{API}/accounts/{account_id}/tokens/verify', token)
    if not ans.get('success'):
        codes = ','.join(str(e.get('code')) for e in ans.get('errors') or []) or '?'
        hint = '' if account_id else ' (if it was made under the account, set CLOUDFLARE_ACCOUNT_ID too)'
        return False, f'{name}: refused by Cloudflare (code {codes}). Make a new one and save it: make env-set NAME={name}{hint}'
    r = ans.get('result') or {}
    status = r.get('status', '?')
    made = f'made in your {where}' if where == 'user profile' else 'made under the account'
    if status != 'active':
        return False, f'{name}: Cloudflare says it is {status} ({made}). Make a new one: make env-set NAME={name}'
    exp = r.get('expires_on')
    if not exp:
        return True, f'{name}: works ({made}), no end date'
    end = datetime.datetime.strptime(exp[:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=datetime.timezone.utc)
    days = (end - datetime.datetime.now(datetime.timezone.utc)).days
    when = f'ends in {days} day{"" if days == 1 else "s"} ({end:%Y-%m-%d})'
    if days <= WARN_DAYS:
        return False, f'{name}: works ({made}) but {when}. Renew it in the dashboard, then: make env-set NAME={name}'
    return True, f'{name}: works ({made}), {when}'


def main(argv):
    session = '--session-start' in argv
    names = [a for a in argv if not a.startswith('--')]

    def say(lines, rc):
        if session:
            if lines:
                print('Cloudflare tokens in this repo need a look:')
                for l in lines:
                    print('  - ' + l)
                print('Ask the owner with AskUserQuestion at the start of this session: renew or fix it now,'
                      ' or not this session (anything that deploys or changes DNS may fail until it is done).')
            return 0
        for l in lines:
            print('  ' + l)
        return rc

    if not os.path.exists('.env'):
        if os.path.exists('.env.encrypted'):
            return say(['could not check tokens: there is no .env here, only the encrypted copy.'
                        ' Rebuild it first: make env-bootstrap'], 1)
        return say(['no Cloudflare token saved yet (no .env here)'], 1)

    env = envfile.read('.env')
    wanted = names or sorted(k for k in env if TOKEN_NAME.match(k))
    if not wanted:
        return say(['no Cloudflare token saved yet (nothing named CLOUDFLARE_*TOKEN* in .env)'], 1)

    account_id = env.get('CLOUDFLARE_ACCOUNT_ID', '')
    bad, good = [], []
    for name in wanted:
        token = env.get(name, '')
        if not token:
            bad.append(f'{name}: not in .env')
            continue
        try:
            ok, line = check_one(name, token, account_id)
        except CouldNotCheck as e:
            ok, line = False, f'could not check {name}: {e}'
        (good if ok else bad).append(line)

    if session:
        return say(bad, 0)
    return say(good + bad, 1 if bad else 0)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
