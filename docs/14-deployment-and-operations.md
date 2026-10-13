# 14 — Deployment and Operations

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document defines the V1 deployment and operational requirements for the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, `03-user-flows.md`, `04-technical-architecture.md`, `05-data-model.md`, `06-design-system-and-ui-foundation.md`, `07-guest-experience-spec.md`, `08-admin-dashboard-spec.md`, `09-api-and-server-contracts.md`, `10-security-and-privacy.md`, `11-testing-strategy.md`, `12-development-architecture.md`, and `13-development-roadmap.md`. It must not change approved product behavior.

---

## 1. Purpose

This document finalizes the operational model required before production implementation and launch. It defines environment separation, secrets, deployment/migration flow, Organizer provisioning, OTP operations, rate limits, monitoring, backups/restores, key rotation, private-media cleanup, privacy/erasure operations, incident response, rollback, and launch verification.

This document does not introduce new Event, Invitation, RSVP, deletion, authentication, or privacy product rules.

---

## 2. Operational Principles

### OPS-P01 — Production is isolated

Production uses separate infrastructure, credentials, data, and cryptographic keys from local/preview environments.

### OPS-P02 — Deployments are migration-driven

Production schema changes occur through version-controlled Supabase migrations. Manual production-only schema drift is not accepted.

### OPS-P03 — Secrets are provisioned, not committed

Privileged credentials live only in approved deployment/secret-management systems.

### OPS-P04 — Destructive operations are explicit

Provisioning, erasure, key rotation, and orphan cleanup use documented operational commands/processes rather than ad-hoc database edits.

### OPS-P05 — Rollback respects schema compatibility

Application rollback must account for already-applied database migrations. Do not deploy old code that is incompatible with the current schema.

### OPS-P06 — Production personal data stays in production

Production Guest/RSVP data must not be copied into local, preview, CI, demos, or test fixtures.

---

## 3. Environment Model

V1 uses three environment classes.

### 3.1 Local development

Use local Next.js, a local Supabase stack where practical, synthetic seed data, test Organizer accounts, non-production cryptographic keys, private local/test Storage, and local email capture/test Auth support for OTP. Production credentials are never required.

### 3.2 Preview / staging

Use Vercel Preview (or equivalent) connected only to a dedicated non-production Supabase project. Use test accounts, synthetic Event/Invitation/RSVP data, separate service-role credentials, separate HMAC/encryption keys, and private non-production Storage.

### 3.3 Production

Use Vercel Production connected to a dedicated production Supabase project with production-only Auth users, PostgreSQL data, private Storage, service-role key, HMAC/encryption keys, and logging/monitoring configuration.

Preview deployments must never connect to the production Supabase project.

---

## 4. Environment Naming

Use explicit logical names:

```text
local
preview
production
```

Do not use ambiguous names such as `default`, `real`, or `temp-prod`.

---

## 5. Environment Variable Inventory

### 5.1 Browser-safe

Expected browser-safe variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 5.2 Server-only

Expected server-only categories:

```text
SUPABASE_SERVICE_ROLE_KEY
INVITATION_TOKEN_HASH_KEY
INVITATION_TOKEN_ENCRYPTION_KEY_V1
INVITATION_TOKEN_ACTIVE_KEY_VERSION
APP_BASE_URL
RATE_LIMIT_GUEST_INVITE_READ
RATE_LIMIT_GUEST_RSVP_WRITE
RATE_LIMIT_AUTH_OTP
RATE_LIMIT_ORGANIZER_HIGH_IMPACT
LOG_LEVEL
```

Additional versioned encryption keys may be added during key rotation.

### 5.3 Validation

Production startup/build/runtime must fail safely when a required server variable is missing or malformed. Never fall back to development secrets.

---

## 6. Secret Provisioning

Store production secrets only in Vercel production environment configuration, Supabase secret/configuration facilities where required, and an approved secure operator vault/password manager.

Do not store secrets in Git, Markdown documentation, issue trackers, client bundles, or chat transcripts used as permanent credential storage.

Local `.env` files must be ignored; commit only non-secret templates.

---

## 7. Source Control and Release Flow

Recommended V1 flow:

```text
feature branch
    ↓
pull request / review
    ↓
CI
    ↓
preview deployment
    ↓
merge to main
    ↓
production deployment
```

Production should deploy from the protected/default branch rather than an arbitrary local working tree.

---

