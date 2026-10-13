# 10 — Security and Privacy

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document defines the V1 security and privacy requirements for the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, `03-user-flows.md`, `04-technical-architecture.md`, `05-data-model.md`, `06-design-system-and-ui-foundation.md`, `07-guest-experience-spec.md`, `08-admin-dashboard-spec.md`, and `09-api-and-server-contracts.md`. It must not introduce new product/business behavior.

---

## 1. Purpose

This document defines the V1 security and privacy baseline.

It specifies:

- protected assets and threat model;
- trust boundaries;
- personalized Invitation Token security;
- token generation, lookup, encryption, and rotation;
- Organizer authentication/session security constraints;
- Organizer authorization and RLS defense in depth;
- service-role isolation;
- Guest access privacy and anti-enumeration behavior;
- browser request protections;
- rate limiting and abuse controls;
- secure response headers;
- Hero Image upload/storage security;
- XSS and unsafe-content handling;
- CSV security;
- logging, telemetry, and redaction;
- secrets management;
- environment separation;
- personal-data classification;
- privacy-by-design requirements;
- security testing and incident-readiness expectations;
- unresolved retention/account-lifecycle product decisions.

This document does not change approved Event, Invitation, RSVP, deadline, or Ended behavior.

---

# 2. Security Objectives

V1 must protect these properties.

## SEC-O01 — Invitation confidentiality

Possession of one valid Invitation Token grants access only to that one Invitation while approved access conditions permit it.

A Guest must not be able to enumerate, infer, or retrieve another Invitation by modifying identifiers.

## SEC-O02 — Organizer authorization

Only the authenticated Event Owner may access Organizer records and operations for that Event.

## SEC-O03 — Credential confidentiality

Raw Invitation Tokens, Supabase privileged credentials, cryptographic keys, and authenticated session secrets must not leak through:

- logs;
- client bundles;
- browser storage intended for application data;
- CSV exports;
- public caches;
- analytics payloads;
- source control.

## SEC-O04 — Business-rule integrity

Security controls must not permit bypass of:

- Maximum Party Size;
- Event lifecycle;
- RSVP Deadline;
- Invitation revocation;
- token regeneration invalidation;
- Ended Event read-only behavior;
- Organizer ownership;
- Guest Message read-only behavior for Organizer.

## SEC-O05 — Personal-data minimization

Guest and Organizer personal content must be exposed only to the minimum surface required by approved workflows.

---

# 3. Protected Assets

## 3.1 High-sensitivity secrets

Treat as secrets:

- raw Invitation Token;
- full personalized Invitation URL containing the Token;
- decrypted Invitation Token value;
- `SUPABASE_SERVICE_ROLE_KEY`;
- Invitation Token HMAC key;
- Invitation Token encryption key;
- cryptographic nonces/authentication tags when combined with ciphertext metadata;
- authenticated Supabase session tokens/cookies.

## 3.2 Private personal/Event data

Treat as private application data:

- Invitee Name;
- Attendee Names;
- RSVP Status;
- Attendee Count;
- Dietary Requirements;
- Guest Message;
- Organizer Contact Information;
- Event venue/address;
- Event timing;
- current RSVP timestamps;
- Hero Image;
- Organizer-owned dashboard/reporting data.

Some Event information may be intentionally visible to a valid Invitee, but it is still not public-web data.

## 3.3 Internal security metadata

Treat as server/internal data:

- internal UUIDs;
- `token_lookup_hash`;
- `token_ciphertext`;
- token key version;
- RLS/persistence implementation details;
- error correlation identifiers.

Internal IDs are not credentials but should not be exposed unnecessarily.

---

# 4. Primary Threat Model

V1 must explicitly defend against at least these threats.

## SEC-T01 — Token guessing / enumeration

Attacker attempts to discover valid personalized links.

Controls:

- at least 256 bits of random Token entropy;
- no sequential public Invitation identifiers;
- server-side HMAC lookup;
- generic unavailable responses;
- rate limiting;
- no validity-dependent public metadata.

## SEC-T02 — Token leakage

A valid personalized URL is leaked through logs, analytics, referrers, screenshots, browser history, or forwarding.

The platform cannot prevent a legitimate recipient from forwarding a bearer credential.

It must minimize accidental platform-originated leakage.

## SEC-T03 — Organizer horizontal privilege escalation

Authenticated Organizer attempts to read/write another Organizer's Event by changing an Event or Invitation ID.

Controls:

- server-side ownership checks;
- RLS;
- Event-scoped query constraints;
- no trust in client-provided ownership.

## SEC-T04 — Guest privilege escalation

