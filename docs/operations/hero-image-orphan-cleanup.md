# Hero Image orphan cleanup

The `hero-images` bucket must remain private. A failed Storage deletion after
Event database deletion leaves an unreferenced private object. Signed uploads
that are never finalized can also leave one.

Run the cleanup at least daily. It scans Event folders, keeps referenced
objects, and considers unreferenced objects only after a 24-hour grace period.
It checks the Event reference again immediately before each removal. The
database deletion remains committed if a Storage removal fails.

From the repository root, inspect local results first:

```sh
node scripts/cleanup-hero-image-orphans.mjs --local --dry-run
```

Then perform local cleanup when the candidate count is expected:

```sh
node scripts/cleanup-hero-image-orphans.mjs --local --delete
```

For preview/production, provide `NEXT_PUBLIC_SUPABASE_URL` and the server-only
`SUPABASE_SERVICE_ROLE_KEY` through the approved secret environment. Run the
same command without `--local`, first in dry-run mode and then with `--delete`.
Schedule the delete mode daily in the trusted operations environment. Do not
expose this script as a public endpoint or print secret values.

The command emits counts only. A nonzero exit requires investigation and a
retry; it does not restore any deleted Event or make a private object public.
