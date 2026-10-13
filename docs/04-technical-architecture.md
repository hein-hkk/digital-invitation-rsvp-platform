# 04 — Technical Architecture

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document defines the V1 technical architecture that implements the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, and `03-user-flows.md`. It must not change approved business behavior.

---

## 1. Purpose

This document defines the V1 application architecture for the Digital Invitation & RSVP Platform.

It establishes:

- application boundaries;
- Next.js server/client responsibilities;
- Supabase responsibilities;
- authentication and authorization boundaries;
- personalized Invitation Token architecture;
- database-access patterns;
- server-side validation architecture;
- Hero Image storage/access architecture;
- caching and rendering rules;
- CSV export architecture;
- deployment topology;
- environment separation;
- security-sensitive technical constraints;
- proposed Architecture Decision Records (ADRs).

This document does **not** define the final database schema, exact UI component hierarchy, exact API/server-action signatures, test suite, repository file layout, or deployment runbook. Those belong to later specifications.

---

## 2. Architectural Drivers

The architecture is driven by these approved requirements:

1. Guests do not create accounts.
2. Organizer operations require authentication and Event ownership authorization.
3. Personalized Invitation Tokens are access credentials.
4. One token must never expose another Invitation.
5. Business rules must be enforced server-side.
6. Maximum Party Size is `1..20`.
7. Guest RSVP editing depends on Event state, expiration, Invitation revocation, token validity, and RSVP Deadline.
8. Regeneration invalidates the old token immediately while preserving the Invitation and RSVP.
9. Revocation blocks Guest access while preserving business data.
10. Draft Event links are inaccessible.
11. Event expiration disables personalized Guest access.
12. Guest Message is guest-authored and Organizer read-only.
13. CSV export must exclude Invitation Tokens and personalized URLs.
14. Hero Image is optional.
15. The public Guest experience is mobile-first.
16. V1 must remain smaller than a general event-management or invitation-design SaaS platform.
17. After Event expiration, Organizer Event-scoped records remain readable/exportable but Event/Invitation/RSVP/access-management mutations must be rejected.

---

## 3. Agreed Technology Stack

| Area | V1 Technology |
|---|---|
| Web framework | Next.js |
| Language | TypeScript |
| Rendering | Next.js App Router, Server Components by default |
| Styling | Tailwind CSS |
| UI motion | Motion / Framer Motion where useful |
| Database | PostgreSQL via Supabase |
| Authentication | Supabase Auth |
| Object storage | Supabase Storage |
| Backend boundary | Next.js server-side application layer + Supabase |
| Hosting | Vercel |
| Validation | Shared TypeScript schemas; Zod recommended for V1 |
| Data export | Server-generated CSV |
| Venue navigation | External map URL |
| Package manager | Deferred to `12-development-architecture.md` |

The introduction of Zod here is a technical recommendation for shared runtime validation. It does not create new product behavior. If another schema-validation library is selected later, the validation architecture in this document must still be preserved.

---

## 4. High-Level Architecture

```text
                         ┌───────────────────────┐
                         │     Guest Browser     │
                         │  personalized token   │
                         └───────────┬───────────┘
                                     │ HTTPS
                                     v
┌───────────────────┐      ┌────────────────────────────┐
│ Organizer Browser │─────>│       Next.js on Vercel   │
│ Supabase session  │ HTTPS│                            │
└───────────────────┘      │ Server Components         │
                           │ Server Actions            │
                           │ Route Handlers            │
                           │ Domain/Application Layer  │
                           └───────┬─────────┬──────────┘
                                   │         │
                    authenticated  │         │ server-only privileged
                    Supabase access│         │ operations
                                   v         v
                         ┌──────────────────────────┐
                         │        Supabase          │
                         │                          │
                         │ Auth                     │
                         │ PostgreSQL + RLS         │
                         │ Storage                  │
                         └──────────────────────────┘
```

### Core principle

The browser is never trusted to enforce business rules.

The Next.js server/application layer is the authoritative boundary for:

- Guest Token validation;
- Guest access-state evaluation;
- RSVP mutation validation;
- Organizer ownership checks in addition to database authorization;
- Token generation/regeneration;
- token decryption for Organizer link copying;
- CSV generation;
- private Hero Image access brokering.

PostgreSQL constraints and RLS provide a second enforcement layer where applicable.

---

## 5. Application Layers

V1 uses four logical application layers.

### 5.1 Presentation Layer

Responsibilities:

- Next.js pages/layouts;
- Server Components;
- minimal Client Components;
- form presentation;
- loading/error/empty UI;
- responsive Guest/Admin experiences.

The Presentation Layer must not contain authoritative business rules that are absent from the server/domain layer.

### 5.2 Application / Domain Layer

Server-only TypeScript modules implement use cases such as:

- create/update Event;
- publish Event;
- create/update Invitation;
- regenerate/revoke Invitation access;
- evaluate Guest access;
- submit/update Guest RSVP;
- edit RSVP as Organizer;
- calculate dashboard metrics;
- generate CSV export.

This layer centralizes business validation so that page/UI code does not reimplement domain rules inconsistently.

### 5.3 Persistence Layer

Responsibilities:

- Supabase/PostgreSQL queries;
- transactional database functions where required;
- authenticated row access;
- relational constraints;
- RLS policies;
- indexes.

The final table/column design belongs to `05-data-model.md`.

### 5.4 External Infrastructure Layer

Responsibilities:

- Supabase Auth;
- Supabase Storage;
- Vercel deployment/runtime;
- optional future monitoring services.

No external messaging or payment integrations exist in V1.

---

## 6. Next.js Architecture

### 6.1 App Router

V1 should use the **Next.js App Router**.

Reasons:

- Server Components support server-first data access;
- Server Actions provide a natural mutation boundary for form-driven workflows;
- route handlers support generated files such as CSV;
- layouts support separate Guest and Organizer shells.

Exact URL paths are intentionally deferred to later UI/development specifications.

### 6.2 Server Components by default

Use Server Components by default for:

- Event dashboard pages;
- Invitation lists/details;
- Guest Invitation page data loading;
- current RSVP display;
- server-authorized Hero Image URL generation.

Benefits:

- reduces credential/data exposure to browser JavaScript;
- keeps Supabase server access server-side;
- minimizes client bundle size;
- makes authorization checks occur before rendering sensitive data.

### 6.3 Client Components only when needed

Client Components should be limited to interaction that requires browser state, including:

- RSVP form interactions;
- dynamic Attendee Name fields;
- client-side form feedback;
- copy-to-clipboard interaction;
- confirmation UI;
- small animation/interactive presentation features.

A Client Component may improve UX but must not be the only enforcement layer for a business rule.

### 6.4 Server Actions

Server Actions are the preferred V1 mutation interface for first-party forms.

Candidate Server Actions include:

- save Event;
- publish Event;
- create/edit Invitation;
- regenerate token;
- revoke Invitation;
- submit/update Guest RSVP;
- Organizer RSVP edit;
- Hero Image upload authorization/removal.

Server Actions must call the server-only Application / Domain Layer rather than contain duplicated business logic.

### 6.5 Route Handlers

Use Route Handlers when an HTTP/file response is a better fit than a Server Action.

Primary V1 use:

- Event-scoped CSV download.

Additional route handlers should not be introduced solely to create a conventional REST API when no V1 consumer requires one.

`09-api-and-server-contracts.md` will finalize the server-action/route-handler contracts.

---

## 7. Supabase Responsibilities

Supabase provides:

### 7.1 Auth

- Organizer identity;
- server-readable authenticated session;
- account/user identifier used for Event ownership.

Organizer sign-in uses the approved D-28 passwordless email OTP model. Exact visual Auth-screen composition and operational provisioning tooling are defined by the later UI/development/operations specifications.

### 7.2 PostgreSQL

Stores durable business data for:

- Organizer-owned Events;
- Invitations;
- one current RSVP per Invitation;
- token metadata;
- timestamps and lifecycle metadata.