## 8. CI Pipeline

Minimum pull-request CI:

1. install pnpm dependencies from the committed frozen lockfile;
2. typecheck;
3. lint;
4. unit tests;
5. component tests where applicable;
6. apply migrations to an isolated test database;
7. database constraint/RLS tests;
8. server integration tests;
9. critical Guest/Admin E2E smoke;
10. security regressions relevant to the changed scope.

A failing required gate blocks release.

---

## 9. Dependency and Runtime Version Policy

At implementation bootstrap and whenever direct dependencies are added/upgraded, Codex must actively determine the versions available **at that time**.

Do not rely on package versions remembered from model training.

### 9.1 Selection rule

Use the **latest stable, production-supported, mutually compatible** releases of the approved runtime/framework/toolchain and direct dependencies.

Current version selection must be verified using authoritative primary sources such as:

- official npm package metadata/registry;
- official framework/library release notes and compatibility guides;
- official Node.js support/release information;
- official pnpm documentation;
- official Vercel runtime/framework support documentation;
- official Supabase documentation.

If the newest stable release of one dependency is incompatible with the approved stack, use the newest **stable compatible** release and document the compatibility reason.

### 9.2 Prerelease prohibition

Do not use releases identified as:

```text
alpha
beta
rc
canary
next
nightly
experimental
preview
prerelease
```

or another non-stable release channel unless an approved source-of-truth change explicitly requires it.

### 9.3 Runtime policy

For Node.js, prefer the latest production-supported **Active LTS** line compatible with the current stable Next.js/Vercel stack unless official platform guidance requires another supported stable line.

### 9.4 Executable version record

Record the selected implementation-time versions in repository configuration:

- runtime version configuration / `engines` as appropriate;
- `packageManager` for exact pnpm version;
- `package.json` direct dependency constraints;
- committed `pnpm-lock.yaml` exact resolved graph.

CI/deployment installs use the frozen lockfile.

Exact numeric versions belong to repository configuration at implementation time rather than this long-lived operations specification.

### 9.5 Upgrade rule

Major dependency upgrades require:

1. current stable-version verification;
2. review of official migration/upgrade guidance;
3. compatibility review with Vercel/Supabase and peer dependencies;
4. required test-suite execution;
5. review if the upgrade materially changes architecture/security.

If current version data cannot be verified, do not guess; block the dependency change until authoritative information is available.

---

## 10. Supabase Production Setup

Production Supabase must include:

- Auth for provisioned Organizers;
- PostgreSQL with migrations applied from the repository;
- RLS on private application tables;
- private Hero Image Storage bucket;
- no broad anonymous read policy for private Event/Invitation/RSVP rows;
- service-role key restricted to server-only use.

Dashboard-only schema changes absent from migrations are not an accepted workflow.

---

## 11. Organizer Provisioning Operations

D-28 requires administratively provisioned Organizer accounts.

Provision through trusted Supabase administrative tooling or a server-only operations script. The operation accepts the Organizer email, creates/provisions the Auth user without a password or public sign-up path, and returns only safe operator confirmation.

Provisioning is never a public application route. Public OTP sign-in must be configured so unknown emails do not auto-create users.

---

## 12. Production OTP Configuration

Production Organizer sign-in uses passwordless email OTP.

Before launch configure:

- verified sender identity/domain as required by the selected Auth email setup;
- minimal transactional OTP template;
- provider-supported OTP expiration settings;
- delivery monitoring;
- resend/rate-limit behavior;
- public self-sign-up disabled.

OTP email content must not include private Event/Invitee data. OTP codes must not be logged.

---

## 13. Production Domain and HTTPS

Production uses a dedicated HTTPS domain.

Requirements:

- HTTPS enforced;
- HTTP redirected to HTTPS;
- `APP_BASE_URL` equals the canonical production origin;
- personalized Invitation URLs use only the canonical HTTPS origin;
- production never emits localhost/preview links;
- approved security headers apply to the canonical domain.

The exact domain name may be selected during DNS setup without changing product behavior.

---

## 14. Database Migration Procedure

Before production release:

1. verify migration order locally;
2. apply migrations to an isolated clean database;
3. run DB/RLS/integration tests;
4. regenerate/verify DB types;
5. verify application/schema compatibility.

Apply production migrations through the approved Supabase CLI/deployment workflow. Never use unreviewed manual production SQL as the primary process.