Guest attempts to submit arbitrary Invitation IDs or access Admin endpoints using a valid Guest Token.

Controls:

- Guest authority derives only from current Token resolution;
- Guest route never treats a browser-provided Invitation UUID as access authority;
- Admin contracts require authenticated Organizer session.

## SEC-T05 — Business-rule bypass

Attacker submits crafted requests that bypass UI restrictions.

Controls:

- server validation;
- database constraints;
- transactional cross-table checks.

## SEC-T06 — Stored/reflected XSS

Organizer/Guest free-text fields contain HTML/script payloads.

Controls:

- text rendering only;
- framework escaping;
- no arbitrary HTML rendering;
- CSP;
- strict URL handling.

## SEC-T07 — Malicious file upload

Organizer attempts or is tricked into uploading a non-image or active-content file as Hero Image.

Controls:

- authenticated ownership;
- private bucket;
- file-size/type limits;
- magic-byte verification;
- no SVG in V1;
- randomized storage object name.

## SEC-T08 — CSV/spreadsheet formula injection

Guest-controlled text begins with spreadsheet formula prefixes and later executes when Organizer opens CSV.

Controls are defined in Section 19.

## SEC-T09 — Secret exposure through deployment/configuration

Privileged keys are accidentally exposed through `NEXT_PUBLIC_*`, repository commits, preview environments, or client imports.

Controls:

- strict environment separation;
- server-only modules;
- secret scanning/review;
- separate production/non-production keys.

## SEC-T10 — Abuse / resource exhaustion

Automated clients repeatedly resolve Tokens, submit RSVP mutations, upload media, or trigger high-impact Organizer operations.

Controls:

- rate limiting;
- input size limits;
- request validation;
- bounded file upload size;
- database constraints.

---

# 5. Trust Boundaries

```text
UNTRUSTED
Guest Browser
Organizer Browser
URL/input/form data
Uploaded file bytes
External links
        |
        v
TRUSTED APPLICATION BOUNDARY
Next.js Server Components
Server Actions
Route Handlers
Domain/Application Services
        |
        v
CONTROLLED PRIVILEGED BOUNDARY
Supabase authenticated client
Supabase service-role client (narrow use)
PostgreSQL / RLS
Private Storage
        |
        v
SECRET BOUNDARY
Deployment environment secrets
Token HMAC key
Token encryption key
Service-role key
```

Rules:

- browsers never receive service-role credentials;
- browsers never receive Token cryptographic keys;
- client state is never authoritative for authorization;
- all state-changing operations cross server authorization + validation;
- privileged persistence access must be confined to server-only modules.

---

# 6. Invitation Token Security Model

The Invitation Token is a bearer credential.

Anyone possessing the current Token may access the one Invitation while Event/Invitation access rules permit it.

## 6.1 Token generation

V1 Token generation must use a cryptographically secure random source.

Required entropy:

```text
minimum 256 random bits
```

Recommended representation:

```text
32 random bytes -> base64url without padding
```

Do not use:

- UUID v4 as the primary Invitation bearer credential;
- timestamps;
- database IDs;
- counters;
- human-readable slugs alone;
- pseudo-random application utilities that are not cryptographically secure.

## 6.2 Token input bounds

The server should reject obviously malformed Token inputs before database lookup.

Token input parsing must have a small fixed maximum length sufficient for the approved encoding so an attacker cannot send unbounded path/input data.

Exact route syntax remains a routing/development detail.

## 6.3 Token transport

The personalized Token should be carried as part of the HTTPS URL route and must not be duplicated into query parameters, fragments, page-visible diagnostics, or analytics parameters.

All production Guest access requires HTTPS.

## 6.4 Browser storage

Do not persist the Invitation Token into:

- `localStorage`;
- `sessionStorage`;
- IndexedDB;
- application cookies.

The Guest can revisit through the personalized URL itself.

## 6.5 Referrer protection

Personalized Invitation responses must set:

```text
Referrer-Policy: no-referrer
```

This reduces accidental Token-bearing URL leakage to external map/navigation destinations and other cross-origin requests.

---

# 7. Token Lookup and Persistence

The approved architecture/data model uses:

```text
raw Token
  -> HMAC lookup hash
  -> encrypted recoverable Token value
```

## 7.1 Lookup hash

Use:

```text
HMAC-SHA-256(token_hash_key, raw_token)
```

Requirements:

- HMAC key is server-only;
- HMAC key is different from the encryption key;
- compare fixed-size binary values using standard library/database equality, not custom string comparison code;
- `token_lookup_hash` remains uniquely indexed;
- raw Token is not persisted as a plaintext-only database value.