Exact schema is defined in `05-data-model.md`.

### 7.3 Row Level Security

RLS protects authenticated Organizer data.

At minimum:

- an Organizer may read/write only Events they own;
- an Organizer may access Invitations only through owned Events;
- an Organizer may access RSVPs only through owned Invitations/Events;
- direct anonymous database access to private Invitation/RSVP rows is not the Guest-access model.

### 7.4 Storage

Supabase Storage stores optional Hero Images.

Hero Images should use a **private bucket** in V1.

Read access is brokered server-side after Event/Invitation access authorization rather than exposing a permanently public object URL.

---

## 8. Authentication Architecture

### 8.1 Organizer

Organizer access uses Supabase Auth with administratively provisioned accounts and passwordless email OTP. Public self-sign-up is disabled for V1, and unknown emails must not auto-create Organizer accounts.

The Next.js server must:

1. resolve the current authenticated Supabase user;
2. reject Organizer actions when no valid session exists;
3. verify Event ownership for Event-scoped operations;
4. use RLS as an additional persistence-level enforcement layer.

### 8.1.1 Provisioning and OTP sign-in

Organizer accounts are created/provisioned through controlled administrative Supabase Auth tooling or an equivalent trusted operational workflow.

The public application must not expose a sign-up path.

The OTP sign-in integration must be configured so that an unknown email does not create a new Auth user.

The sign-in UI may use privacy-safe generic delivery/error messaging so account existence is not unnecessarily disclosed.

Password reset/recovery routes are not required because password authentication is not part of V1.


### 8.2 Guest

Guests are intentionally unauthenticated.

A personalized Invitation Token is an **access credential**, not an Organizer-authentication mechanism.

Guest access must be scoped to one Invitation only.

Guest Token possession does not grant:

- Event admin access;
- access to another Invitation;
- arbitrary database access;
- access after revocation/expiration/regeneration invalidation.

---

## 9. Authorization Model

Authorization is different for Organizer and Guest flows.

### 9.1 Organizer authorization

For every Organizer operation:

```text
Authenticated Supabase User
        |
        v
Resolve Event ownership
        |
        +--> not owner -> deny
        |
        v
Execute domain operation
        |
        v
RLS / database constraints
```

Ownership must be checked server-side even when the UI only shows owned Events.

For Event-scoped mutations, the server must additionally evaluate Event expiration. If the Event is Ended, the mutation is rejected under D-26. Read operations and Event-scoped CSV export remain permitted.

### 9.2 Guest authorization

For every personalized Guest read/write:

```text
Presented token
    |
    v
Validate current token
    |
    v
Resolve one Invitation
    |
    v
Evaluate Event Published/Ended state
    |
    v
Evaluate Invitation revocation
    |
    v
Evaluate RSVP Deadline for write permission
    |
    +--> read allowed / write denied
    |       after deadline
    |
    +--> read + write allowed
    |       before deadline
    |
    +--> no access
            invalid/revoked/Draft/Ended
```

Guest access is always derived from the validated token and may never accept an arbitrary Invitation ID from the browser as the authority boundary.

---

## 10. Personalized Invitation Token Architecture

### 10.1 Token requirements

A V1 Invitation Token should be:

- generated with a cryptographically secure random source;
- at least 256 bits of entropy;
- URL-safe encoded;
- unique for the active Invitation credential;
- treated as secret credential material.

Recommended representation:

```text
32 random bytes -> base64url string
```

The exact URL path containing the token is defined later.

### 10.2 Why raw plaintext token should not be stored directly

The Organizer must be able to copy the current Invitation link after creation, so the system needs a recoverable form of the active token.

At the same time, plaintext token storage unnecessarily increases credential exposure.

Therefore V1 should maintain two server-only token representations:

1. **lookup hash** — deterministic keyed hash used to resolve a presented token;
2. **encrypted token value** — reversible ciphertext used only to reconstruct the current link for the authorized Organizer.

### 10.3 Recommended token fields conceptually