When practical use additive/backward-compatible migrations first, then remove obsolete schema later. If a non-backward-compatible migration is unavoidable, use a controlled maintenance release.

---

## 15. Migration Failure Procedure

If a production migration fails:

1. stop the release;
2. do not deploy code that depends on the failed schema;
3. capture a sanitized error;
4. determine whether the migration transaction rolled back;
5. correct via a new reviewed migration when history has already been applied/shared;
6. re-run from a clean test database;
7. resume only when schema state is known.

Do not edit applied production migration history to conceal failure.

---

## 16. Application Deployment Procedure

Recommended release flow:

```text
CI green
    ↓
preview verified
    ↓
production migration readiness confirmed
    ↓
apply required migrations
    ↓
deploy Vercel production build
    ↓
run production-safe smoke checks
    ↓
monitor release
```

Never run destructive E2E suites against production.

---

## 17. Release Smoke Checks

After deployment verify safely:

- application responds;
- Organizer sign-in page loads;
- a provisioned operational/test Organizer can request OTP;
- authenticated Events area loads;
- production security headers are present;
- Storage remains private;
- no obvious server/database error spike;
- database connectivity is healthy.

Guest-link smoke testing should use a dedicated test Event/Invitation, not a real Invitee record.

---

## 18. Rollback Strategy

If code is faulty and schema remains compatible, redeploy the previous known-good application version.

Database rollback is not assumed. Prefer forward-fix with a new migration; use backup restore only for severe corruption/disaster cases.

Never roll application code back to a version incompatible with the current schema.

---

## 19. Backup Strategy

Production PostgreSQL must have provider-supported automated backups enabled before launch.

Minimum V1 requirement:

```text
daily recoverable database backup
```

If the selected Supabase plan cannot satisfy that requirement, add an external encrypted backup process before launch.

Before high-risk migrations or Token-key maintenance, verify a recent recoverable backup/snapshot where provider tooling permits.

Database backup alone does not guarantee Hero Image object recovery. If private Storage is not included in provider backup capabilities, V1 accepts Organizer re-upload as the recovery path for optional Hero Images.

---

## 20. Backup Retention and D-27

D-27 requires deleted production data to age out of backups within **30 days maximum**.

Operational requirements:

- backup retention must be 30 days or less for copies containing production application data;
- undeclared archival copies beyond that window are not allowed;
- manual pre-change snapshots containing later-deleted data must also age out within 30 days;
- backup access is restricted;
- production backups are never copied into local/preview.

If the selected provider plan forces a longer immutable retention period, that conflicts with D-27 and must be resolved before launch.

---

## 21. Restore Procedure

A restore is a disaster-recovery operation.

1. identify the restore point;
2. authorize the restore;
3. restore into an isolated recovery environment first when practical;
4. verify schema/application compatibility;
5. verify RLS/security controls;
6. determine whether the restore reintroduces data deleted/erased after the restore point;
7. re-apply required deletions/erasure before returning data to normal production;
8. perform production switch/restore through provider tooling;
9. run smoke/security checks;
10. document the incident/outcome.

Do not knowingly leave previously deleted personal data reintroduced after a restore.

---

## 22. Rate-Limit Provider Boundary

Use the server-side rate-limit adapter defined by Development Architecture with a managed low-latency backend compatible with the Vercel runtime.

Provider-specific code stays behind `src/server/rate-limit/` and credentials are server-only.

Never use raw Invitation Tokens or RSVP free text as third-party rate-limit keys. Use safe/derived keys such as network bucket, HMAC-derived Token bucket, Organizer UUID, and operation category.

---

## 23. Concrete V1 Rate Limits

These are proposed production defaults. They may be operationally tuned after observing real traffic if the security intent is preserved and changes are documented.

### 23.1 Guest Invitation read

Per network/IP bucket:

```text
120 requests / 10 minutes
```

Additional per derived Token bucket:

```text
60 requests / 10 minutes
```

### 23.2 Guest RSVP write

Per network/IP + derived Token bucket:

```text
20 attempts / 10 minutes
```

### 23.3 Organizer OTP request

Per normalized email identifier:

```text
5 requests / hour
```

Per network/IP bucket:

```text
20 requests / hour
```

Do not reveal whether an email corresponds to an existing Organizer. Stricter provider limits may take precedence.

### 23.4 Organizer high-impact actions

Per authenticated Organizer:

