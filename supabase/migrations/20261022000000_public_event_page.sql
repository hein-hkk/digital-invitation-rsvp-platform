-- D-29/D-30: opt-in, unlisted public Event projection. No anonymous table
-- grants are added. The random public id is not an RSVP credential.
alter table public.events
  add column public_page_id uuid not null default gen_random_uuid(),
  add column public_page_enabled boolean not null default false,
  add column public_announcement text,
  add column public_cover_storage_path text;

create unique index events_public_page_id_idx on public.events (public_page_id);

create function public.set_public_event_page(
  p_event_id uuid,
  p_owner_user_id uuid,
  p_enabled boolean,
  p_announcement text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_event public.events%rowtype;
begin
  select * into current_event from public.events
    where id = p_event_id for update;
  if current_event.id is null or current_event.owner_user_id <> p_owner_user_id then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;
  if current_event.publication_status = 'published'
    and private.event_expiration_at(current_event.event_date,
      current_event.end_time, current_event.event_timezone) <= now() then
    raise exception 'Ended Event is read-only' using errcode = '23514';
  end if;
  if p_enabled is null or (p_enabled and current_event.publication_status <> 'published') then
    raise exception 'Public page requires active Published Event' using errcode = '23514';
  end if;
  update public.events set
    public_page_enabled = p_enabled,
    public_announcement = nullif(btrim(p_announcement), '')
    where id = p_event_id;
end;
$$;

revoke all on function public.set_public_event_page(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.set_public_event_page(uuid, uuid, boolean, text)
  to service_role;

create function public.set_public_cover_reference(
  p_event_id uuid,
  p_owner_user_id uuid,
  p_expected_previous_path text,
  p_storage_path text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_event public.events%rowtype;
begin
  select * into current_event from public.events
    where id = p_event_id for update;
  if current_event.id is null or current_event.owner_user_id <> p_owner_user_id then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;
  if current_event.publication_status = 'published'
    and private.event_expiration_at(current_event.event_date,
      current_event.end_time, current_event.event_timezone) <= now() then
    raise exception 'Ended Event is read-only' using errcode = '23514';
  end if;
  if current_event.public_cover_storage_path is distinct from p_expected_previous_path then
    raise exception 'Public cover changed' using errcode = '40001';
  end if;
  if p_storage_path is not null and
    p_storage_path !~ ('^' || p_event_id::text || '/public-[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'Invalid public cover path' using errcode = '23514';
  end if;
  update public.events set public_cover_storage_path = p_storage_path
    where id = p_event_id;
  return current_event.public_cover_storage_path;
end;
$$;

revoke all on function public.set_public_cover_reference(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.set_public_cover_reference(uuid, uuid, text, text)
  to service_role;

-- Return both image references from the same deletion transaction. Keep the
-- Invitation-first lock order introduced for the M13/M14 RSVP race fix.
drop function public.delete_event_record(uuid, uuid);
create function public.delete_event_record(p_event_id uuid, p_owner_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_event public.events%rowtype;
begin
  if not exists (
    select 1 from public.events
    where id = p_event_id and owner_user_id = p_owner_user_id
  ) then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;
  perform 1 from public.invitations
    where event_id = p_event_id order by id for update;
  select * into parent_event from public.events where id = p_event_id for update;
  if parent_event.id is null or parent_event.owner_user_id <> p_owner_user_id then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;
  if parent_event.publication_status = 'published'
    and private.event_expiration_at(parent_event.event_date,
      parent_event.end_time, parent_event.event_timezone) > now() then
    raise exception 'Active Published Event cannot be deleted' using errcode = '23514';
  end if;
  delete from public.events where id = p_event_id;
  return jsonb_build_object(
    'heroPath', parent_event.hero_image_storage_path,
    'publicCoverPath', parent_event.public_cover_storage_path
  );
end;
$$;

revoke all on function public.delete_event_record(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_event_record(uuid, uuid)
  to service_role;