The later data model should support the equivalent of:

```text
token_lookup_hash
token_ciphertext
token_key_version
token_created_at
revoked_at / revocation state
```

Exact column names are deferred.

### 10.4 Lookup hash

Recommended:

```text
HMAC-SHA-256(server_token_hash_key, raw_token)
```

Properties:

- deterministic for lookup;
- raw token cannot be recovered from the hash;
- server secret prevents useful precomputation;
- hash can be uniquely indexed.

### 10.5 Encrypted recoverable value

The raw token should be encrypted server-side before persistence using authenticated encryption.

Recommended implementation family:

```text
AES-256-GCM
```

The encryption key lives only in server environment secrets.

The exact envelope format, nonce storage, rotation process, and key versioning belong to `10-security-and-privacy.md`.

### 10.6 Token regeneration

Regeneration must be atomic at the business-operation level:

1. generate a new raw token;
2. compute new lookup hash;
3. encrypt new token;
4. replace current token credential data;
5. preserve Invitation identity and RSVP;
6. commit;
7. old token lookup no longer resolves as valid.

The old token must stop working immediately after successful regeneration.

### 10.7 Revocation

Revocation must not delete the Invitation or RSVP.

Guest access evaluation must reject a revoked Invitation before returning private data.

### 10.8 Token logging

Application logs must not intentionally record:

- raw Invitation Tokens;
- full personalized Invitation URLs;
- decrypted token values.

Logging/redaction rules are finalized in the security specification.

---

## 11. Guest Access Service

Create one server-only domain service responsible for Guest Invitation access.

Conceptually:

```text
resolveGuestInvitation(rawToken)
```

Responsibilities:

1. validate token shape enough to reject obviously invalid input;
2. compute token lookup hash;
3. resolve exactly one Invitation;
4. evaluate revocation;
5. load owning Event;
6. evaluate Draft/Published state;
7. evaluate Event expiration;
8. calculate RSVP read/write permission from RSVP Deadline;
9. return only the Guest-safe projection needed by the page.

The Guest page must not directly query arbitrary Invitation rows from the browser.

---

## 12. RSVP Mutation Architecture

All RSVP mutations pass through a server-only RSVP domain operation.

Conceptually:

```text
submitGuestRsvp(rawToken, input)
editOrganizerRsvp(authenticatedOrganizer, invitationId, input)
```

### 12.1 Guest RSVP mutation

The server must re-evaluate at submission time:

- token validity/currentness;
- Event Published state;
- Event not expired;
- Invitation not revoked;
- RSVP Deadline still permits Guest changes;
- Attendee Count validity;
- Maximum Party Size;
- Attendee Names count;
- Declined cleanup;
- separation of Dietary Requirements and Guest Message.

The browser's previously rendered state must never be assumed current.

### 12.2 Organizer RSVP mutation

The server must verify:

- authenticated Organizer;
- Event ownership;
- allowed Organizer-editable fields;
- Guest Message remains unchanged;
- Maximum Party Size constraint;
- Attendee Names constraint;
- Declined cleanup.

### 12.3 Transaction boundary

Any mutation that updates multiple dependent values must be atomic.

Recommended approach:

- use a PostgreSQL function/RPC or equivalent transactional persistence operation for mutations where multiple writes/invariants must commit together.

The exact RPC/function design is defined by `05-data-model.md` and `09-api-and-server-contracts.md`.

---

## 13. Event Lifecycle Architecture

### 13.1 Persisted versus derived state

V1 should distinguish:

- **publication state** — Draft or Published;
- **Ended condition** — derived from Event expiration time.

`Ended` must not require a cron job or scheduled state mutation merely to make Guest access correct.

Guest access computes expiration at request time.

### 13.2 Ended Event admin mutability

Because Ended is derived from Event expiration, V1 mutation services must evaluate mutability at execution time.

Conceptually:

```text
authorize Organizer ownership
    |
    v
load Event + calculate expiration
    |
    +--> Ended -> reject Event-scoped mutation
    |
    v
execute allowed mutation
```

