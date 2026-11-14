#!/usr/bin/env python3
"""guard-secrets.py - stop a Claude session from printing a saved secret.

A PreToolUse hook for Bash, Read and Grep. It reads the tool call as JSON on stdin and
refuses it (exit 2, the reason on stderr) when it could show a value from the plain settings
file (.env), the key file (.env.keys) or the password manager.

Why: on 2026-11-13 a hand-run `dotenvx decrypt` with stdout sent to /dev/null still printed
every saved value into a chat, because through npx the tool wrote them to stderr.

How it decides, for each command in a Bash line (split at |, ;, &&, || and newlines, with
quoted text kept whole, so a commit message that mentions a command is not that command):

  - dotenvx decrypt, get or keypair: refused, however the output is redirected.
  - dotenvx run --debug: refused (it prints each value it loads).
  - dotenvx run -- followed by a command that prints the environment (env, printenv, echo,
    a shell, node -e/-p, python -c, ...): refused. Running a script file is fine.
  - lpass show: refused (it prints the key that opens the encrypted copy).
  - a recursive search (grep -r, rg --hidden or -u, ag -u) over a folder that holds a plain
    settings file: refused unless it excludes .env*. Plain grep -r ignores .gitignore.
  - anything else that names .env, .env.keys or .env.<name> (not .env.encrypted or
    .env.example): refused, unless it is one of the commands that never print a file's
    contents (make, ls, git, mv, rm, test, ...) or one of our own name-only scripts.
    Naming the file is the test, not a list of reading commands, because the list of ways to
    read a file has no end (cat, cp then cat, $(<.env), a python heredoc, ...).

The Read and Grep tools are refused on the plain file or the key file.

This is a seatbelt, not a wall: it stops the honest mistake, not a determined script. When it
cannot read the tool call it lets the call through and says so to the person, so a fault in it
never stops all work and is never silent.
"""
import json
import os
import re
import shlex
import sys

SAFE_COMMANDS = """Refused: this could print a saved secret into the chat.
Use the commands that show names, shapes and dates only:
  make env-check            the plain file matches the encrypted copy; each value has the right shape
  make cf-tokens            each Cloudflare token works, and when it ends
  make cf-zone              the domain's settings, read with the read-only token
  make env-keys-status      the key here matches the copy in LastPass
  python3 scripts/env/lib/envfile.py check NAME .env    one value's shape
Saving or changing a value is the owner's, in their own terminal: make env-set NAME=X.
The secrets skill lists every saved entry and the commands for it."""

SECRET_FILE = re.compile(r'(?<![\w.-])\.env(?:\.keys|\.(?!encrypted\b|example\b)[\w-]+)?(?![\w.-])')

# Commands that never print what is inside a file they are given.
NEVER_PRINTS = {'make', 'ls', 'stat', 'test', '[', '[[', 'mv', 'rm', 'touch', 'chmod', 'git', 'wc', 'file'}
# Our own scripts that print names, shapes and dates only.
OWN_SCRIPTS = re.compile(r'(^|/)(scripts/env|\.claude/skills/secrets/scripts)/')
INTERPRETERS = {'python', 'python3', 'bash', 'sh', 'zsh', 'node'}
PRINTS_ENV = {'env', 'printenv', 'set', 'export', 'declare', 'echo', 'printf', 'cat', 'sh', 'bash', 'zsh'}
INLINE_CODE = {'node': {'-e', '-p', '--eval', '--print'}, 'python': {'-c'}, 'python3': {'-c'}}
SEPARATORS = {'|', '||', '&', '&&', ';', ';;', '(', ')', '|&'}


def secret_file(text):
    return bool(SECRET_FILE.search(text or ''))


def segments(command):
    """Split a shell line into simple commands, keeping quoted text whole."""
    try:
        lex = shlex.shlex(command.replace('\n', ' ; '), posix=True, punctuation_chars=True)
        lex.whitespace_split = True
        tokens = list(lex)
    except ValueError:
        tokens = command.replace('\n', ' ; ').split()
    out, cur = [], []
    for t in tokens:
        if t in SEPARATORS:
            if cur:
                out.append(cur)
            cur = []
        else:
            cur.append(t)
    if cur:
        out.append(cur)
    return out


