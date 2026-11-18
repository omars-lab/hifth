#!/usr/bin/env python3
"""turnstile-widget.py [--make] - the spam check's widget for hifth.app, on the new Cloudflare account.

The email form on the front page asks Cloudflare Turnstile whether a person, not a robot, filled
it in. That needs one widget on the account that holds hifth.app. A widget has two halves:

  - the site key, which is public and sits in the page (data-sitekey on the form). The repo's
    page keeps Cloudflare's test key so the form works on this laptop; --make saves the real
    one as HIFTH_APP_TURNSTILE_SITEKEY and the release puts it into the release copy;
  - the secret, which the sign-up function sends to Cloudflare to check an answer. It goes in
    the encrypted keys file as TURNSTILE_SECRET and, at release, into the site's settings.

With no flag it only looks: it says whether a widget for hifth.app exists, and prints its
site key. With --make it makes the widget if there is none, then saves its secret through
scripts/env/env-set.sh (the value goes on a pipe, never on a command line or the screen).

The token and the account ID come from .env (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID). The
token goes to curl on stdin. Neither is ever printed, and curl's own errors are not shown,
since they can carry the address, which holds the account ID.

Exit 0 when a widget exists (and, with --make, its secret is saved), 1 when there is none yet,
2 when it could not look.
"""
import json
import os
import subprocess
import sys

sys.dont_write_bytecode = True  # no __pycache__ left in the repo to be staged by mistake
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'env', 'lib'))
import envfile  # noqa: E402

API = 'https://api.cloudflare.com/client/v4'
NAME = 'hifth.app'
DOMAINS = ['hifth.app']


def call(token, method, path, body=None):
    args = ['curl', '-sS', '--max-time', '20', '-X', method, '-H', '@-']
    if body is not None:
        args += ['-H', 'Content-Type: application/json', '--data-binary', json.dumps(body)]
    try:
        p = subprocess.run(args + [API + path], input=f'Authorization: Bearer {token}\n',
                           capture_output=True, text=True, timeout=40)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if p.returncode != 0:
        return None
    try:
        return json.loads(p.stdout)
    except ValueError:
        return None


def why(answer):
    """Cloudflare's own reason, as codes and messages only."""
    if not answer:
        return 'no answer from Cloudflare (network, or curl failed)'
    errs = answer.get('errors') or []
    return '; '.join(f"{e.get('code')}: {e.get('message')}" for e in errs) or 'no reason given'


def main(argv):
    make = '--make' in argv
    env = envfile.read(os.path.join(ROOT, '.env'))
    token, account = env.get('CLOUDFLARE_API_TOKEN'), env.get('CLOUDFLARE_ACCOUNT_ID')
    if not token or not account:
        print('Cannot look: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must both be in .env '
              '(make env-bootstrap).', file=sys.stderr)
        return 2

    listed = call(token, 'GET', f'/accounts/{account}/challenges/widgets?per_page=50')
    if not listed or not listed.get('success'):
        print(f'Could not list the widgets: {why(listed)}', file=sys.stderr)
        print('If that is an authentication or permission error, the token needs the '
              'Account > Turnstile > Edit permission.', file=sys.stderr)
        return 2
    mine = [w for w in listed.get('result') or [] if NAME in (w.get('domains') or [])]

    if not mine:
        if not make:
            print(f'No widget for {NAME} yet. Run again with --make to make one.')
            return 1
        made = call(token, 'POST', f'/accounts/{account}/challenges/widgets',
                    {'name': NAME, 'domains': DOMAINS, 'mode': 'managed'})
        if not made or not made.get('success'):
            print(f'Could not make the widget: {why(made)}', file=sys.stderr)
            return 2
        widget = made['result']
        print(f'Made the widget "{NAME}" for {", ".join(DOMAINS)}, in managed mode.')
    else:
        widget = mine[0]
        print(f'A widget for {NAME} already exists ("{widget.get("name")}", mode {widget.get("mode")}).')

    sitekey = widget.get('sitekey')
    print(f'  site key (public, goes in the page): {sitekey}')
    if not make:
        return 0

    secret = widget.get('secret')
    if not secret:
        detail = call(token, 'GET', f'/accounts/{account}/challenges/widgets/{sitekey}')
        secret = ((detail or {}).get('result') or {}).get('secret')
    if not secret:
        print(f'Could not read the widget\'s secret: {why(detail)}', file=sys.stderr)
        return 2
    # The site key is public, but it is saved beside the secret so the release can put it into
    # the release copy of the front page; the repo's page keeps the test key for this laptop.
    for name, value in (('TURNSTILE_SECRET', secret), ('HIFTH_APP_TURNSTILE_SITEKEY', sitekey)):
        saved = subprocess.run(['bash', os.path.join(ROOT, 'scripts', 'env', 'env-set.sh'), name],
                               input=value + '\n', text=True, cwd=ROOT)
        if saved.returncode != 0:
            return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
