-- Surprise Museum: tables, row-level security and privilege lockdown.
-- Design: docs/architecture.md, sections 7 (data model) and 10 (security). ADR 0003.
-- Owner: backend-developer. Idempotent: safe to run more than once.
--
-- Security model in one paragraph:
--   The browser never reads or writes these tables. RLS is enabled with NO policies, and all
--   table privileges are revoked from anon and authenticated, so the public anon key can do
--   nothing here through PostgREST, GraphQL or Storage. The only way in is through the Edge
--   Functions, which run as service_role and authorise each call by hashing the share token,
--   edit token or cron secret it was given. The photos bucket is private with no storage
--   policies; reads use short-lived signed URLs and writes use signed upload URLs, both issued
--   by Edge Functions.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.museum_status as enum ('draft', 'published');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.photo_status as enum ('pending', 'ready');
exception when duplicate_object then null;
end
$$;

-- ---------------------------------------------------------------------------
-- museums: one row per museum. Tokens are stored only as SHA-256 hashes.
-- ---------------------------------------------------------------------------

create table if not exists public.museums (
  id                 uuid primary key default gen_random_uuid(),
  edit_token_hash    bytea not null unique check (octet_length(edit_token_hash) = 32),
  share_token_hash   bytea not null unique check (octet_length(share_token_hash) = 32),
  status             public.museum_status not null default 'draft',

  title              text not null default '' check (char_length(title) <= 60),
  visitor_name       text check (char_length(visitor_name) between 1 and 24),
  guide_name         text check (char_length(guide_name) between 1 and 24),
  opening_greeting   text not null default '' check (char_length(opening_greeting) <= 500),
  closing_message    text not null default '' check (char_length(closing_message) <= 1000),
  theme              text not null default 'default' check (char_length(theme) <= 32),
  visitor_avatar     jsonb check (visitor_avatar is null or jsonb_typeof(visitor_avatar) = 'object'),
  guide_avatar       jsonb check (guide_avatar is null or jsonb_typeof(guide_avatar) = 'object'),
  -- CONTRACT_VERSION of the stored document shape (supabase/functions/_shared/contract.ts).
  content_version    smallint not null default 1,

  -- Abuse cap: photo reservations over the museum's life (LIMITS.maxPhotoReservations).
  photo_reservations smallint not null default 0 check (photo_reservations between 0 and 100),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  published_at       timestamptz,
  -- Drafts: created_at + 7 days. Published: first publish + 90 days (NFR-16).
  -- The purge job deletes every museum whose expires_at has passed.
  expires_at         timestamptz not null default (now() + interval '7 days'),

  constraint museums_published_complete check (
    status = 'draft' or (
      visitor_name is not null and guide_name is not null
      and visitor_avatar is not null and guide_avatar is not null
      and published_at is not null
    )
  )
);

comment on table public.museums is
  'One museum. Reachable only through Edge Functions that check SHA-256(token). No RLS policies by design.';

create index if not exists museums_expires_at_idx on public.museums (expires_at);

-- ---------------------------------------------------------------------------
-- photos: one row per uploaded photo. Object keys in the 'photos' bucket are derived, never stored:
--   <museum_id>/<photo_id>/full.jpg   (<= 2048 px long edge)
--   <museum_id>/<photo_id>/wall.jpg   (<= 1024 px long edge)
-- ---------------------------------------------------------------------------

create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  museum_id    uuid not null references public.museums (id) on delete cascade,
  status       public.photo_status not null default 'pending',
  -- Null until the photo is part of a published document. 0-based route order.
  position     smallint check (position between 0 and 19),
  caption      text not null default '' check (char_length(caption) <= 280),
  width        smallint check (width between 1 and 2048),
  height       smallint check (height between 1 and 2048),
  lqip         text check (char_length(lqip) <= 4096 and lqip like 'data:image/jpeg;base64,%'),
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,

  constraint photos_ready_complete check (
    status = 'pending' or (width is not null and height is not null and lqip is not null)
  ),
  -- Deferred so a publish can reorder photos inside one transaction.
  constraint photos_position_unique unique (museum_id, position) deferrable initially deferred
);

create index if not exists photos_museum_id_idx on public.photos (museum_id);

-- ---------------------------------------------------------------------------
-- storage_purge_queue: museums whose database rows are gone but whose storage objects may
-- still exist (a delete whose storage step failed). purge-expired retries these hourly.
-- ---------------------------------------------------------------------------

create table if not exists public.storage_purge_queue (
  museum_id    uuid primary key,
  enqueued_at  timestamptz not null default now(),
  attempts     smallint not null default 0,
  last_error   text
);

-- ---------------------------------------------------------------------------
-- rate_limits: fixed-window counters keyed by an action and a salted hash of the client IP.
-- Raw IP addresses are never stored (NFR-13, NFR-22).
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limits (
  bucket        text not null check (char_length(bucket) <= 128),
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limits_window_start_idx on public.rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- Lockdown. RLS is enabled everywhere with no policies, so every role except service_role
-- (which bypasses RLS and is used only inside Edge Functions) is denied by default. Privileges
-- are also revoked, so the public roles cannot even reach the row-level check.
-- ---------------------------------------------------------------------------

alter table public.museums enable row level security;
alter table public.photos enable row level security;
alter table public.storage_purge_queue enable row level security;
alter table public.rate_limits enable row level security;

revoke all on table public.museums, public.photos, public.storage_purge_queue, public.rate_limits
  from anon, authenticated;

grant all on table public.museums, public.photos, public.storage_purge_queue, public.rate_limits
  to service_role;

-- Nothing in this schema is meant to be reached with the public keys, so the public roles do not
-- even get to see it. Edge Functions use service_role, which keeps its access.
revoke usage on schema public from anon, authenticated;

-- Tables, functions and sequences that later migrations create in this schema are not exposed to
-- the public roles unless a migration grants access explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
