#!/bin/sh
# Drive x-callback-url requests through the real operating system on the Mac
# and watch a second process receive each answer (native-shell.md ⑨).
#
#   callback-check.sh <Hifth.app> <bundle id>
#
# For each leg: a receiver (callback-receiver.py) binds a free port and waits
# for one request; `open hifth://x-callback-url/…&x-success=http://127.0.0.1:PORT/answer
# &x-error=http://127.0.0.1:PORT/error` hands the request to macOS, which
# routes it to the app; the app acts and answers by opening the address; the
# default browser fetches it from the receiver, which writes the decoded query
# to a file; the file must say what the contract promises.
#
#   leg 1  open?page=45   → /answer with route=/hafs-kfqc/p45 and its public link
#   leg 2  open?page=0    → /error with errorCode=bad-route (a page of 0 is refused)
#
# Side effects: the app is launched and quit, and the browser opens one tab per
# leg (the receiver's page says what arrived and that it can be closed). That
# is why this is its own target and not part of pre-push.
set -u
# `open -a` wants an absolute path; make's is relative to the repo.
app=$(cd "$(dirname "$1")" && pwd)/$(basename "$1"); bundle=$2
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
fail=0

quit_app() { osascript -e "tell application id \"$bundle\" to quit" >/dev/null 2>&1 || true; }

# leg <name> <request query after open?> <expected path> <expected line>...
leg() {
  name=$1; query=$2; want_path=$3; shift 3
  port_file=$work/$name.port; answer_file=$work/$name.answer
  python3 "$here/callback-receiver.py" --port-file "$port_file" --answer-file "$answer_file" --timeout 40 &
  receiver=$!
  for _ in $(seq 1 50); do [ -s "$port_file" ] && break; sleep 0.1; done
  [ -s "$port_file" ] || { echo "  ✗ $name: receiver did not start"; kill $receiver 2>/dev/null; fail=1; return; }
  port=$(cat "$port_file")
  request="hifth://x-callback-url/open?$query&x-success=http://127.0.0.1:$port/answer&x-error=http://127.0.0.1:$port/error"
  echo "  → $request"
  open "$request"
  if ! wait $receiver; then echo "  ✗ $name: no answer reached the receiver within 40 s"; fail=1; return; fi
  echo "  ← answer:"; sed 's/^/      /' "$answer_file"
  grep -qx "path=$want_path" "$answer_file" || { echo "  ✗ $name: the answer did not go to $want_path"; fail=1; }
  for line in "$@"; do
    grep -qx "$line" "$answer_file" || { echo "  ✗ $name: answer lacks $line"; fail=1; }
  done
}

/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app"
quit_app; sleep 1
HIFTH_ROUTE=/hafs-kfqc/p1 open -a "$app" || exit 1
# Give the page time to be ready: a request before that is queued anyway, but a
# cold launch racing the request is not the path being proven.
sleep 4

leg success "page=45" /answer "route=/hafs-kfqc/p45" "url=https://blog.bytesofpurpose.com/hifth/#/hafs-kfqc/p45"
leg refused "page=0" /error "errorCode=bad-route"

quit_app
rm -rf "$work"
[ $fail -eq 0 ] && echo "  ✓ macOS carried both requests in and both answers out to another process"
exit $fail