```text
30 high-impact mutations / 10 minutes
```

Applies to Token regeneration, revocation, Hero Image upload/finalization, and similar high-impact operations.

### 23.5 Throttling result

HTTP boundaries return safe `429 Too Many Requests` behavior where appropriate without exposing Token/account validity.

---

## 24. Monitoring Model

Recommended V1 baseline:

- Vercel platform logs/observability for application runtime;
- Supabase project logs/metrics for Auth/PostgreSQL/Storage;
- application structured safe logs through the approved redaction wrapper;
- no marketing analytics/pixels.

A separate third-party error-monitoring vendor is optional. If introduced, it must apply approved redaction/scrubbing before receiving production payloads.

---

## 25. Operational Alert Conditions

Before launch configure platform-native alerts where available, or an equivalent approved mechanism, for at least:

- elevated application error rate;
- database unavailability;
- Auth failure spike;
- sustained invalid Guest Token resolution spike;
- sustained rate-limit events;
- repeated Organizer authorization failures;
- Token encryption/decryption errors;
- failed CSV exports;
- repeated Hero Image upload/finalization errors;
- RLS/database authorization errors;
- deployment failure.

---

## 26. Recommended Initial Alert Thresholds

Starting thresholds:

- `>= 10` `INTERNAL_ERROR` events in 5 minutes, or >5% request error rate over 5 minutes where request-rate data are available;
- `>= 100` unavailable Token resolutions from one network bucket in 10 minutes;
- `>= 20` ownership `FORBIDDEN` failures from one authenticated Organizer/session identity in 10 minutes;
- `>= 3` Token decryption/key-version errors in 5 minutes.

These are operational thresholds and may be tuned after observing baseline traffic.

---

## 27. Log Retention and Access

Recommended maximum normal application/request-log retention:

```text
30 days
```

Production logs are restricted to authorized operators and must follow Security/Privacy redaction rules.

Provider retention longer than 30 days is acceptable only when prohibited personal/credential data are not present and access remains restricted; raw Token-bearing paths still must be redacted/minimized.

Do not use logs as a backup of business data.

---

## 28. Hero Image Orphan Cleanup

Event deletion can leave a private unreferenced Storage object if DB deletion succeeds but Storage cleanup fails.

Immediate behavior:

- database deletion remains committed;
- orphan remains private/unreferenced;
- a redacted cleanup failure is recorded.

Run an orphan cleanup scan **daily** (or equivalently frequent schedule): list Event-scoped private objects, verify whether a referenced Event/path still exists, delete confirmed orphans, and log only safe metadata.

The bucket must remain private during cleanup.

---

## 29. Organizer Provisioning Runbook

For each new Organizer:

1. verify authorization to provision;
2. use trusted admin tooling/server-only script;
3. provision the email in Supabase Auth;
4. confirm public sign-in cannot auto-create users;
5. provide onboarding instructions if needed;
6. do not send passwords;
7. record minimum safe operational audit metadata.

Deprovisioning/erasure follows the privacy runbook rather than ad-hoc Auth deletion.

---

## 30. Privacy / Erasure Runbook

D-27 defines verified operational account-wide privacy/erasure handling.

1. verify requestor identity/control of the Organizer account;
2. identify owned Events;
3. determine whether any active Published Event is affected;
4. do not invent active-Event deletion behavior;
5. if the request conflicts with the active-Published deletion restriction, escalate for explicit product/legal handling rather than bypassing approved behavior;
6. remove eligible Draft/Ended Event data through approved destructive operations or equivalent controlled administration;
7. remove corresponding private Hero Images;
8. deprovision the Auth account only when approved/legal handling permits;
9. record sanitized completion metadata;
10. ensure deleted production data age out of backups within 30 days.

This is not a self-service product flow.

---

## 31. Invitation Token Encryption-Key Rotation

Use the approved versioned AES-256-GCM model.

1. generate a new 256-bit encryption key securely;
2. store it as a new server secret version;
3. deploy code/config capable of reading old and new versions;
4. switch the active write version;
5. re-encrypt current credentials through a controlled server-only maintenance command;
6. verify migration completion;
7. retire the old key only when no current credential depends on it and the rollback window no longer requires it.

Never log raw Tokens.

---

## 32. HMAC Key Rotation

Because the current schema has no HMAC key-version column, rotation is controlled maintenance.