The read-only rule applies to ordinary Event, Invitation, RSVP, deadline, Token-regeneration, and revocation mutations. D-27 adds one explicit exception: the Owner may permanently delete the entire Ended Event.

Dashboard reads, Invitation/RSVP reads, search/filter, and CSV export remain allowed.

### 13.3 Event expiration calculation

```text
if End Time exists:
    expiration = Event Date + End Time + Event Timezone
else:
    expiration = end of Event Date in Event Timezone
```

### 13.4 Published Event edits

Published Event edits must be validated before persistence so a successful edit cannot leave the Event with invalid required/timing data.

---

### 13.5 Event deletion architecture

Permanent Event deletion is a server-only Owner operation.

Allowed runtime states:

```text
Draft
Ended
```

Rejected runtime state:

```text
active Published
```

The operation must:

1. authenticate the Organizer;
2. verify Event ownership;
3. recalculate current Event runtime state;
4. require Draft or Ended;
5. perform database deletion using the approved cascade relationships;
6. remove the private Hero Image object when present;
7. return no deleted private data to the browser beyond the safe operation result.

Database deletion must be atomic for Event/Invitation/RSVP/access-credential rows.

Because Supabase Storage is outside the PostgreSQL transaction, the implementation must ensure a failed Hero Image object cleanup cannot make deleted Event data publicly accessible. The bucket remains private and any orphaned object must be removed through operational cleanup.

No recycle-bin or restore architecture is required in V1.


## 14. Deadline Architecture

RSVP Deadline is stored/evaluated as an Event-local date/time with the Event Timezone as the interpretation source.

For computation, convert to an absolute instant at the server boundary.

Guest RSVP write permission is evaluated on every mutation.

There is no `reopened` flag.

Reopening is derived from the current RSVP Deadline value:

- deadline moved into future -> writes permitted again if Event not expired;
- deadline removed -> writes permitted until Event expiration.

---

## 15. Database Access Patterns

### 15.1 Organizer reads

Preferred:

- server-side authenticated Supabase client;
- RLS-limited reads for owned data.

### 15.2 Organizer writes

Preferred:

- Server Action -> Domain Service -> authenticated Supabase persistence;
- ownership check in application layer;
- RLS/constraints as second line of defense.

### 15.3 Guest reads/writes

Do **not** expose broad anonymous Supabase table access.

Preferred:

- Guest Browser -> Next.js server -> token/access service -> narrowly scoped persistence query.

A server-only privileged Supabase client may be used for the narrowly scoped Guest credential lookup and RSVP operation when required.

### 15.4 Service-role key

If the Supabase service-role credential is used:

- server-only;
- never imported into Client Components;
- never exposed through `NEXT_PUBLIC_*`;
- only used inside narrow persistence modules;
- every call must be preceded/accompanied by explicit application-level authorization/validation because service-role access bypasses RLS.

---

## 16. Database Constraint Strategy

The database should enforce invariants that can be represented structurally, while the domain layer enforces cross-entity workflow rules.

Examples for database-level enforcement:

- Maximum Party Size integer range `1..20`;
- Attendee Count non-negative and integer;
- unique active token lookup hash;
- one current RSVP per Invitation;
- foreign-key ownership relationships;
- required timestamps;
- status/domain value constraints.

Examples for domain/application enforcement:

- Organizer may not edit Guest Message;
- Deadline write permission;
- Invitation access state;
- Maximum Party Size cannot be reduced below current Attendee Count;
- Declined cleanup;
- Event publication completeness.

`05-data-model.md` will decide exact constraints and where database functions are appropriate.

---

## 17. Hero Image Storage Architecture

### 17.1 Storage

Use Supabase Storage in a private bucket.

### 17.2 Organizer write flow

1. Organizer authenticates.
2. Server verifies Event ownership.
3. System authorizes upload/update/removal.
4. Image is stored under an Event-scoped object path.
5. Event stores a reference to the object, not a permanent public URL.

### 17.3 Guest read flow

