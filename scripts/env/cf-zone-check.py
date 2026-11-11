#!/usr/bin/env python3
"""cf-zone-check.py <domain> - has this domain moved to Cloudflare yet, and if not, what is the next step?

From the cloudflare-onboarding skill. It looks in three places and says what each one shows:

  1. the registry (what the domain's registrar, e.g. Namecheap, has told the world):
     the nameservers on record, asked of the registry's own nameservers directly;
     RDAP (https://rdap.org/domain/<domain>) only if they give no answer, since
     RDAP can serve a stale cached copy
  2. the internet's resolvers: what `dig NS <domain>` answers today (lags the registry by
     up to a day or two; that lag is normal)
  3. Cloudflare: whether the domain has been added to the account, its status
     (pending / active) and the two nameservers Cloudflare assigned it. This needs a
     token with Zone Read, taken from .env (--token-name, default CLOUDFLARE_API_TOKEN,
     then CLOUDFLARE_DNS_TOKEN, then any other CLOUDFLARE_*TOKEN*). Without one, steps 1
     and 2 still run.

Then it gives one plain verdict and the next step. Exit 0 when Cloudflare says active,
1 when there is a step left, 2 when it could not look. The token goes to curl on stdin
and is never printed.
"""
import json
import os
import re
import subprocess
import sys

sys.dont_write_bytecode = True  # no __pycache__ left in the repo to be staged by mistake
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import envfile  # noqa: E402

API = 'https://api.cloudflare.com/client/v4'


def curl(url, token=None):
    args = ['curl', '-sSL', '--max-time', '20']
    stdin = ''
    if token:
        args += ['-H', '@-']
        stdin = f'Authorization: Bearer {token}\n'
    try:
        p = subprocess.run(args + [url], input=stdin, capture_output=True, text=True, timeout=40)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if p.returncode != 0:
        return None
    try:
        return json.loads(p.stdout)
    except ValueError:
        return None


def norm(names):
    return sorted({n.lower().rstrip('.') for n in names if n})