1. verify recoverable encryption keys for all current credentials;
2. generate a new HMAC key;
3. use controlled maintenance mode if needed;
4. decrypt current Tokens server-side;
5. compute new HMAC lookup hashes;
6. update hashes with uniqueness protection;
7. switch application HMAC key;
8. verify representative Guest links;
9. retire the old HMAC key;
10. never log raw Tokens.

Verify a recent recoverable DB backup first.

---

## 33. Service-Role Key Rotation

If the Supabase service-role key is compromised or rotated:

1. obtain/create replacement through supported project controls;
2. update the production server secret;
3. redeploy;
4. verify privileged operations;
5. revoke/remove the previous key;
6. review logs/configuration for suspicious use.

---

## 34. Incident Severity

### SEV-1 — Critical

Examples: public private-data exposure, service-role/Token-key compromise, confirmed cross-Organizer access, destructive RSVP/Event corruption, widespread Token exposure.

Response: immediate mitigation, possible capability suspension, credential rotation, evidence preservation, recovery/notification assessment.

### SEV-2 — High

Examples: repeated bypass attempts without confirmed exposure, multi-Invitation decryption failures, production Auth outage, major DB/service outage, severe release failure.

### SEV-3 — Moderate

Examples: isolated feature failure with workaround, Hero Image unavailable while RSVP works, CSV failure, non-sensitive UI regression.

---

## 35. Security Incident Response

For a suspected incident:

1. identify affected environment;
2. restrict/disable affected operation if necessary;
3. preserve sanitized evidence;
4. rotate affected secrets/credentials;
5. verify authorization boundaries;
6. assess affected Event/Invitation data;
7. deploy fix;
8. run security regressions;
9. restore safe service;
10. document cause/corrective action;
11. follow applicable legal/privacy obligations where required.

No jurisdiction-specific legal notification timeline is invented here.

---

## 36. Guest Token Leak Response

For one leaked Invitation link before Event expiration, use approved product actions:

```text
Regenerate Invitation Token
or
Revoke Invitation
```

Operational support must not manually edit hashes/ciphertext as a substitute.

After Ended, Guest access is already expired and ordinary regeneration/revocation remain unavailable under D-26.

---

## 37. Organizer Account Compromise Response

If Organizer compromise is suspected:

1. invalidate active Auth sessions using supported Supabase controls;
2. resecure email access as applicable;
3. review recent Organizer actions/logs;
4. rotate platform secrets only if evidence suggests exposure;
5. restore access using the approved provisioned OTP model;
6. review deletion, regeneration, and revocation activity for unauthorized changes.

V1 does not add password-reset or MFA recovery flows.

---

## 38. Scheduled Operational Review

At least monthly during active production use, review:

- dependency/security updates;
- Vercel/Supabase access;
- production secret access list;
- Auth/authorization failures;
- rate-limit events;
- Token crypto errors;
- DB/Storage health;
- backup recoverability;
- orphan cleanup;
- pending privacy/erasure requests.

Around the real production wedding Event, review operational health more frequently.

---

## 39. Pre-Event Readiness Check

Before sending production Invitation links for the first real Event:

- production domain/HTTPS confirmed;
- Organizer production OTP works;
- current test Invitation link opens;
- regenerated old test Token is invalid;
- revoked test Invitation is unavailable;
- RSVP Deadline behavior verified on a test Invitation;
- dashboard totals match test data;
- CSV opens safely;
- Hero Image, if used, remains private and loads only through authorized Guest access;
- backup status confirmed;
- monitoring/alerts enabled;
- operator understands regeneration/revocation.

Do not use a real Invitee as the only operational test case.

---

## 40. Release Checklist

Before each production release:

```text
[ ] pull request reviewed
[ ] required CI checks green
[ ] migrations reviewed
[ ] migration compatibility assessed
[ ] production secrets/config present
[ ] preview verification complete
[ ] security-sensitive changes reviewed
[ ] rollback/forward-fix path understood
```

After deployment:

```text
[ ] migration/deployment successful
[ ] safe smoke checks pass
[ ] error/authorization logs normal
[ ] OTP still works
[ ] Guest access still works
[ ] private Storage still private
[ ] critical security headers present
```

---

## 41. Production Launch Checklist

