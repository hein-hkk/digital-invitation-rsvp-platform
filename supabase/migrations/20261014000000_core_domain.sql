-- M2: persistent domain, ownership isolation, and database invariants.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create type public.event_publication_status as enum ('draft', 'published');
create type public.rsvp_status as enum ('awaiting_response', 'attending', 'declined');

create function private.nonblank_text_array(values_to_check text[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select cardinality(values_to_check) > 0
    and not exists (
      select 1 from unnest(values_to_check) as names(value)
      where value is null or btrim(value) = ''
    );
$$;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  publication_status public.event_publication_status not null default 'draft',
  event_type text check (event_type is null or event_type = 'wedding'),
  event_title text check (event_title is null or btrim(event_title) <> ''),
  host_display_names text[] not null default '{}',
  event_date date,
  start_time time without time zone,
  end_time time without time zone,
  event_timezone text,
  rsvp_deadline_local timestamp without time zone,
  venue_name text check (venue_name is null or btrim(venue_name) <> ''),
  venue_address text check (venue_address is null or btrim(venue_address) <> ''),
  venue_map_url text,
  dress_code text,
  invitation_message text,
  venue_arrival_notes text,
  hero_image_storage_path text,
  organizer_contact_information text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (
    end_time is null or start_time is null or end_time > start_time
  ),
  constraint events_deadline_before_start check (
    rsvp_deadline_local is null or event_date is null or start_time is null
    or rsvp_deadline_local < event_date + start_time
  ),
  constraint events_published_complete check (
    publication_status = 'draft' or (
      event_type is not null
      and event_title is not null
      and private.nonblank_text_array(host_display_names)
      and event_date is not null
      and start_time is not null
      and event_timezone is not null
      and btrim(event_timezone) <> ''
      and venue_name is not null
      and venue_address is not null
      and published_at is not null
    )
  )
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  invitee_name text not null check (btrim(invitee_name) <> ''),
  maximum_party_size smallint not null check (maximum_party_size between 1 and 20),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitation_access_credentials (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  token_lookup_hash bytea not null unique check (octet_length(token_lookup_hash) = 32),
  token_ciphertext text not null check (btrim(token_ciphertext) <> ''),
  token_key_version smallint not null check (token_key_version > 0),
  token_created_at timestamptz not null default now()
);

create table public.rsvps (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  status public.rsvp_status not null default 'awaiting_response',
  attendee_count smallint not null default 0,
  attendee_names text[] not null default '{}',
  dietary_requirements text,
  guest_message text,
  responded_at timestamptz,
  response_updated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rsvps_status_count check (
    (status = 'attending' and attendee_count between 1 and 20)
    or (status <> 'attending' and attendee_count = 0)
  ),
  constraint rsvps_names_count check (cardinality(attendee_names) <= attendee_count),
  constraint rsvps_declined_cleanup check (
    status <> 'declined' or dietary_requirements is null
  ),
  constraint rsvps_response_timestamps check (
    (status = 'awaiting_response' and responded_at is null and response_updated_at is null)
    or (status <> 'awaiting_response' and responded_at is not null
      and response_updated_at is not null and response_updated_at >= responded_at)
  )
);

create index events_owner_idx on public.events (owner_user_id);
create index events_owner_publication_idx on public.events (owner_user_id, publication_status);
create index invitations_event_idx on public.invitations (event_id);
create index invitations_event_created_idx on public.invitations (event_id, created_at);
create index invitations_event_invitee_lower_idx on public.invitations (event_id, lower(invitee_name));
create index rsvps_status_idx on public.rsvps (status);

create function private.event_expiration_at(
  p_event_date date, p_end_time time without time zone, p_event_timezone text
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_event_date is null or p_event_timezone is null then null
    when p_end_time is not null then
      (p_event_date + p_end_time) at time zone p_event_timezone
    else
      (p_event_date + 1)::timestamp at time zone p_event_timezone
  end;
$$;

create function private.guard_event_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'Event ownership is immutable' using errcode = '23514';
    end if;
    if old.publication_status = 'published'
      and private.event_expiration_at(old.event_date, old.end_time, old.event_timezone) <= now() then
      raise exception 'Ended Event is read-only' using errcode = '23514';
    end if;
    if old.publication_status = 'published' and new.publication_status <> 'published' then
      raise exception 'Published Event cannot be unpublished' using errcode = '23514';
    end if;
    if old.publication_status = 'draft' and new.publication_status = 'published' then
      new.published_at := now();
    end if;
    if new.publication_status = 'published'
      and not exists (
        select 1 from pg_catalog.pg_timezone_names
        where name = new.event_timezone
      ) then
      raise exception 'Invalid Event Timezone' using errcode = '23514';
    end if;
    new.updated_at := now();
  elsif tg_op = 'DELETE' then
    if old.publication_status = 'published'
      and private.event_expiration_at(old.event_date, old.end_time, old.event_timezone) > now() then
      raise exception 'Active Published Event cannot be deleted' using errcode = '23514';
    end if;
    return old;
  end if;
  return new;
end;
$$;

create trigger events_guard_update before update on public.events
for each row execute function private.guard_event_write();
create trigger events_guard_delete before delete on public.events
for each row execute function private.guard_event_write();

create function private.guard_invitation_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_event public.events%rowtype;
  current_attendee_count smallint;
begin
  if tg_op = 'UPDATE' and new.event_id <> old.event_id then
    raise exception 'Invitation Event is immutable' using errcode = '23514';
  end if;
  select * into parent_event from public.events where id = new.event_id;
  if parent_event.id is not null and parent_event.publication_status = 'published'
    and private.event_expiration_at(parent_event.event_date, parent_event.end_time,
      parent_event.event_timezone) <= now() then
    raise exception 'Ended Event is read-only' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    select attendee_count into current_attendee_count
      from public.rsvps where invitation_id = new.id;
    if new.maximum_party_size < coalesce(current_attendee_count, 0) then
      raise exception 'Maximum Party Size conflicts with RSVP' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger invitations_guard_write before insert or update on public.invitations
for each row execute function private.guard_invitation_write();

create function private.guard_rsvp_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_invitation public.invitations%rowtype;
  parent_event public.events%rowtype;
begin
  select * into parent_invitation from public.invitations
    where id = new.invitation_id for update;
  if parent_invitation.id is not null then
    select * into parent_event from public.events where id = parent_invitation.event_id;
    if parent_event.publication_status = 'published'
      and private.event_expiration_at(parent_event.event_date, parent_event.end_time,
        parent_event.event_timezone) <= now() then
      raise exception 'Ended Event is read-only' using errcode = '23514';
    end if;
    if new.attendee_count > parent_invitation.maximum_party_size then
      raise exception 'RSVP exceeds Maximum Party Size' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'awaiting_response' and new.status <> 'awaiting_response' then
      new.responded_at := now();
    elsif old.responded_at is not null then
      new.responded_at := old.responded_at;
    end if;
    if (new.status, new.attendee_count, new.attendee_names,
        new.dietary_requirements, new.guest_message)
      is distinct from
       (old.status, old.attendee_count, old.attendee_names,
        old.dietary_requirements, old.guest_message) then
      new.response_updated_at := now();
    else
      new.response_updated_at := old.response_updated_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger rsvps_guard_write before insert or update on public.rsvps
for each row execute function private.guard_rsvp_write();

alter table public.events enable row level security;
alter table public.invitations enable row level security;
alter table public.rsvps enable row level security;
alter table public.invitation_access_credentials enable row level security;

create policy events_owner_select on public.events for select to authenticated
using (owner_user_id = (select auth.uid()));
create policy events_owner_insert on public.events for insert to authenticated
with check (owner_user_id = (select auth.uid()) and publication_status = 'draft');
create policy events_owner_update on public.events for update to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

create policy invitations_owner_select on public.invitations for select to authenticated
using (exists (select 1 from public.events e
  where e.id = event_id and e.owner_user_id = (select auth.uid())));
create policy invitations_owner_update on public.invitations for update to authenticated
using (exists (select 1 from public.events e
  where e.id = event_id and e.owner_user_id = (select auth.uid())))
with check (exists (select 1 from public.events e
  where e.id = event_id and e.owner_user_id = (select auth.uid())));

create policy rsvps_owner_select on public.rsvps for select to authenticated
using (exists (select 1 from public.invitations i join public.events e on e.id = i.event_id
  where i.id = invitation_id and e.owner_user_id = (select auth.uid())));
create policy rsvps_owner_update on public.rsvps for update to authenticated
using (exists (select 1 from public.invitations i join public.events e on e.id = i.event_id
  where i.id = invitation_id and e.owner_user_id = (select auth.uid())))
with check (exists (select 1 from public.invitations i join public.events e on e.id = i.event_id
  where i.id = invitation_id and e.owner_user_id = (select auth.uid())));

revoke all on public.events, public.invitations, public.rsvps,
  public.invitation_access_credentials from anon, authenticated;
grant select on public.events, public.invitations, public.rsvps to authenticated;
grant insert (owner_user_id, event_type, event_title, host_display_names, event_date,
  start_time, end_time, event_timezone, rsvp_deadline_local, venue_name,
  venue_address, venue_map_url, dress_code, invitation_message,
  venue_arrival_notes, hero_image_storage_path, organizer_contact_information)
  on public.events to authenticated;
grant update (event_type, event_title, host_display_names, event_date,
  start_time, end_time, event_timezone, rsvp_deadline_local, venue_name,
  venue_address, venue_map_url, dress_code, invitation_message,
  venue_arrival_notes, organizer_contact_information)
  on public.events to authenticated;
grant update (invitee_name, maximum_party_size) on public.invitations to authenticated;
grant update (status, attendee_count, attendee_names, dietary_requirements)
  on public.rsvps to authenticated;

-- The narrow functions below keep multirow mutations atomic. Token material is
-- prepared in trusted server code; ordinary authenticated clients cannot write
-- or read the credential table.
create function public.create_invitation_record(
  p_owner_user_id uuid, p_event_id uuid, p_invitee_name text,
  p_maximum_party_size smallint, p_token_lookup_hash bytea,
  p_token_ciphertext text, p_token_key_version smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_event public.events%rowtype;
  new_invitation_id uuid;
begin
  select * into parent_event from public.events where id = p_event_id for update;
  if parent_event.id is null or parent_event.owner_user_id <> p_owner_user_id then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;
  if parent_event.publication_status = 'published'
    and private.event_expiration_at(parent_event.event_date, parent_event.end_time,
      parent_event.event_timezone) <= now() then
    raise exception 'Ended Event is read-only' using errcode = '23514';
  end if;
  insert into public.invitations (event_id, invitee_name, maximum_party_size)
    values (p_event_id, p_invitee_name, p_maximum_party_size)
    returning id into new_invitation_id;
  insert into public.invitation_access_credentials
    (invitation_id, token_lookup_hash, token_ciphertext, token_key_version)
    values (new_invitation_id, p_token_lookup_hash, p_token_ciphertext, p_token_key_version);
  insert into public.rsvps (invitation_id) values (new_invitation_id);
  return new_invitation_id;
end;
$$;

create function public.replace_invitation_credential(
  p_owner_user_id uuid, p_invitation_id uuid, p_token_lookup_hash bytea,
  p_token_ciphertext text, p_token_key_version smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_invitation public.invitations%rowtype;
  parent_event public.events%rowtype;
begin
  select * into parent_invitation from public.invitations
    where id = p_invitation_id for update;
  if parent_invitation.id is null then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;
  select * into parent_event from public.events where id = parent_invitation.event_id;
  if parent_event.owner_user_id <> p_owner_user_id then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;
  if parent_event.publication_status = 'published'
    and private.event_expiration_at(parent_event.event_date, parent_event.end_time,
      parent_event.event_timezone) <= now() then
    raise exception 'Ended Event is read-only' using errcode = '23514';
  end if;
  update public.invitation_access_credentials
    set token_lookup_hash = p_token_lookup_hash,
        token_ciphertext = p_token_ciphertext,
        token_key_version = p_token_key_version,
        token_created_at = now()
    where invitation_id = p_invitation_id;
  if not found then
    raise exception 'Invitation credential unavailable' using errcode = '23514';
  end if;
end;
$$;

create function public.publish_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_event public.events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into parent_event from public.events where id = p_event_id for update;
  if parent_event.id is null or parent_event.owner_user_id <> auth.uid() then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;
  if parent_event.publication_status <> 'draft' then
    raise exception 'Event is not Draft' using errcode = '23514';
  end if;
  update public.events set publication_status = 'published' where id = p_event_id;
end;
$$;

create function public.delete_event_record(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_event public.events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into parent_event from public.events where id = p_event_id for update;
  if parent_event.id is null or parent_event.owner_user_id <> auth.uid() then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;
  delete from public.events where id = p_event_id;
  return parent_event.hero_image_storage_path;
end;
$$;

revoke all on function public.create_invitation_record(uuid, uuid, text, smallint, bytea, text, smallint)
  from public, anon, authenticated;
revoke all on function public.replace_invitation_credential(uuid, uuid, bytea, text, smallint)
  from public, anon, authenticated;
grant execute on function public.create_invitation_record(uuid, uuid, text, smallint, bytea, text, smallint)
  to service_role;
grant execute on function public.replace_invitation_credential(uuid, uuid, bytea, text, smallint)
  to service_role;
revoke all on function public.publish_event(uuid), public.delete_event_record(uuid)
  from public, anon;
grant execute on function public.publish_event(uuid), public.delete_event_record(uuid)
  to authenticated;
