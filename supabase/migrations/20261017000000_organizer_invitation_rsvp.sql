-- M8: lock the Invitation before either operational edit so Guest RSVP writes
-- and Maximum Party Size changes serialize on the same row.
create function public.update_invitation_record(
  p_event_id uuid, p_invitation_id uuid, p_invitee_name text,
  p_maximum_party_size integer
)
returns public.invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_invitation public.invitations%rowtype;
  parent_event public.events%rowtype;
  current_rsvp public.rsvps%rowtype;
  saved_invitation public.invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into current_invitation from public.invitations
    where id = p_invitation_id and event_id = p_event_id for update;
  if current_invitation.id is null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into parent_event from public.events
    where id = p_event_id for share;
  if parent_event.id is null or parent_event.owner_user_id <> auth.uid() then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into current_rsvp from public.rsvps
    where invitation_id = p_invitation_id for update;
  if current_rsvp.invitation_id is null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if parent_event.publication_status = 'published'
    and private.event_expiration_at(parent_event.event_date,
      parent_event.end_time, parent_event.event_timezone) <= clock_timestamp() then
    raise exception 'EVENT_NOT_MUTABLE' using errcode = 'P0001';
  end if;
  if p_invitee_name is null or btrim(p_invitee_name) = ''
    or p_maximum_party_size is null or p_maximum_party_size not between 1 and 20 then
    raise exception 'INVITATION_INVALID' using errcode = 'P0001';
  end if;
  if p_maximum_party_size < current_rsvp.attendee_count then
    raise exception 'MAX_PARTY_SIZE_CONFLICT:%', current_rsvp.attendee_count using errcode = 'P0001';
  end if;
  update public.invitations set
    invitee_name = btrim(p_invitee_name),
    maximum_party_size = p_maximum_party_size
    where id = p_invitation_id returning * into saved_invitation;
  return saved_invitation;
end;
$$;

create function public.update_organizer_rsvp(
  p_event_id uuid, p_invitation_id uuid, p_status text,
  p_attendee_count integer, p_attendee_names text[],
  p_dietary_requirements text
)
returns public.rsvps
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_invitation public.invitations%rowtype;
  parent_event public.events%rowtype;
  current_rsvp public.rsvps%rowtype;
  saved_rsvp public.rsvps%rowtype;
begin
  if auth.uid() is null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into current_invitation from public.invitations
    where id = p_invitation_id and event_id = p_event_id for update;
  if current_invitation.id is null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into parent_event from public.events
    where id = p_event_id for share;
  if parent_event.id is null or parent_event.owner_user_id <> auth.uid() then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into current_rsvp from public.rsvps
    where invitation_id = p_invitation_id for update;
  if current_rsvp.invitation_id is null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if parent_event.publication_status = 'published'
    and private.event_expiration_at(parent_event.event_date,
      parent_event.end_time, parent_event.event_timezone) <= clock_timestamp() then
    raise exception 'EVENT_NOT_MUTABLE' using errcode = 'P0001';
  end if;
  if p_status is null or p_status not in ('attending', 'declined') then
    raise exception 'RSVP_INVALID' using errcode = 'P0001';
  end if;
  if p_status = 'attending' then
    if p_attendee_count is null or p_attendee_count < 1
      or p_attendee_count > current_invitation.maximum_party_size then
      raise exception 'RSVP_PARTY_LIMIT:%', current_invitation.maximum_party_size using errcode = 'P0001';
    end if;
    if cardinality(coalesce(p_attendee_names, '{}'::text[])) > p_attendee_count
      or exists (select 1 from unnest(coalesce(p_attendee_names, '{}'::text[])) as names(value)
        where value is null or btrim(value) = '') then
      raise exception 'RSVP_TOO_MANY_NAMES' using errcode = 'P0001';
    end if;
  end if;
  update public.rsvps set
    status = p_status::public.rsvp_status,
    attendee_count = case when p_status = 'attending' then p_attendee_count else 0 end,
    attendee_names = case when p_status = 'attending'
      then coalesce(p_attendee_names, '{}'::text[]) else '{}'::text[] end,
    dietary_requirements = case when p_status = 'attending'
      then nullif(p_dietary_requirements, '') else null end
    where invitation_id = p_invitation_id returning * into saved_rsvp;
  return saved_rsvp;
end;
$$;

revoke all on function public.update_invitation_record(uuid, uuid, text, integer)
  from public, anon;
revoke all on function public.update_organizer_rsvp(uuid, uuid, text, integer, text[], text)
  from public, anon;
grant execute on function public.update_invitation_record(uuid, uuid, text, integer)
  to authenticated;
grant execute on function public.update_organizer_rsvp(uuid, uuid, text, integer, text[], text)
  to authenticated;
