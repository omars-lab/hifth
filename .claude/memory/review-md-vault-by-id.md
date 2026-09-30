---
name: review-md-vault-by-id
description: review-md replies must use --vault hifth0docs0vault01 (the vault ID); "docs" also names the 3d-models vault, so --vault docs opens the wrong one and the reply never lands
metadata:
  type: reference
---

Obsidian knows two vaults named "docs": hifth/docs (ID `hifth0docs0vault01`) and 3d-models/docs.
`reviews reply … --vault docs` opened the 3d-models vault on 2026-09-30 and every reply timed out
("didn't land in 10s"). Obsidian's `vault=` accepts the ID, and with
`--vault hifth0docs0vault01` all three replies landed. The Makefile's `reviews-all` and the
hook's hint now use the ID. Related: [[review-md-vault-and-hook]].