## 7.2 Recoverable Token ciphertext

Use authenticated encryption.

Approved implementation family:

```text
AES-256-GCM
```

Ciphertext storage must include enough envelope metadata to decrypt safely, including:

- nonce/IV;
- authentication tag if not encoded together by the chosen library;
- ciphertext;
- key version.

The exact encoded envelope format is an implementation detail, but parsing must be strict and versioned.

## 7.3 Cryptographic library rule

Use a well-maintained platform/library cryptography implementation.

Do not implement custom:

- AES;
- GCM;
- HMAC;
- random-number generation;
- padding;
- nonce generation.

---

# 8. Token Encryption Key Handling

## 8.1 Separation

Use distinct secrets for:

- HMAC lookup;
- encryption.

Do not derive both from the same literal environment value unless a reviewed KDF-based design is introduced later through an ADR.

## 8.2 Storage

Token cryptographic keys live only in server-side environment secret storage.

They must not be:

- committed to Git;
- stored in database rows;
- exposed to Client Components;
- exposed through `NEXT_PUBLIC_*`;
- written to logs.

## 8.3 Key version

`token_key_version` identifies the encryption key version used for the ciphertext.

New Token creation/regeneration uses the current encryption key version.

Reads must support decrypting currently stored versions during an approved rotation window.

---

# 9. Cryptographic Key Rotation

## 9.1 Encryption-key rotation

Encryption-key rotation must support:

1. add a new encryption key version to server secrets;
2. switch new Token writes/regenerations to the new version;
3. continue decrypting older current Token ciphertext by recorded key version;
4. re-encrypt older current Token ciphertext opportunistically or through a controlled migration;
5. remove an old key only after no current credential depends on it.

## 9.2 HMAC-key rotation

The current data model does not store a lookup-hash key version.

For V1 scale, HMAC-key rotation is a controlled maintenance operation:

1. retain the current Token encryption keys;
2. decrypt each current Token server-side;
3. compute the new HMAC lookup hash;
4. update all credential hashes with uniqueness guarantees;
5. switch the application to the new HMAC key;
6. securely remove the old HMAC key after verification.

The rotation process must not log raw Tokens.

If V1 later requires zero-downtime independent HMAC-key rotation at larger scale, update the Data Model/ADR before implementation rather than silently adding a new credential schema.

---

# 10. Token Regeneration and Revocation Security

## 10.1 Regeneration

Regeneration is security-sensitive and must remain atomic.

After successful commit:

- old lookup hash does not authorize access;
- new Token is current;
- Invitation identity is unchanged;
- current RSVP is unchanged.

The server must return the new URL only to the authenticated Event Owner.

## 10.2 Revocation

Revocation denies Guest access without deleting credential/business rows.

Guest resolution must evaluate revocation before returning private Invitation data.

## 10.3 Ended Event

Under D-26, Organizer regeneration and revocation are not permitted after Event expiration.

The server, not only the UI, rejects these operations.

---

# 11. Guest Access Privacy and Anti-Enumeration

## 11.1 Generic unavailable result

Unauthenticated Guest responses should not reveal whether an unavailable personalized URL is:

- malformed;
- unknown;
- obsolete after regeneration;
- for a Draft Event;
- revoked;
- Ended.

The approved Guest UI may distinguish Ended only when the security implementation can do so without exposing additional private data, but a fully generic unavailable page is always acceptable.

## 11.2 No private metadata before authorization

Do not emit private Event data into:

- HTML;
- page metadata;
- Open Graph metadata;
- JSON payloads;
- image URLs;
- error text

until Guest access has been authorized.

## 11.3 No public caching

Personalized Guest responses:

```text
Cache-Control: private, no-store
```

Do not statically generate pages per Token.

## 11.4 Search engine controls

Personalized Guest pages:

```text
noindex
nofollow
```

Robots directives are privacy hygiene only, not authorization.

---

# 12. Organizer Authentication Security

Supabase Auth remains the authentication provider.

D-28 defines the V1 sign-in/provisioning model: Organizer accounts are provisioned administratively, public self-sign-up is disabled, and sign-in uses passwordless email OTP through Supabase Auth.

Regardless of sign-in method:

- Organizer-only routes require a valid server-resolved Supabase session;
- session identity must not come from client-submitted user IDs;
- authenticated session material must use secure provider-supported cookie handling for SSR;
- do not persist privileged session tokens in application `localStorage`;
- sign-out must invalidate/remove the local authenticated session context;
- authentication failures must not reveal another Organizer's account/Event information;
- unknown emails must not auto-create Organizer accounts;
- the public application must not expose a self-sign-up flow.