1. Guest Invitation access is validated.
2. Server generates a short-lived signed read URL or otherwise brokers authorized image access.
3. Guest browser loads the authorized image.

This allows revoked/expired/Draft Events to stop receiving newly authorized image access.

Exact image limits, transformations, formats, and upload UX belong to later UI/security/operations specifications.

---

## 18. Rendering and Caching Strategy

### 18.1 Organizer pages

Organizer pages are authenticated and should not be publicly cached.

### 18.2 Guest personalized pages

Personalized Invitation pages are credential-bearing/private-by-link pages.

They must:

- be dynamically evaluated;
- not use static generation per token;
- not use shared public cache behavior for private Guest data;
- re-evaluate access state on request;
- use cache behavior equivalent to `private/no-store` for sensitive personalized responses.

### 18.3 Search indexing

Guest personalized Invitation pages should be marked `noindex, nofollow`.

This is privacy hygiene, not an authorization mechanism.

---

## 19. Validation Architecture

Use one shared server-authoritative validation model.

Recommended layers:

```text
UI constraints
    |
    v
Shared schema validation
    |
    v
Domain/business validation
    |
    v
Database constraints / transactional enforcement
```

Examples:

- UI limits Attendee Count choices;
- shared schema rejects wrong types/ranges;
- domain service evaluates deadline/ownership/access;
- database rejects structural invariant violations.

Validation error contracts are defined later in `09-api-and-server-contracts.md`.

---

## 20. CSV Export Architecture

CSV export is server-generated.

Flow:

1. authenticated Organizer requests export;
2. server verifies Event ownership;
3. server queries Event-scoped Invitation/RSVP projection;
4. server normalizes Declined/Awaiting Attendee Count to `0`;
5. server includes only approved fields;
6. server excludes token/hash/ciphertext/personalized URL/internal IDs;
7. route handler streams or returns CSV download.

CSV generation must never operate from a browser-side copy of the Invitation dataset.

Exact delimiter, quoting, encoding, filename, and locale behavior are deferred.

---

## 21. Search and Dashboard Read Architecture

### 21.1 Dashboard metrics

Metrics should be calculated server-side from current RSVP state.

For V1, either:

- aggregate SQL queries/views; or
- a dedicated database function/view

may provide:

- Total Invitations;
- Attending;
- Declined;
- Awaiting Response;
- Total Expected Attendees.

The final choice belongs to the data model based on simplicity and performance.

### 21.2 Invitation search/filter

Search is Event-scoped.

V1 requires:

- Invitee Name search;
- RSVP Status filter.

The query must be ownership-scoped server-side.

Exact case sensitivity and text-search technique are deferred.

---

## 22. Error Boundary Architecture

Errors should be classified into at least:

### 22.1 Guest access errors

Examples:

- invalid token;
- obsolete regenerated token;
- revoked Invitation;
- Draft Event;
- Ended Event.

The server must avoid revealing unnecessary private details that help distinguish or enumerate Invitations.

Exact Guest copy is deferred to `07-guest-experience-spec.md`.

### 22.2 Validation errors

Returned as field/form-safe errors without leaking server internals.

### 22.3 Authorization errors

Organizer ownership failures deny access without returning another Organizer's Event data.

### 22.4 Unexpected server errors

Log a correlation-safe error without logging raw Invitation Token secrets.

---

## 23. Deployment Topology

```text
Git Repository
      |
      v
   Vercel
┌─────────────────────┐
│ Next.js Application│
│ Server Runtime      │
└─────────┬───────────┘
          │
          v
┌─────────────────────┐
│ Supabase Project    │
│ Auth                │
│ PostgreSQL          │
│ Storage             │
└─────────────────────┘
```

Vercel hosts the Next.js application.

Supabase hosts:

- Organizer Auth;
- PostgreSQL;
- private Hero Image Storage.

Venue navigation remains an external link rather than an API integration.

---

## 24. Environment Strategy

V1 should separate production from non-production data.

Recommended environments:

### Local development

