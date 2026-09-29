#!/bin/sh
# Print the UDID of the available simulator whose name is $1 (exact), or the
# first available iPad when no name is given. Nothing on stdout means none.
set -e
name="${1:-}"
list=$(xcrun simctl list devices available)
if [ -n "$name" ]; then
  echo "$list" | grep -F "    $name (" | head -1 | sed -E 's/.*\(([A-F0-9-]{36})\).*/\1/'
else
  echo "$list" | grep -E "^\s+iPad" | head -1 | sed -E 's/.*\(([A-F0-9-]{36})\).*/\1/'
fi
