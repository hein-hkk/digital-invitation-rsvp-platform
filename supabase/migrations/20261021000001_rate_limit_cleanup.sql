-- Keep short-lived, HMAC-derived abuse metadata from accumulating when
-- application traffic is too low for opportunistic pruning.
create function public.purge_expired_rate_limit_attempts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from private.rate_limit_attempts
    where attempted_at < clock_timestamp() - interval '2 hours';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_expired_rate_limit_attempts()
  from public, anon, authenticated;
grant execute on function public.purge_expired_rate_limit_attempts()
  to service_role;
