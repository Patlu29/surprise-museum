-- Surprise Museum: database functions called by Edge Functions (service_role only).
-- Each exists because its steps must be atomic; everything else is plain table access from the
-- Edge Function. All use an empty search_path and fully qualified names. Idempotent.
--
-- Errors raised here carry a short machine-readable message that the Edge Function maps to an
-- ApiErrorCode: not_found, bad_request, conflict, photo_limit, upload_quota.

-- Counts a hit in the current fixed window and reports whether the caller is still within the limit.
create or replace function public.rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- Reports whether the current window is already at or over the limit, without counting a hit.
-- Used to throttle repeated not-found lookups (link guessing) without penalising valid ones.
create or replace function public.rate_limit_blocked(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select r.hits
       from public.rate_limits r
      where r.bucket = p_bucket
        and r.window_start =
          to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)),
    0
  ) >= p_limit;
$$;

-- Atomically reserves a photo slot: at most 20 live photos and 100 reservations per museum.
create or replace function public.reserve_photo(p_museum_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_reservations smallint;
  v_live integer;
  v_photo_id uuid;
begin
  select m.photo_reservations into v_reservations
    from public.museums m
   where m.id = p_museum_id
   for update;

  if not found then
    raise exception 'not_found';
  end if;

  select count(*) into v_live from public.photos p where p.museum_id = p_museum_id;
  if v_live >= 20 then
    raise exception 'photo_limit';
  end if;
  if v_reservations >= 100 then
    raise exception 'upload_quota';
  end if;

  update public.museums
     set photo_reservations = photo_reservations + 1, updated_at = now()
   where id = p_museum_id;

  insert into public.photos (museum_id) values (p_museum_id) returning id into v_photo_id;
  return v_photo_id;
end;
$$;

-- Publishes (or re-publishes) a museum in one transaction.
--   p_photos: JSON array in route order, each element {"id": "<uuid>", "caption": "<text>"}.
-- Every listed photo must belong to the museum and be ready. Photos not listed are deleted and
-- their ids returned, so the caller can remove their objects. expires_at is set from the first
-- publish only: re-publishing never extends retention (docs/architecture.md, section 7.4).
create or replace function public.publish_museum(
  p_museum_id uuid,
  p_title text,
  p_visitor_name text,
  p_guide_name text,
  p_opening_greeting text,
  p_closing_message text,
  p_theme text,
  p_visitor_avatar jsonb,
  p_guide_avatar jsonb,
  p_photos jsonb,
  p_retention_days integer
)
returns table (out_published_at timestamptz, out_expires_at timestamptz, out_removed_photo_ids uuid[])
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
  v_ids uuid[];
  v_ready integer;
  v_removed uuid[];
  v_published_at timestamptz;
  v_expires_at timestamptz;
begin
  perform 1 from public.museums m where m.id = p_museum_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if p_photos is null or jsonb_typeof(p_photos) <> 'array' then
    raise exception 'bad_request';
  end if;
  v_count := jsonb_array_length(p_photos);
  if v_count < 1 or v_count > 20 then
    raise exception 'bad_request';
  end if;

  select array_agg((t.e ->> 'id')::uuid order by t.ord)
    into v_ids
    from jsonb_array_elements(p_photos) with ordinality as t(e, ord);

  select count(*) into v_ready
    from public.photos p
   where p.museum_id = p_museum_id and p.status = 'ready' and p.id = any (v_ids);
  -- Also catches duplicated ids, because each id can match at most one row.
  if v_ready <> v_count then
    raise exception 'conflict';
  end if;

  with gone as (
    delete from public.photos p
     where p.museum_id = p_museum_id and not (p.id = any (v_ids))
    returning p.id
  )
  select coalesce(array_agg(g.id), '{}'::uuid[]) into v_removed from gone g;

  update public.photos p
     set position = (t.ord - 1)::smallint,
         caption = t.caption
    from (
      select (x.e ->> 'id')::uuid as id, x.e ->> 'caption' as caption, x.ord
        from jsonb_array_elements(p_photos) with ordinality as x(e, ord)
    ) t
   where p.id = t.id and p.museum_id = p_museum_id;

  update public.museums m
     set status = 'published',
         title = p_title,
         visitor_name = p_visitor_name,
         guide_name = p_guide_name,
         opening_greeting = p_opening_greeting,
         closing_message = p_closing_message,
         theme = p_theme,
         visitor_avatar = p_visitor_avatar,
         guide_avatar = p_guide_avatar,
         content_version = 1,
         published_at = coalesce(m.published_at, now()),
         expires_at = case
           when m.published_at is null then now() + make_interval(days => p_retention_days)
           else m.expires_at
         end,
         updated_at = now()
   where m.id = p_museum_id
  returning m.published_at, m.expires_at into v_published_at, v_expires_at;

  return query select v_published_at, v_expires_at, v_removed;
end;
$$;

-- Deletes a museum's rows and queues its storage prefix for removal, in one transaction.
-- After this commits the share link returns not_found immediately (FR-52).
create or replace function public.delete_museum_rows(p_museum_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.storage_purge_queue (museum_id) values (p_museum_id)
  on conflict (museum_id) do nothing;
  delete from public.museums where id = p_museum_id;
end;
$$;

-- Deletes up to p_limit museums whose expires_at has passed and queues their storage prefixes.
-- Returns the ids it removed. Rows locked by a concurrent request are skipped until next run.
create or replace function public.expire_museums(p_limit integer)
returns setof uuid
language plpgsql
set search_path = ''
as $$
begin
  return query
  with expired as (
    select m.id
      from public.museums m
     where m.expires_at <= now()
     order by m.expires_at
     limit p_limit
       for update skip locked
  ),
  queued as (
    insert into public.storage_purge_queue (museum_id)
    select e.id from expired e
    on conflict (museum_id) do nothing
    returning museum_id
  ),
  gone as (
    delete from public.museums m using expired e where m.id = e.id returning m.id
  )
  select g.id from gone g;
end;
$$;

-- Only service_role (Edge Functions) may call these.
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_blocked(text, integer, integer) from public, anon, authenticated;
revoke all on function public.reserve_photo(uuid) from public, anon, authenticated;
revoke all on function public.publish_museum(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer
) from public, anon, authenticated;
revoke all on function public.delete_museum_rows(uuid) from public, anon, authenticated;
revoke all on function public.expire_museums(integer) from public, anon, authenticated;

grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.rate_limit_blocked(text, integer, integer) to service_role;
grant execute on function public.reserve_photo(uuid) to service_role;
grant execute on function public.publish_museum(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer
) to service_role;
grant execute on function public.delete_museum_rows(uuid) to service_role;
grant execute on function public.expire_museums(integer) to service_role;
