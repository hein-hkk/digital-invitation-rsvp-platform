-- Finalization has verified object bytes in trusted server code. Keep the
-- reference transition inaccessible to an authenticated browser client.
drop function public.set_hero_image_reference(uuid, text, text);

create function public.set_hero_image_reference(
  p_event_id uuid, p_owner_user_id uuid,
  p_expected_previous_path text, p_storage_path text
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
  if current_event.hero_image_storage_path is distinct from p_expected_previous_path then
    raise exception 'Hero Image changed' using errcode = '40001';
  end if;
  if p_storage_path is not null and
    p_storage_path !~ ('^' || p_event_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'Invalid Hero Image path' using errcode = '23514';
  end if;
  update public.events set hero_image_storage_path = p_storage_path
    where id = p_event_id;
  return current_event.hero_image_storage_path;
end;
$$;

revoke all on function public.set_hero_image_reference(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.set_hero_image_reference(uuid, uuid, text, text)
  to service_role;
