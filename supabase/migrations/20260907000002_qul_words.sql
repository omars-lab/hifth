-- QUL word text — the per-word qpc-v4 text (library id 47), keyed by the same
-- global word id the page map (digital-khatt, library id 21) uses in its
-- first/last_word_id ranges. This is what the store draws its own word-by-word
-- page from — see docs/decisions/qul-store-purpose.md.
--
-- TEXT-BEARING. This is the one table that holds Qur'an text. Under the
-- `qul-reliance` option-D posture it may live here — in a store this project
-- controls — but NEVER in the repository or the shipped bundle, and only after the
-- source resource's own licence has been read and recorded (QUL states terms per
-- resource; see the validation check `qul-rulers-terms-and-text-free`). The ingest
-- step refuses to populate this table until that read is marked done. The same read
-- gates every other held item that is text, a font, or morphology (the fonts that
-- DRAW this text, library ids 457/462, and the per-word root/lemma/stem) — each is
-- held only once its own originator's terms are read, never before.
--
-- Whether any reader ever receives these bytes is a SEPARATE open question. Until it
-- is decided, this table is for the building tools alone.

create table if not exists public.qul_words (
  -- global 1-based word id; matches qul_page_lines.first_word_id / last_word_id
  word_id  integer primary key,
  surah    smallint not null,
  ayah     smallint not null,
  -- word position within its ayah, 1-based
  position smallint not null,
  -- the word's qpc-v4 glyph text. The only text-bearing column in this schema.
  text     text     not null
);

comment on table public.qul_words is
  'Per-word qpc-v4 text (library id 47) keyed by global word id. Text-bearing; held under qul-reliance option D, licence read first; never ships to the repo or the build.';

create index if not exists qul_words_ayah_idx
  on public.qul_words (surah, ayah, position);