Password authentication, password reset/recovery, public registration, and MFA are outside V1 unless later approved.

---

# 13. Organizer Authorization Defense in Depth

Every Event-scoped Organizer read/write must enforce ownership.

## 13.1 Application-layer check

Server/domain service verifies:

```text
events.owner_user_id == authenticated user id
```

or resolves the child Invitation/RSVP through an owned Event.

## 13.2 RLS

RLS is enabled for application tables.

Authenticated Organizer policies enforce ownership relationships.

## 13.3 Ended Event mutability

For writes:

```text
authenticated
AND owner
AND Event not Ended
```

except no Event-scoped mutations are allowed after Ended under D-26.

## 13.4 Identifier handling

An internal UUID supplied by the browser is a lookup input only.

It is never proof of authorization.

---

# 14. Service-Role Security

The Supabase service-role credential bypasses RLS and is therefore high risk.

Requirements:

- server-only environment secret;
- imported only by narrow persistence modules;
- never referenced in Client Components;
- never prefixed `NEXT_PUBLIC_`;
- never returned to the browser;
- never logged;
- never used as a convenience replacement for normal authenticated Organizer queries.

Permitted use cases include narrowly scoped operations that require trusted server access, such as current Invitation credential lookup or controlled Guest RSVP persistence where anonymous RLS is intentionally not used.

Every service-role operation must perform explicit application authorization/validation first.

---

# 15. Browser Request and CSRF Protections

Organizer state-changing requests are authenticated with cookies/session context and must be protected against cross-site request abuse.

Requirements:

- use provider/framework secure cookie defaults;
- production cookies use `Secure`;
- use `HttpOnly` for session cookies when supported by the Supabase SSR approach;
- use an appropriate `SameSite` policy compatible with the selected Auth flow;
- Server Actions/Route Handlers must reject untrusted cross-origin state-changing requests;
- validate `Origin`/framework-equivalent request provenance for custom state-changing Route Handlers;
- do not expose state-changing GET endpoints.

Guest RSVP mutation is Token-authorized but should still require same-origin form/action submission from the personalized page where practical.

Exact implementation follows the selected Next.js/Supabase Auth integration.

---

# 16. Rate Limiting and Abuse Controls

V1 requires abuse protection for externally reachable sensitive operations.

## 16.1 Guest Invitation resolution

Rate-limit repeated Guest access attempts using a combination of:

- source IP/network signal;
- Token lookup outcome bucket;
- short rolling time window.

Do not create a response pattern that reveals whether a Token exists.

## 16.2 Guest RSVP mutation

Use a stricter mutation limit than read resolution.

The limit should prevent rapid automated writes while allowing normal Guest corrections.

## 16.3 Organizer high-impact actions

Apply mutation throttling to:

- Token regeneration;
- revocation;
- Hero Image upload authorization;
- repeated failed publication/mutation bursts when appropriate.

Authenticated Organizer limits may be more permissive than unauthenticated Guest limits.

## 16.4 Auth endpoints

Rely on Supabase Auth's supported abuse protections and add application/platform controls where needed.

## 16.5 Threshold configuration

Exact numeric thresholds are operational security settings and are deferred to `14-deployment-and-operations.md`.

The deployment specification must define concrete production values before launch.

Rate-limited requests return a safe throttling response such as HTTP `429` where an HTTP endpoint is used.

---

# 17. Input and Output Safety

## 17.1 Free-text rendering

These values are rendered as plain text, not arbitrary HTML:

- Event Description / Invitation Message;
- Dress Code;
- Venue / Arrival Notes;
- Organizer Contact Information;
- Invitee Name;
- Attendee Names;
- Dietary Requirements;
- Guest Message.

React/Next.js escaping must remain intact.

Do not use unsanitized `dangerouslySetInnerHTML`.

## 17.2 External URLs

`venue_map_url` must be validated server-side as an absolute HTTPS URL before persistence or before rendering as an external navigation target.

Do not permit:

- `javascript:`;
- `data:`;
- arbitrary executable schemes.

External links opened in a new browsing context use safe `noopener`/`noreferrer` behavior.

## 17.3 Error output

Do not return raw:

- SQL error text;
- stack traces;
- Supabase service errors containing secret context;
- cryptographic exceptions;
- filesystem/storage paths that reveal internal structure.

---

# 18. Hero Image Upload Security

Hero Image is the only V1 user-uploaded media.

## 18.1 Authorization

Only the authenticated Event Owner may upload, replace, or remove the Hero Image for a non-Ended Event.

## 18.2 Storage

Use a private Supabase Storage bucket.

