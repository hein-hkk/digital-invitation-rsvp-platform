-- M7: one current Guest RSVP, with Token, lifecycle, deadline, and party limit
-- rechecked inside the same transaction as the write.
create or replace function public.submit_guest_rsvp(
  p_token_lookup_hash bytea,
  p_status text,
  p_attendee_count integer,
  p_attendee_names text[],
  p_dietary_requirements text,
  p_guest_message text,
  p_guest_message_present boolean,
  p_observed_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_invitation_id uuid;
  current_invitation public.invitations%rowtype;
  current_credential public.invitation_access_credentials%rowtype;
  current_event public.events%rowtype;
  current_rsvp public.rsvps%rowtype;
  saved_rsvp public.rsvps%rowtype;
  effective_now timestamptz;
begin
  -- The Invitation lock matches the existing size-edit and Token-rotation
  -- order. Recheck the credential after locking so rotation cannot race a save.
  select invitation_id into resolved_invitation_id
    from public.invitation_access_credentials
    where token_lookup_hash = p_token_lookup_hash;
  if resolved_invitation_id is null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select * into current_invitation from public.invitations
    where id = resolved_invitation_id for update;
  if current_invitation.id is null or current_invitation.revoked_at is not null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into current_credential from public.invitation_access_credentials
    where invitation_id = current_invitation.id for update;
  if current_credential.invitation_id is null
    or current_credential.token_lookup_hash <> p_token_lookup_hash then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select * into current_event from public.events
    where id = current_invitation.event_id for share;
  select * into current_rsvp from public.rsvps
    where invitation_id = current_invitation.id for update;
  if current_rsvp.invitation_id is null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  -- Evaluate the clock only after every relevant row lock is acquired. A
  -- request queued behind another write cannot commit past the deadline.
  effective_now := coalesce(p_observed_at, clock_timestamp());
  if current_event.id is null
    or current_event.publication_status <> 'published'
    or private.event_expiration_at(current_event.event_date,
      current_event.end_time, current_event.event_timezone) <= effective_now then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if current_event.rsvp_deadline_local is not null
    and (current_event.rsvp_deadline_local at time zone current_event.event_timezone)
      <= effective_now then
    raise exception 'RSVP_READ_ONLY' using errcode = 'P0001';
  end if;

  if p_status not in ('attending', 'declined') or p_status is null then
    raise exception 'RSVP_INVALID' using errcode = 'P0001';
  end if;
  if p_status = 'attending' then
    if p_attendee_count is null or p_attendee_count < 1
      or p_attendee_count > current_invitation.maximum_party_size then
      raise exception 'RSVP_PARTY_LIMIT' using errcode = 'P0001';
    end if;
    if cardinality(coalesce(p_attendee_names, '{}'::text[])) > p_attendee_count then
      raise exception 'RSVP_TOO_MANY_NAMES' using errcode = 'P0001';
    end if;
  end if;

  update public.rsvps set
    status = p_status::public.rsvp_status,
    attendee_count = case when p_status = 'attending' then p_attendee_count else 0 end,
    attendee_names = case when p_status = 'attending'
      then coalesce(p_attendee_names, '{}'::text[]) else '{}'::text[] end,
    dietary_requirements = case when p_status = 'attending'
      then nullif(p_dietary_requirements, '') else null end,
    guest_message = case when p_guest_message_present
      then nullif(p_guest_message, '') else current_rsvp.guest_message end
    where invitation_id = current_invitation.id
    returning * into saved_rsvp;

  return pg_catalog.jsonb_build_object(
    'status', saved_rsvp.status,
    'attendeeCount', saved_rsvp.attendee_count,
    'attendeeNames', saved_rsvp.attendee_names,
    'dietaryRequirements', saved_rsvp.dietary_requirements,
    'guestMessage', saved_rsvp.guest_message,
    'respondedAt', saved_rsvp.responded_at,
    'updatedAt', saved_rsvp.response_updated_at
  );
end;
$$;

revoke all on function public.submit_guest_rsvp(bytea, text, integer, text[], text, text, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.submit_guest_rsvp(bytea, text, integer, text[], text, text, boolean, timestamptz)
  to service_role;
