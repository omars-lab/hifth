-- QUL page map — the digital-khatt 15-line page layout (library id 21), the V4
-- mus'haf plan this project draws its own word-by-word page from.
--
-- POSITIONS ONLY. Every column here is a number, an id, or a short line-type tag.
-- No Qur'an text lives in this table. It records which word ids sit on which page
-- and line, following the source layout's own `pages` table (9,046 lines across
-- 604 pages, 15 lines to a page). The word-id ranges match the qpc-v4 word text
-- (library id 47) exactly, 1..83,668, with no gaps — see docs/decisions/qul-store-purpose.md.
-- Held under the `qul-reliance` option-D posture (a store this project controls,
-- off the repo and off the shipped bundle); the repo carries none of these bytes.

create table if not exists public.qul_page_lines (
  page_number   smallint not null,
  line_number   smallint not null,
  -- source line kind: 'ayah', 'surah_name', 'basmallah', ... (a tag, not text)
  line_type     text     not null,
  is_centered   boolean  not null default false,
  -- populated only on a surah-name header line; null on ayah lines
  surah_number  smallint,
  -- global 1-based word ids; null on non-ayah lines (headers, basmallah)
  first_word_id integer,
  last_word_id  integer,
  primary key (page_number, line_number),
  constraint qul_page_lines_word_range
    check (first_word_id is null or last_word_id is null or last_word_id >= first_word_id)
);

comment on table public.qul_page_lines is
  'digital-khatt 15-line page layout, library id 21 (V4) — positions only, no Qur''an text.';

-- A page''s lines are read in order; a word-id lookup wants the ranges.
create index if not exists qul_page_lines_first_word_idx
  on public.qul_page_lines (first_word_id);
create index if not exists qul_page_lines_last_word_idx
  on public.qul_page_lines (last_word_id);

-- Row counts and other layout totals the source keeps in its `info` table.
create table if not exists public.qul_layout_info (
  key   text primary key,
  value text not null
);

comment on table public.qul_layout_info is
  'The source layout''s own counts (its `info` table) — numbers only.';
