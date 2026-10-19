-- The server must show the destructive confirmation and verify ownership/state.
-- Browser roles cannot call the low-level transactional deletion function.
drop function public.delete_event_record(uuid);

create function public.delete_event_record(p_event_id uuid, p_owner_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_event public.events%rowtype;
begin
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
  return parent_event.hero_image_storage_path;
end;
$$;

revoke all on function public.delete_event_record(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_event_record(uuid, uuid)
  to service_role;