Object paths are Event-scoped and generated by trusted code.

Do not use the original filename as the security boundary.

## 18.3 Allowed formats

V1 accepts only raster image formats:

```text
image/jpeg
image/png
image/webp
```

Do not accept SVG in V1 because it can contain active/scriptable content.

Do not accept HTML, PDF, executable files, or arbitrary binary content.

Animated image support is not required.

## 18.4 File verification

Do not trust the browser `Content-Type` or file extension alone.

Server/storage authorization flow must verify:

- declared MIME type;
- file signature / magic bytes where practical;
- allowed extension if retained.

A mismatch is rejected.

## 18.5 File-size baseline

V1 Hero Image upload maximum:

```text
10 MiB per source file
```

Deployment/operations may configure a lower limit, but raising the limit requires updating the security specification.

## 18.6 Serving

Guests receive a short-lived signed/private read URL only after Invitation access is authorized.

Do not make the Storage bucket publicly readable.

---

# 19. CSV Export Security

CSV contains private Guest/Event information and may be opened in spreadsheet software.

## 19.1 Authorization

CSV export requires:

- authenticated Organizer;
- Event ownership.

Export remains permitted for Ended Events.

## 19.2 Credential exclusion

Never include:

- raw Token;
- personalized URL;
- Token lookup hash;
- Token ciphertext;
- key version;
- internal database IDs.

## 19.3 Formula injection protection

User-supplied text beginning with spreadsheet formula-significant prefixes must not be emitted in a form that spreadsheet applications can execute as a formula.

At minimum protect cells beginning, after leading whitespace handling, with:

```text
=
+
-
@
```

Use a consistent neutralization strategy such as prefixing an apostrophe before CSV escaping.

This applies to user-controlled text fields including:

- Invitee Name;
- Attendee Names;
- Dietary Requirements;
- Guest Message;
- Event-derived filename components if used.

CSV must still use proper RFC-4180-style quoting/escaping.

If this security specification is approved, `09-api-and-server-contracts.md` must be updated so formula neutralization is part of the executable CSV contract.

## 19.4 Response

CSV response remains:

```text
private, no-store
```

---

# 20. Secure Response Headers

Production responses must use a security-header baseline.

## 20.1 Required

At minimum configure:

```text
Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy
```

## 20.2 Framing

CSP must prevent unauthorized framing.

Use:

```text
frame-ancestors 'none'
```

unless a later approved integration requires framing.

## 20.3 CSP goals

Production CSP should:

- default to same-origin;
- restrict scripts to application-required sources;
- restrict images to approved app/Supabase signed-image sources and necessary data/blob cases only if required;
- restrict connections to required Supabase/application origins;
- disallow object/plugin content;
- set `base-uri 'self'`;
- set `form-action 'self'`;
- avoid wildcard source policies;
- avoid `unsafe-eval` in production.

Next.js nonce/hash implementation details belong to Development Architecture/Deployment Operations.

## 20.4 Permissions Policy

Disable browser capabilities not required by V1, including:

- camera;
- microphone;
- geolocation

unless a later approved feature requires them.

---

# 21. Logging and Redaction

## 21.1 Never log intentionally

Do not log:

- raw Invitation Token;
- full personalized URL;
- decrypted Token;
- HMAC/encryption keys;
- service-role key;
- Supabase access/refresh tokens;
- Guest Message;
- Dietary Requirements;
- Attendee Names;
- Organizer Contact Information.

## 21.2 Prefer safe identifiers

Operational logs may use:

- request/correlation ID;
- internal Event UUID;
- internal Invitation UUID;
- action name;
- safe error code;
- authenticated Organizer UUID where appropriate;
- result status;
- timing/latency.

Internal IDs are acceptable in server logs but not public error text.

## 21.3 URL logging

Infrastructure/application access logs must be reviewed so Token-bearing request paths are not retained unnecessarily.

Where platform controls allow:

- disable or redact full request-path logging for personalized Token routes;
- avoid sending full URLs to third-party observability tools.

If Vercel/Supabase platform logs cannot fully suppress request paths, deployment review must document residual exposure and minimize log retention/access.

## 21.4 Error reporting

Error-reporting integrations must apply before-send scrubbing/redaction for:

- URLs;
- headers/cookies;
- request bodies;
- personal RSVP fields.

---

# 22. Analytics and Third-Party Scripts

No third-party analytics/marketing integration is required by approved V1 scope.

If analytics is later added:

- do not send raw Tokens or personalized URLs;
- do not send Invitee Name, Attendee Names, Dietary Requirements, Guest Message, Organizer Contact Information, or RSVP free text;
- do not expose authenticated Admin payloads;
- use aggregate/privacy-safe event names and internal non-credential identifiers where needed;
- update Security/Privacy before adding a vendor that receives personal data.

