# Rate-limit attempt cleanup

M14 uses the approved V1 limits from `14-deployment-and-operations.md`,
Section 23. A service-role-only PostgreSQL function serializes each HMAC-derived
bucket and counts attempts in a rolling window. Raw Invitation Tokens, email
addresses, and network addresses are never stored in the attempt table.

The application prunes old rows opportunistically. Run the following command
daily in the trusted operations environment so stale rows are removed even if
traffic stops:

```sh
node scripts/cleanup-rate-limit-attempts.mjs
```

Provide `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` through the
approved server-side secret environment. For the local Supabase stack, use:

```sh
node scripts/cleanup-rate-limit-attempts.mjs --local
```

The command outputs only the number of expired attempt rows removed. A failure
requires investigation and retry. Configure the production daily schedule in
M15 alongside the private Hero Image orphan cleanup schedule.