def strip_prefix(w):
    """Drop FOO=bar, sudo, npx/pnpm exec and their flags, so w[0] is the real command."""
    w = list(w)
    while w and re.match(r'^[A-Za-z_][A-Za-z0-9_]*=', w[0]):
        w = w[1:]
    if w and w[0] in ('sudo', 'command', 'exec', 'time'):
        w = w[1:]
    if w and w[0] in ('npx', 'pnpx', 'bunx'):
        w = w[1:]
        while w and w[0].startswith('-'):
            w = w[1:]
    elif len(w) > 1 and w[0] in ('pnpm', 'yarn', 'npm') and w[1] in ('exec', 'dlx', 'x'):
        w = w[2:]
    return w


def is_dotenvx(word):
    return 'dotenvx' in os.path.basename(word or '').split('@')[0] or word.startswith('@dotenvx/')


def dotenvx_refused(w):
    rest = w[1:]
    sub = next((x for x in rest if not x.startswith('-')), '')
    if sub in ('decrypt', 'get', 'keypair'):
        return True
    if sub == 'run':
        before, _, after = list_split(rest, '--')
        if '--debug' in before or '--trace' in before:
            return True
        if after:
            cmd = os.path.basename(after[0])
            if cmd in PRINTS_ENV:
                return True
            if any(x in INLINE_CODE.get(cmd, ()) for x in after[1:]):
                return True
    return False


def list_split(items, sep):
    if sep in items:
        i = items.index(sep)
        return items[:i], sep, items[i + 1:]
    return items, '', []


def recursive_search_refused(w, cwd):
    cmd = os.path.basename(w[0])
    opts = [x for x in w[1:] if x.startswith('-')]
    if any('exclude' in o and '.env' in o for o in opts):
        return False
    if cmd in ('grep', 'egrep', 'fgrep'):
        recursive = any(o in ('--recursive', '--dereference-recursive') or
                        (not o.startswith('--') and set('rR') & set(o)) for o in opts)
    elif cmd == 'rg':
        recursive = any(o in ('--hidden', '--no-ignore', '-.') or re.match(r'^-u+$', o) for o in opts)
    elif cmd == 'ag':
        recursive = any(o in ('-u', '--unrestricted', '--hidden') for o in opts)
    else:
        return False
    if not recursive:
        return False
    args = [x for x in w[1:] if not x.startswith('-')]
    has_pattern_flag = any(o in ('-e', '-f') or o.startswith(('--regexp', '--file')) for o in opts)
    paths = args if has_pattern_flag else args[1:]
    for p in paths or ['.']:
        d = os.path.join(cwd, os.path.expanduser(p))
        if os.path.isdir(d) and any(os.path.exists(os.path.join(d, f)) for f in ('.env', '.env.keys')):
            return True
    return False


def safe_runner(w):
    if not w:
        return False
    cmd = os.path.basename(w[0])
    if cmd in NEVER_PRINTS:
        return True
    if cmd in INTERPRETERS:
        script = next((x for x in w[1:] if not x.startswith('-')), '')
        return bool(OWN_SCRIPTS.search(script))
    if OWN_SCRIPTS.search(w[0]):
        return True
    if is_dotenvx(w[0]):
        return not dotenvx_refused(w)    # checked on its own below
    return False


def bash_refused(command, cwd):
    for raw in segments(command):
        w = strip_prefix(raw)
        if not w:
            if any(secret_file(x) for x in raw):
                return True
            continue
        if is_dotenvx(w[0]) and dotenvx_refused(w):
            return True
        if os.path.basename(w[0]) == 'lpass' and len(w) > 1 and w[1] == 'show':
            return True
        if recursive_search_refused(w, cwd):
            return True
        named = [x for x in raw if not x.startswith(('--exclude', '--glob=!', '--iglob=!'))]
        if any(secret_file(x) for x in named) and not safe_runner(w):
            return True
    return False


def refused(call):
    tool = call.get('tool_name', '')
    args = call.get('tool_input') or {}
    if tool == 'Bash':
        return bash_refused(args.get('command', ''), call.get('cwd') or os.getcwd())
    if tool in ('Read', 'Grep'):
        target = args.get('file_path') or args.get('path') or ''
        return bool(SECRET_FILE.search(os.path.basename(target.rstrip('/'))))
    return False


def main():
    try:
        call = json.load(sys.stdin)
        verdict = refused(call)
    except Exception as e:  # never stop all work over a fault in the guard, but say so
        print(json.dumps({'systemMessage': f'secrets guard could not check this call ({type(e).__name__}); it was let through'}))
        return 0
    if verdict:
        print(SAFE_COMMANDS, file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
