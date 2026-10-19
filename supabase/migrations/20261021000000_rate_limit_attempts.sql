-- M14: short rolling-window abuse limits. Keys are HMAC digests, never raw
-- Tokens, email addresses, or network addresses.
create table private.rate_limit_attempts (
  bucket_hash bytea not null,
  attempted_at timestamptz not null default clock_timestamp()
);

create index rate_limit_attempts_bucket_time_idx
  on private.rate_limit_attempts (bucket_hash, attempted_at desc);

create index rate_limit_attempts_time_idx
  on private.rate_limit_attempts (attempted_at);

alter table private.rate_limit_attempts enable row level security;
revoke all on private.rate_limit_attempts from public, anon, authenticated;

create function public.consume_rate_limit(
  p_bucket_hash text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  observed_at timestamptz;
  current_count integer;
  decoded_hash bytea;
begin
  if p_bucket_hash is null or p_bucket_hash !~ '^[a-f0-9]{64}$'
    or p_max_attempts is null or p_max_attempts < 1 or p_max_attempts > 10000
    or p_window_seconds is null or p_window_seconds < 1
    or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit configuration' using errcode = '22023';
  end if;
  decoded_hash := decode(p_bucket_hash, 'hex');

  -- Serialize callers for the same bucket before counting/inserting so
  -- concurrent requests cannot pass the final slot together.
  perform pg_advisory_xact_lock(hashtextextended(p_bucket_hash, 0));
  observed_at := clock_timestamp();
  select count(*) into current_count
    from private.rate_limit_attempts
    where bucket_hash = decoded_hash
      and attempted_at > observed_at - make_interval(secs => p_window_seconds);
  if current_count >= p_max_attempts then
    return false;
  end if;
  insert into private.rate_limit_attempts (bucket_hash, attempted_at)
    values (decoded_hash, observed_at);

  -- Keep only a bounded amount of expired security metadata without relying
  -- on a separate scheduler. All V1 windows are at most one hour.
  if random() < 0.01 then
    delete from private.rate_limit_attempts
      where ctid in (
        select ctid from private.rate_limit_attempts
        where attempted_at < observed_at - interval '2 hours'
        limit 1000
      );
  end if;
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;
