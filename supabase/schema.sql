-- Trading dashboard — Supabase schema (paste into Supabase → SQL Editor, run once).
--
-- Security model: this is a single-owner app. ALL data access happens server-side
-- through /api/* routes using the SECRET (service_role) key, which BYPASSES RLS.
-- So we enable RLS on every table and add NO policies → the public/anon key (the
-- one in the browser) can touch NOTHING, while our server routes (service_role)
-- have full access. The app's own owner+MFA gate sits in front of those routes.
--
-- Re-runnable: uses IF NOT EXISTS / idempotent guards.

-- ── plans (the Plans board) ──────────────────────────────────────────────────
-- Whole Plan object stored as JSONB (flexible; the app already sorts/filters in
-- memory). `chart` inside data holds a Storage URL (not base64) after migration.
create table if not exists public.plans (
  id          text primary key,
  data        jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── trade ⇄ plan links (keyed by tradePid, e.g. 'BTC/USDT.P#<time>') ─────────
create table if not exists public.links (
  pid         text primary key,
  plan_id     text        not null,
  updated_at  timestamptz not null default now()
);

-- ── journal review records (overlay on live Gate trades; trade_key = tradePid) ─
create table if not exists public.journal_entries (
  trade_key   text primary key,
  grade       text,
  note        text,
  reviewed    boolean     not null default true,
  updated_at  timestamptz not null default now()
);

-- ── released calendar archive (confirmed historical outcomes, keep forever) ────
-- occ_key = 'currency|title|YYYY-MM-DD'; info = the ReleasedInfo object.
create table if not exists public.released_archive (
  occ_key     text primary key,
  info        jsonb       not null,
  updated_at  timestamptz not null default now()
);

-- ── calendar insight cache (reactions + 2-prints), key = 'currency|title' ─────
create table if not exists public.event_insight (
  key         text primary key,
  reaction    jsonb,
  prints      jsonb,
  updated_at  timestamptz not null default now()
);

-- ── event-name definitions cache, key = title ────────────────────────────────
create table if not exists public.event_defs (
  title       text primary key,
  definition  text        not null,
  updated_at  timestamptz not null default now()
);

-- ── lock everything down (RLS on, no policies → only service_role reaches it) ──
alter table public.plans            enable row level security;
alter table public.links            enable row level security;
alter table public.journal_entries  enable row level security;
alter table public.released_archive enable row level security;
alter table public.event_insight    enable row level security;
alter table public.event_defs       enable row level security;

-- service_role (our secret key) needs table-level GRANTs — RLS-bypass alone isn't
-- enough. Supabase usually auto-grants, but grant explicitly to be safe. anon /
-- authenticated are deliberately NOT granted, so the browser key can touch nothing.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;

-- ── Storage bucket for trade chart images ────────────────────────────────────
-- Public-read bucket with unguessable paths; uploads happen server-side with the
-- service_role key. <img src={publicUrl}> works directly. (If you'd rather keep
-- charts fully private, set public=false here and we'll switch to signed URLs.)
insert into storage.buckets (id, name, public)
values ('charts', 'charts', true)
on conflict (id) do nothing;
