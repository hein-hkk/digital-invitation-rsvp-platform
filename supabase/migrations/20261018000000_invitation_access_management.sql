-- M10: serialize Token rotation, revocation, and Guest RSVP writes on the
-- Invitation row. Return the committed timestamp without a follow-up read.
drop function public.replace_invitation_credential(uuid, uuid, bytea, text, smallint);

create function public.replace_invitation_credential(
  p_owner_user_id uuid, p_invitation_id uuid, p_token_lookup_hash bytea,
  p_token_ciphertext text, p_token_key_version smallint
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_invitation public.invitations%rowtype;
  parent_event public.events%rowtype;
  created_at timestamptz;
begin
  select * into current_invitation from public.invitations
    where id = p_invitation_id for update;
  if current_invitation.id is null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into parent_event from public.events
    where id = current_invitation.event_id for share;
  if parent_event.id is null or parent_event.owner_user_id <> p_owner_user_id then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if current_invitation.revoked_at is not null then
    raise exception 'INVITATION_REVOKED' using errcode = 'P0001';
  end if;
  if parent_event.publication_status = 'published'
    and private.event_expiration_at(parent_event.event_date,
      parent_event.end_time, parent_event.event_timezone) <= clock_timestamp() then
    raise exception 'EVENT_NOT_MUTABLE' using errcode = 'P0001';
  end if;
  update public.invitation_access_credentials
    set token_lookup_hash = p_token_lookup_hash,
        token_ciphertext = p_token_ciphertext,
        token_key_version = p_token_key_version,
        token_created_at = clock_timestamp()
    where invitation_id = p_invitation_id
    returning token_created_at into created_at;
  if created_at is null then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  return created_at;
end;
$$;

create function public.revoke_invitation_record(
  p_event_id uuid, p_invitation_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_invitation public.invitations%rowtype;
  parent_event public.events%rowtype;
  revoked_at timestamptz;
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
  if current_invitation.revoked_at is not null then
    raise exception 'INVITATION_REVOKED' using errcode = 'P0001';
  end if;
  if parent_event.publication_status = 'published'
    and private.event_expiration_at(parent_event.event_date,
      parent_event.end_time, parent_event.event_timezone) <= clock_timestamp() then
    raise exception 'EVENT_NOT_MUTABLE' using errcode = 'P0001';
  end if;
  update public.invitations set revoked_at = clock_timestamp()
    where id = p_invitation_id returning invitations.revoked_at into revoked_at;
  return revoked_at;
end;
$$;

revoke all on function public.replace_invitation_credential(uuid, uuid, bytea, text, smallint)
  from public, anon, authenticated;
grant execute on function public.replace_invitation_credential(uuid, uuid, bytea, text, smallint)
  to service_role;
revoke all on function public.revoke_invitation_record(uuid, uuid)
  from public, anon;
grant execute on function public.revoke_invitation_record(uuid, uuid)
  to authenticated;
