-- QUL word text — the per-word text keyed by the same global word id the page map
-- uses in its first/last_word_id ranges.
--
-- TEXT-BEARING. This is the one table that holds Qur'an text. Under the
-- `qul-reliance` option-D posture it may live here — in a store this project
-- controls — but NEVER in the repository or the shipped bundle, and only after the
-- source resource's own licence has been read and recorded (QUL states terms per
-- resource; see the validation check `qul-rulers-terms-and-text-free`). The ingest
-- step refuses to populate this table until that read is marked done.
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
  -- the word's text (glyph/uthmani). The only text-bearing column in this schema.
  text     text     not null
);

comment on table public.qul_words is
  'Per-word text keyed by global word id. Text-bearing; held under qul-reliance option D, licence read first; never ships to the repo or the build.';

create index if not exists qul_words_ayah_idx
  on public.qul_words (surah, ayah, position);