```text
[ ] all source-of-truth documents Approved
[ ] selected runtime/framework/dependency versions were verified from current authoritative sources
[ ] no unapproved prerelease/experimental dependency is present
[ ] D-01 through D-28 reflected in implementation
[ ] production Supabase configured
[ ] production Vercel configured
[ ] HTTPS domain configured
[ ] production Organizer provisioned
[ ] public self-sign-up disabled
[ ] OTP delivery verified
[ ] production HMAC key provisioned
[ ] production encryption key/version provisioned
[ ] service-role secret server-only
[ ] private Hero Image bucket configured
[ ] RLS tests pass against production-equivalent schema
[ ] production rate limits configured
[ ] security headers configured
[ ] logging redaction verified
[ ] backup policy verified
[ ] 30-day deleted-data backup maximum satisfied
[ ] monitoring/alerts configured
[ ] orphan cleanup process available
[ ] privacy/erasure runbook available
[ ] key-rotation runbooks available
[ ] full pre-release test suite green
[ ] manual release verification complete
[ ] no unresolved critical security issue
```

---

## 42. Operational Data Access

Production data access is restricted. Operators should inspect Guest RSVP content only when required for authorized support, incident response, verified privacy requests, or recovery. Dietary Requirements receive higher-sensitivity handling.

Do not export production CSV solely for debugging when safer logs/test data can diagnose the issue.

---

## 43. Production Support Boundaries

V1 support may assist with provisioning, OTP delivery problems, deployment/configuration, incidents, verified privacy/erasure requests, Token-security guidance, orphan cleanup, and backup/recovery.

Support must not silently perform a product action the Owner is prohibited from performing, such as deleting an active Published Event.

If support needs conflict with approved behavior, return to the specification/decision process.

---

## 44. Recovery Priority

During outage recovery prioritize:

1. confidentiality / preventing unauthorized exposure;
2. Event/Invitation/RSVP integrity;
3. Guest Invitation read access;
4. Guest RSVP writes;
5. Organizer operational access;
6. non-critical Hero Image/polish capabilities.

A safe read-only state is preferable to accepting invalid or unauthorized writes.

---

## 45. Operational Acceptance Scenarios

### OPS-AS-01 — Environment isolation

Preview uses only non-production Supabase credentials/data and cannot read production Events.

### OPS-AS-02 — Missing production secret

Missing/malformed required production secrets cause safe startup/deployment failure rather than fallback credentials.

### OPS-AS-03 — Unknown Organizer email

Unknown-email OTP attempts do not create an Organizer account and do not unnecessarily reveal account existence.

### OPS-AS-04 — Migration failure

A failed production migration blocks dependent application deployment until schema state is known/corrected.

### OPS-AS-05 — Backup deletion aging

No backup containing permanently deleted production Event data remains beyond 30 days.

### OPS-AS-06 — Orphan Hero Image cleanup

If DB deletion commits but Storage cleanup fails, Event deletion remains committed, the object remains private/unreferenced, and operational cleanup removes it later.

### OPS-AS-07 — Encryption-key rotation

New credentials use the new key version while existing credentials remain decryptable until re-encrypted and the old key is safely retired.

### OPS-AS-08 — HMAC rotation

Current Invitation Tokens continue to resolve after controlled rehashing and raw Tokens are never logged.

### OPS-AS-09 — Log redaction

Representative production requests/errors do not expose prohibited Token/session/RSVP secret fields in logs.

### OPS-AS-10 — Production rate limiting

Requests exceeding configured thresholds receive safe throttling without revealing Token/account validity.

---

## 46. Operations Verification

Automated where practical:

- environment-schema validation;
- client-bundle secret scan;
- migration-on-clean-database;
- rate-limit integration tests with production-equivalent configuration;
- security-header tests;
- private Storage access test;
- log-redaction test;
- unknown-email Auth test;
- key-rotation command tests using non-production keys;
- orphan-cleanup dry-run/test.

Manual operational verification:

- production domain/DNS;
- email sender delivery;
- provider backup status;
- provider alert configuration;
- access-control review.

---

## 47. Backup Restore Drill

Before first production launch, perform one non-production restore drill.

Verify:

- backup can be restored;
- current application can read the migrated schema;
- RLS remains enabled;
- Organizer ownership remains correct;
- restored test environment uses test cryptographic keys only;
- private Storage remains private;
- the deleted-data re-application procedure is understood.

Repeat periodically if the platform continues beyond the initial Event.

---

## 48. Operational Documentation Location

Store non-secret runbooks under a clear repository path such as:

```text
docs/operations/
```