def dig(args):
    try:
        p = subprocess.run(['dig'] + args, capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return p.stdout if p.returncode == 0 else None


def tld_ns(domain):
    """Ask the top-level registry's own nameservers (for .app, Google's) which
    nameservers they hand out for the domain. This is the live answer: RDAP can
    serve an hour-old copy from a cache, which said "not moved" for hifth.app
    after the registry had already switched (2026-11-11)."""
    tld = domain.rsplit('.', 1)[-1]
    servers = (dig(['+short', 'NS', tld]) or '').split()
    for server in servers[:3]:
        out = dig(['+norecurse', '+noall', '+authority', '+answer', 'NS', domain, f'@{server.rstrip(".")}'])
        if not out:
            continue
        names = [f[4] for f in (line.split() for line in out.splitlines())
                 if len(f) >= 5 and f[3].upper() == 'NS' and f[0].lower().rstrip('.') == domain]
        if names:
            return norm(names)
    return None


def registry_ns(domain):
    live = tld_ns(domain)
    if live:
        return live
    d = curl(f'https://rdap.org/domain/{domain}')
    if d is None:
        return None
    return norm(ns.get('ldhName', '') for ns in d.get('nameservers') or [])


def resolver_ns(domain):
    try:
        p = subprocess.run(['dig', '+short', 'NS', domain], capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if p.returncode != 0:
        return None
    return norm(p.stdout.split())


def pick_token(name):
    if not os.path.exists('.env'):
        return None, None
    env = envfile.read('.env')
    # The usual two first, then any other saved Cloudflare token (e.g. a read-only one).
    others = sorted(k for k in env if re.match(r'^(CLOUDFLARE|CF)_.*TOKEN', k)
                    and k not in ('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_DNS_TOKEN'))
    for n in ([name] if name else ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_DNS_TOKEN'] + others):
        v = env.get(n, '')
        if v and not v.startswith('encrypted:'):
            return n, v
    return None, None


def main(argv):
    token_name = None
    args = []
    i = 0
    while i < len(argv):
        if argv[i] == '--token-name' and i + 1 < len(argv):
            token_name = argv[i + 1]
            i += 2
            continue
        args.append(argv[i])
        i += 1
    if len(args) != 1:
        print('usage: cf-zone-check.py <domain> [--token-name NAME]', file=sys.stderr)
        return 2
    domain = args[0].lower().rstrip('.')

    reg = registry_ns(domain)
    res = resolver_ns(domain)
    print(f'{domain}')
    print(f'  registry says      {", ".join(reg) if reg else ("(could not ask)" if reg is None else "(no nameservers on record)")}')
    print(f'  resolvers say      {", ".join(res) if res else ("(could not ask)" if res is None else "(no answer)")}')

    name, token = pick_token(token_name)
    if not token:
        print('  Cloudflare says    (not checked: no token in .env with Zone Read; save one with make env-set)')
        on_cf = bool(reg) and all(n.endswith('.ns.cloudflare.com') for n in reg)
        print('')
        if on_cf:
            print('Verdict: the registry already points at Cloudflare nameservers. Check the account shows it active.')
            if res != reg:
                print('         Some resolvers still show the old nameservers; that clears by itself within a day or two.')
        else:
            print('Verdict: the registry does not point at Cloudflare yet. Add the domain in the Cloudflare dashboard,')
            print('         then put the two nameservers it gives you into the registrar (Namecheap: Domain List >')
            print('         Manage > Nameservers > Custom DNS > the green tick).')
        return 1

    z = curl(f'{API}/zones?name={domain}', token)
    if z is None:
        print(f'  Cloudflare says    (could not ask: no answer from Cloudflare)')
        return 2
    if not z.get('success'):
        codes = ','.join(str(e.get('code')) for e in z.get('errors') or []) or '?'
        print(f'  Cloudflare says    refused {name} (code {codes}); it needs Zone Read on this domain')
        return 2
    zones = z.get('result') or []
    if not zones:
        print(f'  Cloudflare says    not added to the account {name} can see')
        print('')
        print('Verdict: add the domain in the Cloudflare dashboard (Add a domain, Free plan) first.')
        return 1
    zone = zones[0]
    cf = norm(zone.get('name_servers') or [])
    status = zone.get('status', '?')
    print(f'  Cloudflare says    {status}; assigned {", ".join(cf)}')
    # A token can see the domain and still be refused its DNS records (hifth's first
    # edit token, 2026-11-11, lacked the DNS permission), so ask for them too.
    dns_ok = True
    if zone.get('id'):
        rec = curl(f'{API}/zones/{zone["id"]}/dns_records?per_page=100', token)
        if rec is not None and rec.get('success'):
            print(f'  DNS records        {len(rec.get("result") or [])} readable with {name}')
        elif rec is not None:
            dns_ok = False
            codes = ','.join(str(e.get('code')) for e in rec.get('errors') or []) or '?'
            print(f'  DNS records        refused to {name} (code {codes})')
    print('')
    if status == 'active':
        if not dns_ok:
            print(f'Verdict: Cloudflare runs DNS for {domain}, but {name} cannot read its DNS records. In the')
            print('         dashboard (Profile > API Tokens > the token > Edit), add the permission')
            print(f'         Zone → DNS → Edit, with Zone Resources set to {domain}.')
            return 1
        lag = '' if res == cf else ' Some resolvers still show the old nameservers; that clears by itself.'
        print(f'Verdict: done. Cloudflare runs DNS for {domain}.{lag}')
        return 0
    if reg == cf:
        print('Verdict: the registrar has the right nameservers; Cloudflare has not noticed yet. That can take up')
        print('         to a day. "Check nameservers now" on the domain\'s page in the dashboard asks it to look again.')
        return 1
    print('Verdict: change the nameservers at the registrar to exactly these two:')
    for n in cf:
        print(f'           {n}')
    print('         (Namecheap: Domain List > Manage > Nameservers > Custom DNS > enter both > the green tick.)')
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