- local Next.js;
- Supabase local development stack where practical;
- local/test secrets;
- migration-driven database setup.

### Preview / staging

- Vercel Preview or staging deployment;
- non-production Supabase project/database;
- test accounts and non-production data only.

### Production

- Vercel Production;
- dedicated Production Supabase project;
- production secrets;
- production-only user/Event data.

Production and non-production must not share service-role credentials or token encryption/hash keys.

---

## 25. Environment Secrets

Expected secret categories include:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY           # server-only
INVITATION_TOKEN_HASH_KEY           # server-only
INVITATION_TOKEN_ENCRYPTION_KEY     # server-only
```

Exact variable names may be finalized in `14-deployment-and-operations.md`.

Rules:

- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed client-side.
- Invitation token cryptographic keys must never use `NEXT_PUBLIC_*`.
- secrets must not be committed to source control.
- Production secrets must differ from non-production secrets.

---

## 26. Migration Strategy

Database structure must be managed through version-controlled migrations.

Requirements:

- schema changes are reproducible;
- RLS policy changes are versioned;
- database functions/constraints are versioned;
- migrations are applied before code that depends on them;
- manual production-only schema drift is not an accepted workflow.

The exact migration tooling/process is finalized in the data-model/deployment documents.

---

## 27. Security Boundaries

### Trusted server boundary

Trusted:

- server-only Next.js modules;
- server environment secrets;
- controlled database functions;
- Supabase service-role client when narrowly used.

### Untrusted boundary

Treat as untrusted:

- browser form inputs;
- URL token input until validated;
- client-side state;
- query/string parameters;
- uploaded image metadata;
- any client-calculated RSVP values.

### Rule

Every state-changing operation must cross a server authorization + validation boundary before persistence.

---

## 28. Performance and Scale Assumptions

V1 is designed for invitation-based private Events rather than mass public ticketing.

Architecture should comfortably support:

- multiple Events per Organizer;
- tens to hundreds of Invitations per typical Event;
- multiple RSVP updates;
- read-heavy Guest access around invitation distribution;
- modest dashboard/reporting workloads.

No business rule currently specifies hard Event/Invitation volume limits.

Therefore this architecture must not invent product caps.

Indexes and query design should support the known access patterns without introducing premature distributed-system complexity.

---

## 29. Accessibility and Mobile Implications

Architecture must not prevent:

- server-rendered semantic HTML;
- keyboard-accessible forms;
- progressive enhancement;
- mobile-first Guest rendering;
- reduced-motion support where animation is used.

Exact WCAG targets and component-level accessibility requirements belong to `06-design-system-and-ui-foundation.md`.

---

## 30. Integration Boundaries

### Included V1 integrations

- Supabase Auth;
- Supabase PostgreSQL;
- Supabase Storage;
- Vercel;
- external venue/map URL.

### Explicitly not integrated in V1

- LINE messaging API;
- WhatsApp messaging API;
- SMS provider;
- email campaign provider;
- payment provider;
- ticketing platform;
- calendar provider;
- public event discovery service.

The Organizer manually shares the copied personalized Invitation URL through external communication channels.

---

## 31. Architectural Decisions Proposed by This Document

The following are technical architecture decisions, not new product rules.

### TA-01 — Use Next.js App Router

V1 uses Next.js App Router with Server Components by default.

### TA-02 — Server Actions for first-party mutations

Form-driven V1 mutations use Server Actions calling server-only domain services, unless a Route Handler is a better HTTP/file boundary.

### TA-03 — No direct anonymous table access for Guest Invitations

Guest personalized access is brokered through the Next.js server rather than broad anonymous Supabase table reads.

### TA-04 — Defense-in-depth Organizer authorization

Organizer operations use server-side ownership checks plus Supabase RLS/database constraints.

### TA-05 — Token hash + encrypted recoverable token

Invitation Tokens use a lookup HMAC plus encrypted recoverable value rather than plaintext-only persistence.

### TA-06 — Private Hero Image storage

Hero Images use private Supabase Storage with authorized server-brokered read access.

### TA-07 — Dynamic/no-store personalized Guest responses

Personalized Invitation pages are not statically generated or publicly cached.

### TA-08 — Ended is time-derived

Guest access derives Event Ended behavior from expiration rather than requiring a scheduled state-change job.

### TA-09 — Transactional critical mutations

Multi-value security/business mutations use atomic persistence operations, with PostgreSQL function/RPC where needed.

---

## 32. Proposed ADR Set

After this architecture is approved, create ADRs for the decisions most costly to reverse.

Recommended:

```text
docs/adr/
├── 001-nextjs-app-router-and-server-first-rendering.md
├── 002-supabase-auth-postgres-storage.md
├── 003-guest-access-through-nextjs-server.md
├── 004-invitation-token-storage.md
├── 005-organizer-authorization-and-rls.md
├── 006-private-hero-image-storage.md
└── 007-event-ended-derived-from-time.md
```

ADRs should record the decision, context, alternatives, and consequences without changing product requirements.

---

## 33. Traceability to Approved Requirements

| Architecture Area | Primary Source Requirements |
|---|---|
| Organizer authentication/ownership | R-ORG, FR-SEC-003 |
| Guest token access | R-GUEST, FR-INV-002, FR-SEC-001 |
| Server validation | FR-SEC-002 |
| Event lifecycle | FR-EVT-004, D-18 |
| Event timing | FR-EVT-005, D-19 |
| Party-size constraints | FR-INV-003, FR-INV-004, FR-RSVP-003 |
| Regeneration | FR-INV-005, D-10 |
| Revocation | FR-INV-006, D-11 |
| Guest RSVP | FR-RSVP-001 through FR-RSVP-008 |
| Organizer RSVP edits | FR-RSVP-009, D-22 |
| Dashboard | FR-DASH-001, FR-DASH-002 |
| CSV | FR-CSV-001 through FR-CSV-004 |
| Guest mobile presentation | FR-PRES-001, FR-PRES-002 |
| Search/filter | FR-INV-007, D-23 |
| Ended admin read-only | D-26, FR-EVT-006 |
| Event deletion | D-27, FR-EVT-007 |
| Organizer provisioning / OTP | D-28, FR-SEC-004 |

---

## 34. Technical Details Explicitly Deferred

The following are not finalized here:

- exact SQL schema and types;
- exact table names;
- exact RLS policy SQL;
- exact PostgreSQL functions;
- exact URL paths;
- exact Server Action names/signatures;
- exact Route Handler paths;
- exact Auth sign-in method/UX;
- exact Zod schemas;
- exact token ciphertext envelope;
- exact key-rotation procedure;
- exact Hero Image size/format limits;
- exact CSV encoding/filename;
- exact logging/monitoring vendor;
- exact CI/CD workflow;
- exact test framework;
- exact repository folder structure.

These belong to later source-of-truth documents.

---

## 35. Review Checklist

Before marking this document Approved, confirm:

- Next.js + TypeScript + Tailwind + Supabase + Vercel remain the chosen stack;
- Guest access is server-brokered rather than direct anonymous table access;
- Organizer access uses Supabase Auth and ownership authorization;
- RLS remains a defense-in-depth boundary;
- raw Invitation Tokens are not persisted as plaintext-only credentials;
- current Invitation link can still be reconstructed for authorized Organizer copying;
- regeneration invalidates the previous token immediately;
- revocation preserves business data;
- personalized Guest pages are dynamic/private and not statically cached;
- RSVP rules are revalidated server-side on every mutation;
- Hero Images are not permanently public by default;
- Event Ended behavior requires no cron job for correctness;
- no new product business rule was introduced.

---

## 36. Next Document

After this Technical Architecture is reviewed and approved, create:

**`05-data-model.md`**

The Data Model should turn these approved architecture boundaries into concrete PostgreSQL entities, relationships, constraints, indexes, RLS ownership relationships, token fields, lifecycle fields, and deletion behavior without changing approved product rules.