Suggested files:

```text
organizer-provisioning.md
production-release.md
privacy-erasure.md
token-key-rotation.md
backup-restore.md
hero-image-orphan-cleanup.md
incident-response.md
```

Never place secret values in these files.

---

## 49. Access Review

Before launch and periodically afterward, review access to:

- Git repository;
- Vercel production project;
- Supabase production project;
- production secret vault;
- DNS/domain account;
- OTP email sender configuration.

Remove stale access promptly. V1 does not require enterprise IAM, but least privilege still applies.

---

## 50. Operational Decisions Proposed by This Document

These are engineering/operations choices, not new product business rules.

### OPS-D01 — Three environment classes

Use local, preview, and production with strict production isolation.

### OPS-D02 — Daily database backup minimum

Production must have at least one daily recoverable DB backup before launch.

### OPS-D03 — 30-day maximum backup retention for deleted production data

Backup copies containing deleted Event data must age out within D-27's 30-day maximum.

### OPS-D04 — Production rate-limit defaults

Use the Section 23 starting thresholds through the configurable rate-limit adapter.

### OPS-D05 — Platform-native monitoring first

Use Vercel/Supabase operational logging/monitoring as the V1 baseline; third-party error monitoring is optional and must preserve redaction rules.

### OPS-D06 — Daily private-media orphan cleanup

Run or schedule a daily Hero Image orphan cleanup process.

### OPS-D07 — Forward-fix migrations preferred

Do not assume reversible production migrations; forward-fix is the default recovery approach.

### OPS-D08 — No destructive production automated suite

Production verification uses safe smoke checks and manual release verification.

### OPS-D09 — Operational scripts are server-only

Provisioning, erasure, key rotation, and orphan cleanup are never public product endpoints.

---

## 51. Explicit Operational Deferrals

These may be selected during deployment without changing product behavior:

- exact production domain;
- Git hosting provider;
- exact Vercel plan;
- exact Supabase paid plan;
- managed rate-limit vendor;
- DNS provider;
- transactional-email provider/configuration used through Supabase;
- optional third-party monitoring vendor;
- operator password-manager/vault product.

Any selected option must still satisfy this specification.

---

## 52. Traceability

| Operational requirement | Source |
|---|---|
| Environment separation | `04-technical-architecture.md`, `10-security-and-privacy.md` |
| Vercel + Supabase topology | `04-technical-architecture.md` |
| Provisioned OTP Organizer | D-28, FR-SEC-004 |
| Secrets separation | `10-security-and-privacy.md` |
| Token key rotation | Security Sections 8–9 |
| Rate limiting | Security Section 16 / SEC-D10 |
| Logging redaction | Security Section 21 / SEC-D09 |
| Private Hero Image | Security Section 18 |
| Event deletion | D-27 |
| 30-day backup maximum | D-27, Security Section 26 |
| Migrations | Data Model / Development Architecture |
| CI/test gates | `11-testing-strategy.md`, `13-development-roadmap.md` |
| Orphan cleanup | API `deleteEvent`, Development Architecture |
| Production launch gate | `13-development-roadmap.md` |

---

## 53. Review Checklist

Before marking this document Approved, confirm:

- local/preview/production separation is acceptable;
- production secrets are isolated;
- daily DB backup minimum is acceptable;
- 30-day maximum backup retention is enforceable with the selected production plan;
- migration/deployment ordering is acceptable;
- forward-fix migration approach is acceptable;
- production OTP sender/config can be provisioned;
- rate-limit defaults in Section 23 are acceptable;
- monitoring/alert baseline is acceptable;
- normal log-retention recommendation is acceptable;
- daily Hero Image orphan cleanup is acceptable;
- provisioning/erasure/key-rotation runbooks are acceptable;
- support boundaries do not bypass product rules;
- launch checklist is sufficient;
- no new product/business rule was introduced.

---

## 54. Final Pre-Implementation Gate

After this document is Approved:

1. all planned V1 source-of-truth specifications are complete;
2. create/approve any required ADRs that have not yet been written;
3. bootstrap the repository according to `12-development-architecture.md`;
4. implement in the order defined by `13-development-roadmap.md`;
5. use `11-testing-strategy.md` as the release-quality gate;
6. use this document for environment/deployment/operations setup;
7. return to the specification process whenever implementation requires new business behavior.

The next phase is:

**Codex-assisted V1 implementation.**