Do not add marketing pixels to personalized Guest pages in V1 without an explicit specification update.

---

# 23. Secrets Management

## 23.1 Secret categories

Server-only secrets include:

```text
SUPABASE_SERVICE_ROLE_KEY
INVITATION_TOKEN_HASH_KEY
INVITATION_TOKEN_ENCRYPTION_KEY / versioned keys
```

Public configuration may include only values explicitly safe for browser exposure, such as the Supabase project URL and anon/publishable key.

## 23.2 Environment separation

Production and non-production must use separate:

- Supabase projects/data;
- service-role keys;
- Token HMAC keys;
- Token encryption keys.

Do not copy production secrets into preview/local environments.

## 23.3 Source control

Secrets must not be committed.

Repository workflows should use secret-scanning/pre-commit or CI checks where practical.

If a secret is committed or exposed, treat it as compromised and rotate it; deleting the Git line alone is insufficient.

---

# 24. Personal Data and Privacy Classification

## 24.1 Direct personal data

Includes:

- Invitee Name;
- Attendee Names;
- Organizer account identity/contact details;
- Guest Message.

## 24.2 Potentially sensitive personal content

Dietary Requirements may reveal health, allergy, religious, or other sensitive information.

Treat Dietary Requirements as higher-sensitivity application content.

Requirements:

- display only to the authorized Organizer and the corresponding valid Guest;
- do not include in logs/analytics;
- include in CSV only because D-12 explicitly approves it;
- protect CSV as private Organizer output;
- do not use for unrelated profiling.

## 24.3 Event/location data

Venue, date, time, and private Event details are not public discovery data.

They are visible only through authorized Organizer access or a valid Guest Invitation before expiration.

---

# 25. Privacy-by-Design Requirements

V1 must follow:

## PRIV-01 — Purpose limitation

Use RSVP and Invitation data only to provide the approved Event/Invitation management experience and required operations.

## PRIV-02 — Data minimization

Do not collect fields that are not present in approved specifications.

Examples not collected in V1:

- government ID;
- date of birth;
- payment data;
- precise device location;
- attendee categories;
- per-Attendee dietary profiles.

## PRIV-03 — Least exposure

Do not place private Guest data into:

- public metadata;
- unauthenticated Admin routes;
- public storage buckets;
- logs/analytics;
- CSV fields beyond approved export.

## PRIV-04 — No advertiser data flow

The application has no V1 requirement to share RSVP/Invitee data with advertising systems.

## PRIV-05 — Access expiration is not deletion

Event expiration/revocation prevents Guest access as approved but does not imply data erasure.

Event retention/deletion behavior follows D-27; account-wide erasure is handled through the approved verified operational process.

---

# 26. Data Retention, Deletion, and Erasure

D-27 resolves the V1 Event retention/deletion policy.

## 26.1 Application retention

V1 does not automatically delete Event data on Event expiration or after a fixed application-level timer.

Data remain preserved until:

- the Owner permanently deletes an eligible Draft or Ended Event; or
- a verified operational privacy/erasure process requires removal.

## 26.2 Self-service Event deletion

The Owner may permanently delete:

- Draft Events;
- Ended Events.

Active Published Events cannot be self-service deleted.

Permanent Event deletion removes:

- Event;
- Invitations;
- current RSVPs;
- Invitation access credentials;
- Hero Image.

No V1 recycle bin or restore flow exists.

D-27 is the sole approved self-service exception to D-26's Ended read-only rule.

## 26.3 Account/data erasure

V1 does not provide a public/self-service account-deletion UI.

Account-wide privacy/data-erasure requests are handled through a verified operational process according to applicable obligations.

The operational process must verify requestor identity before destructive action and must not expose another Organizer's data.

Exact operational runbook steps belong to `14-deployment-and-operations.md`.

## 26.4 Backup aging

Deleted production data may remain temporarily in protected backups, but backup copies containing deleted records must age out within a maximum of **30 days**.

Backups must not be used to reintroduce deleted Event data into normal production except as part of an authorized disaster-recovery event, and subsequent deletion/erasure requirements must be re-applied after recovery.

---

# 27. Backup and Recovery Privacy

For backup and recovery:

- backups must be treated as containing the same private data classification as production;
- backup access must be restricted to authorized operational personnel/processes;
- production backups must not be copied into development/preview environments;
- restored backups must preserve security controls and remain non-public.

