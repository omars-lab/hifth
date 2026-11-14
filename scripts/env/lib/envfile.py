#!/usr/bin/env python3
"""envfile.py - the ONE reader and writer of .env files for these scripts.

From the cloudflare-onboarding skill. env-sync.sh (check), env-set.sh,
cf-token-check.py and push-secrets.py all read .env through `parse`, so no two
of them can disagree about what a line means.

As a command:
  envfile.py compare <plain> <sidecar>   decrypted copy in $DEC_ENV; names only
  envfile.py set <NAME> <file>           value on stdin; never printed; refused if
                                         it is not the shape formats.py expects
  envfile.py hint <NAME>                 the expected shape, if formats.py has one
  envfile.py check <NAME> <file>         is the saved value the expected shape? names only
  envfile.py shapes <file>               check every saved name formats.py has a shape for

As a module: parse(text) -> dict, read(path) -> dict.

Nothing here prints a value.
"""
import os
import re
import sys
import tempfile

sys.dont_write_bytecode = True  # no __pycache__ folder left beside the scripts
import formats  # noqa: E402

LINE = re.compile(r'^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$')
NAME = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')


def parse(text, bad=None):
    """KEY -> value. Blank lines and comments are skipped; the public-key line too.
    A line that is neither is recorded in `bad` (when given): a skipped line is a
    key nobody checks."""
    out = {}
    for n, line in enumerate(text.splitlines(), 1):
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        m = LINE.match(s)
        if not m:
            if bad is not None:
                bad.append(n)
            continue
        k, v = m.group(1), m.group(2)
        if v[:1] not in ('"', "'"):
            v = re.sub(r'\s+#.*$', '', v)  # dotenvx drops an unquoted inline comment
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            q, v = v[0], v[1:-1]
            if q == '"':
                v = v.replace('\\"', '"').replace('\\\\', '\\')
        if k.startswith('DOTENV_PUBLIC_KEY'):
            continue
        out[k] = v
    return out


def read(path):
    with open(path) as f:
        return parse(f.read())


def quote(value):
    """The form to write a value in, so it reads back exactly. Single quotes turn
    off $-expansion; a value holding a single quote goes in double quotes."""
    if '\n' in value or '\r' in value:
        raise ValueError('a value cannot span lines')
    if "'" not in value:
        return "'" + value + "'"
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


def cmd_set(name, path):
    if not NAME.match(name):
        print(f"ERROR: '{name}' is not a valid name (letters, digits, _; not starting with a digit)", file=sys.stderr)
        return 2
    value = sys.stdin.readline().rstrip('\r\n')
    if not value:
        print(f"ERROR: no value given for {name}; nothing saved", file=sys.stderr)
        return 1
    wrong = formats.problems(name, value)
    if wrong:
        print(f"ERROR: {name} is not the expected shape; nothing saved:", file=sys.stderr)
        for w in wrong:
            print(f"  - {w}", file=sys.stderr)
        for line in formats.hint(name):
            print(f"  {line}", file=sys.stderr)
        return 1
    try:
        line = f"{name}={quote(value)}\n"
    except ValueError as e:
        print(f"ERROR: {e}; nothing saved", file=sys.stderr)
        return 1
    lines = open(path).read().splitlines(keepends=True) if os.path.exists(path) else []
    replaced, out = False, []
    for old in lines:
        m = LINE.match(old.strip())
        if m and m.group(1) == name:
            if not replaced:
                out.append(line)
                replaced = True
            continue  # drop any duplicate of the same name
        out.append(old)
    if not replaced:
        if out and not out[-1].endswith('\n'):
            out[-1] += '\n'
        out.append(line)
    d = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=d, prefix='.env.tmp.')
    try:
        os.chmod(tmp, 0o600)
        with os.fdopen(fd, 'w') as f:
            f.writelines(out)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    print(f"  saved      {name} in {os.path.basename(path)} ({'replaced' if replaced else 'added'})")
    return 0


def cmd_check(name, path):
    """The saved value's shape, by name only. Exit 1 when wrong or missing."""
    value = read(path).get(name) if os.path.exists(path) else None
    if not value:
        print(f"  MISSING    {name} is not in {os.path.basename(path)}", file=sys.stderr)
        return 1
    wrong = formats.problems(name, value)
    if wrong:
        print(f"  WRONG      {name} is not the expected shape:", file=sys.stderr)
        for w in wrong:
            print(f"    - {w}", file=sys.stderr)
        return 1
    print(f"  ok         {name} is the expected shape" if formats.hint(name)
          else f"  saved      {name} (no shape on file to check)")
    return 0


def cmd_shapes(path):
    """Every saved value with a shape on file, checked. A name not saved is not an error."""
    if not os.path.exists(path):
        return 0
    saved = read(path)
    names = [n for n in formats.FORMATS if n in saved]
    return max([cmd_check(n, path) for n in names], default=0)


def cmd_compare(plain_path, sidecar):
    bad = []
    plain = parse(open(plain_path).read(), bad=bad)
    dec = parse(os.environ['DEC_ENV'])
    missing = sorted(set(plain) - set(dec))
    extra = sorted(set(dec) - set(plain))
    differ = sorted(k for k in set(plain) & set(dec) if plain[k] != dec[k])
    if bad:
        print(f"  FAIL       {plain_path}: lines {bad} are not KEY=value; cannot check them", file=sys.stderr)
    if missing:
        print(f"  DRIFT      in {plain_path} but not {sidecar}: {', '.join(missing)}", file=sys.stderr)
    if extra:
        print(f"  DRIFT      in {sidecar} but not {plain_path}: {', '.join(extra)}", file=sys.stderr)
    if differ:
        print(f"  DRIFT      value differs (names only): {', '.join(differ)}", file=sys.stderr)
    if bad or missing or extra or differ:
        print("             Fix with: make env-encrypt", file=sys.stderr)
        return 1
    print(f"  in sync    {plain_path} == {sidecar}  ({len(plain)} keys)")
    return 0


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) == 3 and a[0] == 'compare':
        sys.exit(cmd_compare(a[1], a[2]))
    if len(a) == 3 and a[0] == 'set':
        sys.exit(cmd_set(a[1], a[2]))
    if len(a) == 2 and a[0] == 'hint':
        for line in formats.hint(a[1]):
            print(line)
        sys.exit(0)
    if len(a) == 3 and a[0] == 'check':
        sys.exit(cmd_check(a[1], a[2]))
    if len(a) == 2 and a[0] == 'shapes':
        sys.exit(cmd_shapes(a[1]))
    print('usage: envfile.py compare <plain> <sidecar> | set <NAME> <file> | hint <NAME> | check <NAME> <file>', file=sys.stderr)
    sys.exit(2)
