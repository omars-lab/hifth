---
name: perl-unicode-codepoint-corrupts-file
description: "A \\x{NNNN} in a perl -pi/-0777 replacement re-encodes the WHOLE file to UTF-8 and mangles every pre-existing multibyte char; use the Edit tool or literal UTF-8 bytes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-09T18:52:41.927Z
---

Using a Unicode codepoint escape like `\x{2014}` (em-dash) in a perl `-pi` or
`-0777 -pi` replacement upgrades the whole slurped record string to UTF-8, so perl
re-encodes the ENTIRE file on write — double/triple-encoding every pre-existing
non-ASCII byte (em-dashes, box-drawing, middle-dots, and — dangerously — any
Arabic-range held-copy guard regex). Symptom: a "Wide character in print" warning
and `Ã¢ÂÂ` / `â` mojibake spreading across lines that were fine before.

**Why:** perl byte-mode assumes latin1; one `\x{NNNN}` flips the string to
character-mode and forces a UTF-8 re-encode of everything, not just your edit.

**How to apply:** For UTF-8 prose or any file with existing multibyte content,
use the **Edit/Write tool**, not perl/sed one-liners. If perl is unavoidable,
insert the literal UTF-8 bytes (em-dash = `\xe2\x80\x94`), never `\x{2014}`.
Recovery if it already happened: peel each LINE independently through
`latin1.encode → utf8.decode` in a loop (layer counts differ per line, so a
whole-file peel stops early) — the one-off script lives in scratchpad as
fix-mojibake.py. Relevant even under auto-mode's "prefer Bash for file ops":
UTF-8 prose editing is exactly where Bash cannot safely do the job. See
[[plain-language-covers-conversation]] for the kind of prose most at risk here.