Exact backup frequency and restore procedures belong to `14-deployment-and-operations.md`; backup retention must respect D-27's 30-day maximum for deleted production data.

---

# 28. Ended Event Security

D-26 makes Ended Event records administratively read-only.

Security requirements:

- server recalculates Event runtime state for every Event-scoped mutation;
- Ended write attempts return the approved safe application error;
- RLS/read access remains Owner-scoped;
- CSV export remains Owner-only;
- Guest personalized access remains unavailable;
- no ordinary Token/access-management mutation is allowed after Ended;
- D-27 permits permanent deletion of the entire Ended Event by the Owner.

Ended does not reduce the confidentiality requirement for preserved RSVP data.

---

# 29. Authorization Failure Privacy

When an authenticated Organizer requests an Event they do not own:

- do not return Event/Invitee/RSVP content;
- use a safe `FORBIDDEN` or privacy-preserving `NOT_FOUND` contract according to route design;
- do not distinguish child-record existence across another Owner's Event.

For unauthenticated requests to Organizer routes:

- require authentication;
- do not leak whether a target Event ID exists.

---

# 30. Security Monitoring and Alerting Baseline

Before production launch, operations should be able to detect at least:

- unusual spikes in invalid Guest Token resolutions;
- repeated rate-limit events;
- repeated Organizer authorization failures;
- repeated Hero Image upload rejections;
- application/server errors in Token regeneration/decryption;
- failed CSV exports;
- database/RLS authorization errors.

Monitoring must use redacted metadata and must not record raw Tokens or RSVP free text.

Exact alert thresholds/vendor belong to `14-deployment-and-operations.md`.

---

# 31. Incident Response Baseline

If a credential/security incident occurs:

## 31.1 Invitation Token suspected leaked

Organizer may regenerate Token before Event expiration, invalidating the previous link while preserving RSVP.

## 31.2 Invitation access should be disabled

Organizer may revoke Invitation before Event expiration.

## 31.3 Server secret suspected compromised

Operational response must rotate the affected secret.

For Token encryption/HMAC keys, follow the controlled rotation plan in Sections 9 and 23.

## 31.4 Service-role key suspected compromised

Rotate the Supabase service-role credential immediately and review privileged access logs/configuration.

## 31.5 Personal-data exposure

Preserve evidence, restrict further exposure, and follow applicable organizational/legal notification obligations.

This document does not invent jurisdiction-specific legal notification timelines.

---

# 32. Security Testing Requirements

Security-sensitive behavior must be covered by automated tests in `11-testing-strategy.md`.

At minimum include:

## SEC-TEST-01 — Token isolation

One valid Token cannot retrieve another Invitation.

## SEC-TEST-02 — Token invalidation

Old regenerated Token fails immediately after successful regeneration.

## SEC-TEST-03 — Revocation

Revoked Invitation returns no private Guest data.

## SEC-TEST-04 — Draft / Ended Guest denial

Draft and Ended Events do not expose private Guest Invitation content.

## SEC-TEST-05 — Organizer ownership

Organizer A cannot read/write Organizer B's Event/Invitation/RSVP.

## SEC-TEST-06 — Service-role boundary

No client bundle/environment exposure of service-role or Token keys.

## SEC-TEST-07 — Server validation bypass

Direct crafted requests cannot bypass attendee/party/deadline/Ended rules.

## SEC-TEST-08 — XSS

Stored free-text payloads render as inert text.

## SEC-TEST-09 — Malicious upload

Disallowed media/type mismatches are rejected.

## SEC-TEST-10 — CSV formula injection

Formula-prefixed text cannot execute as spreadsheet formulas in exported CSV.

## SEC-TEST-11 — Log redaction

Representative requests/errors do not record raw Token or protected RSVP free text.

## SEC-TEST-12 — Rate limiting

Configured abuse limits return safe throttling behavior without exposing Token validity.

---

# 33. Security Decisions Proposed by This Document

These are security implementation constraints, not new Event/RSVP business rules.

### SEC-D01 — Token minimum entropy

Invitation Tokens use at least 256 bits of CSPRNG entropy.

### SEC-D02 — Token lookup uses HMAC-SHA-256

Persist deterministic keyed lookup hash rather than plaintext-only Token.

### SEC-D03 — Recoverable Token value uses AES-256-GCM

Current Token is recoverable only server-side for authorized Organizer link copying.

### SEC-D04 — Separate HMAC and encryption secrets

Lookup and encryption use different secrets.

### SEC-D05 — Referrer-Policy `no-referrer`

Personalized Invitation responses must prevent Token-bearing referrer leakage.

### SEC-D06 — No browser persistence of Invitation Token

