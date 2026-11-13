"""formats.py - what shape each saved secret should be, checked before it is saved.

The hidden-prompt save (make env-set) shows the shape from here before asking,
and refuses a value of the wrong shape. A refusal names the part that is wrong,
never the value: the value may be a password.

A name with no entry here is saved as given. To add one, add an entry to FORMATS
with a `hint` (the lines shown before the prompt) and a `check` (value -> list of
problems, each a plain sentence that does not repeat the value).
"""
import re
from urllib.parse import parse_qs, urlsplit

# The new store's region. An address in another region is the old store's.
STORE_REGION = 'us-east-1'


def _supabase_db_url(value):
    if re.search(r'\s', value):
        return ['it has a space or a line break in it; paste the address on its own']
    if not re.match(r'postgres(ql)?://', value):
        return ['it should start with postgresql:// (it is the database address, not the web address)']
    if '[YOUR-PASSWORD]' in value or re.search(r'\[[^\]]*\]', value):
        return ["the dashboard's [YOUR-PASSWORD] placeholder is still in it; put the database password there"]
    rest = value.split('://', 1)[1]
    if rest.count('@') > 1:
        return ['the password has an @ in it, which must be written %40']
    if '#' in rest:
        return ['the password has a # in it, which must be written %23']
    try:
        u = urlsplit(value)
        port = u.port
    except ValueError:
        return ['the part after the host is not a port number; a / or ? in the password must be written %2F or %3F']
    host = u.hostname or ''
    problems = []
    if not u.password:
        problems.append('it has no password (expected postgres.<project ref>:<password>@...)')
    if host.startswith('db.') and host.endswith('.supabase.co'):
        return ['that is the direct address, which needs IPv6 and this laptop has none; '
                'use the session pooler address (Connect, then Session pooler)']
    if not host.endswith('.pooler.supabase.com'):
        problems.append('the host should end in .pooler.supabase.com (the session pooler)')
    elif f'-{STORE_REGION}.' not in host:
        problems.append(f'the host is in another region; the new store is in {STORE_REGION} '
                        '(an address elsewhere is probably the old store)')
    if not re.fullmatch(r'postgres\.[a-z0-9]{20}', u.username or ''):
        problems.append('the pooler needs the user written postgres.<project ref>, not just postgres')
    if port == 6543:
        problems.append('port 6543 is the transaction pooler; use the session pooler, port 5432')
    elif port != 5432:
        problems.append('the port should be 5432 (the session pooler)')
    if u.path != '/postgres':
        problems.append('the database name at the end should be /postgres')
    mode = (parse_qs(u.query).get('sslmode') or [''])[0]
    if mode in ('disable', 'allow', 'prefer'):
        problems.append('sslmode would allow unencrypted connections, which the store refuses; '
                        'leave sslmode out or set it to require')
    return problems


FORMATS = {
    'SUPABASE_DB_URL': {
        'hint': [
            'Expected: the session pooler address from the Supabase dashboard (Connect, then Session pooler):',
            f'  postgresql://postgres.<project ref>:<password>@aws-0-{STORE_REGION}.pooler.supabase.com:5432/postgres',
            'Put the database password in place of [YOUR-PASSWORD]. Write @ as %40, # as %23, / as %2F, ? as %3F.',
        ],
        'check': _supabase_db_url,
    },
}


def hint(name):
    f = FORMATS.get(name)
    return f['hint'] if f else []


def problems(name, value):
    f = FORMATS.get(name)
    return f['check'](value) if f else []