Token is not copied into local/session storage or application cookies.

### SEC-D07 — Private raster-only Hero Images

V1 Hero Image accepts JPEG/PNG/WebP only, maximum 10 MiB, in private storage.

### SEC-D08 — CSV formula injection defense

Spreadsheet-executable user text is neutralized before CSV escaping.

### SEC-D09 — No sensitive free text in logs/analytics

Dietary Requirements, Guest Message, Attendee Names, and access credentials are excluded from logs/analytics.

### SEC-D10 — Concrete rate limits live in deployment configuration

Security categories are defined here; production numeric thresholds must be fixed before launch in Deployment/Operations.

---

# 34. Resolved Product Questions

## D-27 — Event retention and deletion

V1 uses no automatic application-level Event purge.

The Owner may permanently delete Draft or Ended Events. Active Published Events cannot be self-service deleted. Event deletion removes the approved dependent Event data and Hero Image with no V1 restore/recycle-bin flow.

Deleted production data must age out of backups within 30 days maximum.

Account-wide privacy/erasure requests are handled through a verified operational process.

## D-28 — Organizer provisioning and sign-in

V1 has no public Organizer self-sign-up.

Organizer accounts are provisioned administratively and sign in with passwordless email OTP through Supabase Auth.

Unknown emails must not auto-create accounts.

Password authentication/reset, public registration, and MFA are outside V1.

---

# 35. Cross-Document Alignment After Approval

The approved security baseline requires the following alignment:

1. `09-api-and-server-contracts.md` must include SEC-D08 formula neutralization in the executable CSV contract;
2. `11-testing-strategy.md` must include every Section 32 security regression;
3. carry concrete rate-limit thresholds and monitoring into `14-deployment-and-operations.md`;
4. keep D-27 deletion/retention behavior aligned across Product Decisions, PRD, Data Model, Admin, API, and Deployment/Operations;
5. keep D-28 Organizer provisioning/OTP behavior aligned across PRD, User Flows, Technical Architecture, Admin, API, and Deployment/Operations.

---

# 36. Traceability

| Security area | Approved source |
|---|---|
| Invitation Token is a credential | README Security Principles, FR-SEC-001 |
| Token entropy / HMAC / encryption | Technical Architecture TA-05, Data Model credential table |
| Token regeneration | D-10, FR-INV-005 |
| Revocation | D-11, FR-INV-006 |
| Organizer ownership | D-17, FR-SEC-003 |
| Ended admin read-only | D-26, FR-EVT-006 |
| Guest private access | UF-GUEST-01, Guest Experience unavailable-state rules |
| Server validation | FR-SEC-002, API contracts |
| Service-role server-only boundary | Technical Architecture Section 15 |
| Private Hero Image | TA-06, Data Model Hero Image reference |
| CSV credential exclusion | D-12, FR-CSV-003 |
| No Guest data in public metadata | Guest Experience Sections 31–32 |
| No arbitrary HTML | Guest Experience content rendering, Design System |
| RLS ownership | Technical Architecture, Data Model |
| Logging redaction | Technical Architecture token logging requirements, API contracts |
| Event retention/deletion | D-27, FR-EVT-007 |
| Organizer provisioning / OTP | D-28, FR-SEC-004 |

---

# 37. Review Checklist

Before marking this document Approved, confirm:

- Token entropy and cryptographic design are acceptable;
- HMAC and encryption keys remain separate and server-only;
- encryption-key rotation behavior is acceptable;
- HMAC rotation maintenance approach is acceptable for V1 scale;
- Guest Tokens are not stored in browser application storage;
- `Referrer-Policy: no-referrer` is acceptable for personalized routes;
- service-role use remains narrow and server-only;
- Organizer ownership is enforced both in application logic and RLS;
- generic Guest unavailable behavior preserves privacy;
- raster-only Hero Image formats and 10 MiB limit are acceptable;
- CSP/security-header requirements are acceptable;
- sensitive RSVP text is excluded from logs/analytics;
- CSV formula-neutralization requirement is acceptable;
- rate-limit thresholds remain a deployment decision but must exist before launch;
- D-27 retention/deletion behavior is reflected across affected specifications;
- D-28 provisioning/passwordless OTP behavior is reflected across affected specifications;
- no Event/RSVP business behavior was changed.

---

# 38. Next Document

After this Security and Privacy specification is reviewed and approved, create:

**`11-testing-strategy.md`**

The Testing Strategy should map product acceptance criteria and security requirements into unit, integration, database/RLS, Server Action, Guest/Admin end-to-end, concurrency, upload-security, CSV-security, and regression tests without changing approved behavior.
