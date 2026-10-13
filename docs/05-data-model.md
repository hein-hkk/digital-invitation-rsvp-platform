# 05 — Data Model

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document turns the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, `03-user-flows.md`, and `04-technical-architecture.md` into the concrete V1 PostgreSQL data model. It must not introduce new product behavior.

---

## 1. Purpose

This document defines the V1 persistent data model for PostgreSQL via Supabase.

It specifies:

- entities and tables;
- primary and foreign keys;
- canonical identifiers;
- field types;
- relationships;
- database constraints;
- ownership relationships;
- Row Level Security boundaries;
- Invitation Token credential storage fields;
- Event lifecycle representation;
- RSVP representation;
- indexes;
- transactional invariants;
- reporting projections;
- deletion behavior;
- migration expectations.

This document intentionally does not define final API/server-action signatures, UI component structure, exact authentication UX, or full security operations such as cryptographic key rotation. Those belong to later documents.

---

## 2. Modeling Principles

The V1 schema follows these principles:

1. **Canonical product terms become canonical data terms.**
2. **One Organizer may own multiple Events.**
3. **One Event contains multiple Invitations.**
4. **One Invitation has exactly one current RSVP row.**
5. **One Invitation has exactly one current access credential row.**
6. **Attendee Count is authoritative for attendance totals.**
7. **Attendee Names are optional metadata, not separate identity records.**
8. **Guest access secrets are isolated from ordinary Invitation data.**
9. **Ended is derived from time; it is not a persisted Event state.**
10. **Cross-table business invariants must be enforced transactionally.**
11. **Organizer ownership is represented directly through the Event.**
12. **No V1 hard-delete user flow is invented by the database model.**
13. **Ended Event rows remain persisted and ordinary Event-scoped operational mutations are rejected, except the Owner may permanently delete the entire Ended Event under D-27.**

---

## 3. Entity Relationship Overview

```text
Supabase auth.users
        |
        | 1
        |
        | owns
        v
      events
        |
        | 1
        |
        | has many
        v
   invitations
      /     \
     /       \
    1         1
   /           \
  v             v
rsvps    invitation_access_credentials
```

Conceptually:

```text
Organizer (auth.users)
  └── Event
       └── Invitation
            ├── RSVP
            └── Invitation Access Credential
```

There is no separate V1 `organizers` table because no Organizer profile fields are currently specified. Supabase Auth is the identity source, and `events.owner_user_id` establishes ownership.

---

## 4. Identifier Strategy

### 4.1 Internal identifiers

Use UUID primary keys for product entities.

Recommended generation:

```sql
gen_random_uuid()
```

Internal UUIDs are not Guest access credentials.

They must not be used as substitutes for Invitation Tokens.

### 4.2 Guest access identifier

The Guest receives only the personalized Invitation Token in the public access URL.

The Token is cryptographically random and is resolved through its server-only lookup hash.

### 4.3 IDs and CSV

Internal UUIDs are not exported in the default V1 CSV.

---

## 5. PostgreSQL Types

V1 should define these database enum/domain values.

### 5.1 Event publication status

```text
draft
published
```

`ended` is **not** stored in this enum because Ended is derived from Event expiration.

### 5.2 RSVP status

```text
awaiting_response
attending
declined
```

These map to the product terms:

- Awaiting Response
- Attending
- Declined

### 5.3 Event type

V1 accepts only:

```text
wedding
```

The column remains a domain concept so later migrations may add future approved Event types.

A database CHECK constraint is preferred over prematurely modeling unrelated future values.

---

# 6. Table: `events`

## 6.1 Purpose

Stores Organizer-owned Event configuration and publication state.

Draft Events may be incomplete. Published Events must satisfy publication completeness constraints.

## 6.2 Columns

| Column | PostgreSQL type | Null? | Purpose |
|---|---|---:|---|
| `id` | `uuid` | No | Internal Event identifier; primary key |
| `owner_user_id` | `uuid` | No | Supabase Auth user who owns the Event |
| `publication_status` | enum/text domain | No | `draft` or `published`; default `draft` |
| `event_type` | `text` | Yes in Draft | V1 value `wedding` |
| `event_title` | `text` | Yes in Draft | Organizer-defined Event title |
| `host_display_names` | `text[]` | No | Wedding / Host Display Names; default empty array |
| `event_date` | `date` | Yes in Draft | Local Event calendar date |
| `start_time` | `time without time zone` | Yes in Draft | Local Event start time |
| `end_time` | `time without time zone` | Yes | Optional local End Time on Event Date |
| `event_timezone` | `text` | Yes in Draft | IANA timezone identifier |
| `rsvp_deadline_local` | `timestamp without time zone` | Yes | Optional deadline interpreted in Event Timezone |
| `venue_name` | `text` | Yes in Draft | Venue display name |
| `venue_address` | `text` | Yes in Draft | Venue address |
| `venue_map_url` | `text` | Yes | Optional external map URL |
| `dress_code` | `text` | Yes | Optional free-text dress code |
| `invitation_message` | `text` | Yes | Optional Event Description / Invitation Message |
| `venue_arrival_notes` | `text` | Yes | Optional venue / arrival notes |
| `hero_image_storage_path` | `text` | Yes | Optional Supabase Storage object path |
| `organizer_contact_information` | `text` | Yes | Optional display contact information |
| `published_at` | `timestamptz` | Yes | Set when Event becomes Published |
| `created_at` | `timestamptz` | No | Record creation time |
| `updated_at` | `timestamptz` | No | Last Event record update |

No text-length product limits are defined here because the approved sources intentionally defer exact input limits.

## 6.3 Primary / foreign keys

```text
PRIMARY KEY (id)

owner_user_id
  REFERENCES auth.users(id)
  ON DELETE RESTRICT
```

`ON DELETE RESTRICT` is deliberate: V1 does not define Organizer-account deletion behavior that should silently cascade through Events.

## 6.4 Event timing constraints

When the relevant values are present:

```text
end_time > start_time
```

and:

```text
rsvp_deadline_local < event_date + start_time
```

The comparison is valid as a local-time relationship because both values use the same Event Timezone interpretation.

Timezone-string validity is enforced by the server/domain layer against an accepted IANA timezone set.

## 6.5 Publication completeness constraint

A Draft may have null/empty publication fields.

A Published Event must contain valid values for:

- Event Type;
- Event Title;
- at least one Host Display Name;
- Event Date;
- Start Time;
- Event Timezone;
- Venue Name;
- Venue Address;
- `published_at`.

Conceptually:

```text
publication_status = 'draft'
OR
(
  event_type is present
  AND event_title is present
  AND host_display_names is not empty
  AND event_date is present
  AND start_time is present
  AND event_timezone is present
  AND venue_name is present
  AND venue_address is present
  AND published_at is present
)
```

The database constraint is defense in depth. The application/domain publication operation must perform the same validation and return usable field errors.

## 6.6 Event expiration derivation

Expiration is not stored as mutable state.

Conceptual calculation:

```text
if end_time exists:
    expiration_at =
      (event_date + end_time) interpreted in event_timezone
else:
    expiration_at =
      start of the calendar day after event_date
      interpreted in event_timezone
```

The runtime state is then:

```text
publication_status = draft
    -> Draft

publication_status = published
AND now < expiration_at
    -> Published

publication_status = published
AND now >= expiration_at
    -> Ended
```

This preserves the approved `Draft -> Published -> Ended` behavior without a cron-driven state mutation.

---

# 7. Table: `invitations`

## 7.1 Purpose

Stores one personalized Invitation belonging to one Event.

An Invitation represents an individual, couple, family, household, or group.

## 7.2 Columns

| Column | PostgreSQL type | Null? | Purpose |
|---|---|---:|---|
| `id` | `uuid` | No | Internal Invitation identifier; primary key |
| `event_id` | `uuid` | No | Parent Event |
| `invitee_name` | `text` | No | Invitee / household / group display name |
| `maximum_party_size` | `smallint` | No | Allowed party size, integer `1..20` |
| `revoked_at` | `timestamptz` | Yes | Non-null means Guest access is revoked |
| `created_at` | `timestamptz` | No | Invitation creation time |
| `updated_at` | `timestamptz` | No | Last ordinary Invitation update |

## 7.3 Keys

```text
PRIMARY KEY (id)

event_id
  REFERENCES events(id)
  ON DELETE CASCADE
```

D-27 defines permanent deletion of Draft or Ended Events. Invitations therefore cascade-delete with the parent Event only through the authorized Event-deletion operation.

## 7.4 Constraints

### Invitee Name

`invitee_name` must be non-null and non-blank when an Invitation is created.

### Maximum Party Size

```text
1 <= maximum_party_size <= 20
```

It must be an integer.

The cross-table rule:

```text
maximum_party_size >= current RSVP attendee_count
```

cannot be represented as a simple row CHECK and is enforced through the transactional write strategy in Section 14.

## 7.5 Revocation representation

Revocation uses:

```text
revoked_at IS NULL     -> not revoked
revoked_at IS NOT NULL -> revoked
```

Revocation preserves:

- Invitation row;
- RSVP row;
- access credential row;
- attendance data.

No `restored_at` or restore state is added because V1 does not define a restore-revoked workflow.

---

# 8. Table: `invitation_access_credentials`

## 8.1 Purpose

Separates secret Guest-access material from ordinary Invitation business data.

This table is not an alternate domain entity. It is a security boundary for the Invitation Token.

## 8.2 Columns

| Column | PostgreSQL type | Null? | Purpose |
|---|---|---:|---|
| `invitation_id` | `uuid` | No | One-to-one parent Invitation; primary key |
| `token_lookup_hash` | `bytea` | No | HMAC-SHA-256 lookup hash |
| `token_ciphertext` | `text` | No | Opaque authenticated-encryption envelope |
| `token_key_version` | `smallint` | No | Encryption-key version identifier |
| `token_created_at` | `timestamptz` | No | Time current Token was generated |

## 8.3 Keys / constraints

```text
PRIMARY KEY (invitation_id)

FOREIGN KEY (invitation_id)
  REFERENCES invitations(id)
  ON DELETE CASCADE

UNIQUE (token_lookup_hash)
```

Recommended integrity check:

```text
octet_length(token_lookup_hash) = 32
```

because HMAC-SHA-256 produces 32 bytes.

`token_key_version` must be a positive integer.

## 8.4 Why this is a separate table

Ordinary Organizer Invitation queries do not need:

- lookup hashes;
- ciphertext;
- key versions.

Separating these values:

- reduces accidental exposure;
- keeps CSV/reporting projections away from credentials;
- supports service-role-only access for Token operations;
- makes security review clearer.

## 8.5 Regeneration

Token regeneration **updates the single current credential row** for the same Invitation.

No token-history table is required in V1.

Once the credential update commits:

- old lookup hash no longer resolves;
- new lookup hash becomes current;
- Invitation identity is unchanged;
- RSVP is unchanged.

---

# 9. Table: `rsvps`

## 9.1 Purpose

Stores the one current RSVP associated with an Invitation.

V1 creates one RSVP row when the Invitation is created so the initial state is explicitly `awaiting_response`.

## 9.2 Relationship

```text
Invitation 1 -> 1 RSVP
```

The Invitation's UUID is also the RSVP primary key.

## 9.3 Columns

| Column | PostgreSQL type | Null? | Purpose |
|---|---|---:|---|
| `invitation_id` | `uuid` | No | Primary key and parent Invitation |
| `status` | RSVP status enum/domain | No | Default `awaiting_response` |
| `attendee_count` | `smallint` | No | Current expected attendance for this Invitation |
| `attendee_names` | `text[]` | No | Optional names; default empty array |
| `dietary_requirements` | `text` | Yes | Optional RSVP-level catering text |
| `guest_message` | `text` | Yes | Optional Guest-authored message |
| `responded_at` | `timestamptz` | Yes | First time RSVP becomes Attending or Declined |
| `response_updated_at` | `timestamptz` | Yes | Last RSVP-content change after response |
| `created_at` | `timestamptz` | No | Internal RSVP row creation time |

## 9.4 Keys

```text
PRIMARY KEY (invitation_id)

invitation_id
  REFERENCES invitations(id)
  ON DELETE CASCADE
```

This primary-key shape guarantees one current RSVP row per Invitation.

## 9.5 RSVP status constraints

### Attending

If:

```text
status = attending
```

then:

```text
1 <= attendee_count <= 20
```

The stricter cross-table check:

```text
attendee_count <= invitations.maximum_party_size
```

is enforced transactionally.

### Awaiting Response or Declined

If status is not Attending:

```text
attendee_count = 0
```

### Attendee Names

```text
cardinality(attendee_names) <= attendee_count
```

Therefore:

- 0 through Attendee Count names are valid while Attending;
- names are automatically empty when Attendee Count is 0;
- duplicate names remain allowed.

### Declined cleanup

If:

```text
status = declined
```

then:

```text
attendee_count = 0
attendee_names = {}
dietary_requirements IS NULL
```

`guest_message` is not cleared by this constraint.

## 9.6 RSVP timestamps

### Initial state

On Invitation creation:

```text
status = awaiting_response
responded_at = NULL
response_updated_at = NULL
```

### First response

On the first successful transition to Attending or Declined:

```text
responded_at = now
response_updated_at = now
```

### Later RSVP changes

```text
responded_at = unchanged
response_updated_at = now
```

This maps directly to CSV:

```text
Responded At -> responded_at
Updated At   -> response_updated_at
```

The approved V1 flows do not define a user operation that resets a previously responded RSVP back to Awaiting Response. This data model does not invent reset-timestamp semantics.

---

# 10. Why There Is No Separate `attendees` Table

V1 does not require individually identified Attendee entities.

Approved behavior says:

- Attendee Count is authoritative;
- Attendee Names are optional;
- names may be fewer than Attendee Count;
- names need not be unique;
- no adult/child/infant categories exist;
- Dietary Requirements belong to the RSVP as a whole.

Therefore V1 stores:

```text
rsvps.attendee_count
rsvps.attendee_names[]
```

instead of creating one database row per person.

A future product requirement for per-Attendee dietary information, attendee categories, tickets, seating, or individual identity would justify a new Attendee table through a later migration/specification.

---

# 11. Why There Is No Separate `organizers` Table

Supabase Auth already owns authenticated user identity.

No V1 product requirement defines Organizer profile fields independent of Auth.

Therefore:

```text
events.owner_user_id -> auth.users.id
```

is sufficient.

A future profile or organization model may introduce a separate application-user/Organizer table through a later specification.

---

# 12. Ended Event Mutation Guard

D-26 does not require a new persisted Event status because Ended remains derived from Event expiration.

Every controlled Event-scoped mutation must load the owning Event and evaluate its expiration before committing a write.

If the Event is Ended, reject mutations to:

- Event fields / RSVP Deadline;
- Invitations / Maximum Party Size;
- RSVPs;
- Invitation access credentials through regeneration/revocation.

Read queries and CSV export remain allowed.

This guard is part of the domain/transactional write path and must not rely only on UI-disabled controls.

---

# 13. Event Publication Operation

Publishing an Event should be an atomic domain/database operation.

Conceptually:

```text
publish_event(event_id, organizer_user_id)
```

must:

1. verify the authenticated Organizer owns the Event;
2. lock/read the Event;
3. confirm Event is Draft;
4. verify all required publication fields;
5. verify timing constraints;
6. set `publication_status = published`;
7. set `published_at`;
8. update `updated_at`;
9. commit.

Database publication-completeness constraints prevent an invalid Published row even if application validation is bypassed.

There is no V1 operation that sets Published back to Draft.

---

# 14. Invitation Creation Operation

Invitation creation should atomically create:

1. `invitations` row;
2. `invitation_access_credentials` row;
3. initial `rsvps` row with Awaiting Response.

Conceptually:

```text
create Invitation transaction
    |
    +-- invitations
    |
    +-- invitation_access_credentials
    |
    +-- rsvps(status = awaiting_response)
```

If any step fails, none of the three rows should remain partially created.

The raw Invitation Token is generated/encrypted in the trusted server boundary before/within the controlled persistence operation as defined by the approved Technical Architecture.

---

# 15. Cross-Table Transactional Invariants

Some approved rules span more than one row/table and require locking or equivalent transactional enforcement.

## 14.1 RSVP change

A Guest/Organizer RSVP mutation must prevent races with Maximum Party Size edits.

Recommended transactional sequence:

```text
BEGIN
  lock Invitation row
  read current maximum_party_size
  validate RSVP access/authorization in server layer
  validate attendee_count <= maximum_party_size
  update RSVP current state
COMMIT
```

For Declined, the same update sets:

- attendee_count = 0;
- attendee_names = empty;
- dietary_requirements = null;
- guest_message preserved.

## 14.2 Maximum Party Size change

Recommended:

```text
BEGIN
  lock Invitation row
  lock/read RSVP row
  validate new size in 1..20
  validate new size >= current attendee_count
  update Invitation
COMMIT
```

This prevents a Guest RSVP and Organizer size reduction from creating an invalid committed combination.

## 14.3 Token regeneration

Recommended:

```text
BEGIN
  verify Organizer ownership
  lock Invitation / credential row
  replace lookup hash
  replace ciphertext
  update key version if needed
  set token_created_at
COMMIT
```

The credential replacement must be atomic so there is one current Token.

---

# 16. Row Level Security and Ownership

RLS is enabled on application tables.

Guest access is **not** implemented through broad anonymous RLS policies. Guest requests go through the trusted Next.js server/token-access service.

## 15.1 `events`

Authenticated Organizer policies are ownership-based:

```text
owner_user_id = auth.uid()
```

Organizer may only select/update Events they own.

Insert must force/validate:

```text
owner_user_id = auth.uid()
```

No V1 delete policy is required because no Event deletion flow is approved.

## 15.2 `invitations`

Organizer access requires ownership through the Event:

```text
EXISTS (
  SELECT 1
  FROM events
  WHERE events.id = invitations.event_id
    AND events.owner_user_id = auth.uid()
)
```

## 15.3 `rsvps`

Organizer access requires:

```text
RSVP -> Invitation -> Event -> owner_user_id = auth.uid()
```

## 15.4 `invitation_access_credentials`

Enable RLS with no ordinary anonymous/authenticated read policy.

Access is through narrow server-only persistence code using the trusted service-role boundary after explicit authorization.

An Organizer who is allowed to copy a link receives the reconstructed URL from server logic, not raw credential-table access from the browser.

---

# 17. Indexes

Required/recommended V1 indexes:

## 16.1 `events`

```text
PRIMARY KEY (id)
INDEX (owner_user_id)
INDEX (owner_user_id, publication_status)
```

## 16.2 `invitations`

```text
PRIMARY KEY (id)
INDEX (event_id)
INDEX (event_id, created_at)
```

For Invitee Name search, begin with a case-normalized expression index if the selected search semantics benefit from it:

```text
INDEX (event_id, lower(invitee_name))
```

If `09-api-and-server-contracts.md` later specifies arbitrary substring search, a `pg_trgm` index may be added. This document does not invent the matching algorithm.

## 16.3 `invitation_access_credentials`

```text
PRIMARY KEY (invitation_id)
UNIQUE INDEX (token_lookup_hash)
```

The Token lookup index is security-sensitive and used only by server-side Guest access resolution.

## 16.4 `rsvps`

```text
PRIMARY KEY (invitation_id)
INDEX (status)
```

Dashboard queries that prove to require additional composite indexes may add them through measured query plans without changing product behavior.

---

# 18. Reporting / Query Projections

V1 may use SQL views or server-side queries for read projections.

The underlying tables remain the source of persisted truth.

## 17.1 Invitation admin projection

A logical Organizer projection should combine:

```text
Invitation
+ current RSVP
+ Event ownership scope
```

to provide:

- Invitee Name;
- Maximum Party Size;
- RSVP Status;
- Attendee Count;
- Attendee Names;
- Dietary Requirements;
- Guest Message;
- Responded At;
- Updated At;
- revocation state.

Token secrets must not appear in this projection.

## 17.2 Dashboard metrics projection

Logical metrics:

```text
Total Invitations
COUNT(invitations)

Attending Invitations
COUNT(rsvps WHERE status = attending)

Declined Invitations
COUNT(rsvps WHERE status = declined)

Awaiting Response Invitations
COUNT(rsvps WHERE status = awaiting_response)

Total Expected Attendees
SUM(attendee_count WHERE status = attending)
```

Because non-Attending RSVP rows require Attendee Count `0`, a guarded SUM remains straightforward.

## 17.3 Runtime Event state projection

A server query/function may expose:

```text
draft
published
ended
```

where `ended` is derived from Event expiration.

This is a projection, not a third persisted `publication_status` value.

---

# 19. CSV Data Mapping

The V1 CSV fields map to persisted data as follows:

| CSV column | Data source |
|---|---|
| Invitee Name | `invitations.invitee_name` |
| RSVP Status | `rsvps.status` mapped to display text |
| Maximum Party Size | `invitations.maximum_party_size` |
| Attendee Count | `rsvps.attendee_count` |
| Attendee Names | `rsvps.attendee_names` serialized into one cell |
| Dietary Requirements | `rsvps.dietary_requirements` |
| Guest Message | `rsvps.guest_message` |
| Responded At | `rsvps.responded_at` |
| Updated At | `rsvps.response_updated_at` |

The export query must not include:

- `events.id`;
- `invitations.id`;
- `rsvps.invitation_id`;
- `token_lookup_hash`;
- `token_ciphertext`;
- `token_key_version`;
- personalized Invitation URL.

Exact array serialization and CSV quoting are deferred to the API/server-contract specification.

---

# 20. Hero Image Data Representation

`events.hero_image_storage_path` stores a private Supabase Storage object reference.

It must not store a permanent public URL.

Example conceptual value:

```text
events/{event_uuid}/hero/{object_name}
```

The exact path convention is a technical naming detail finalized later.

Guest access receives a short-lived authorized/signed URL generated after Guest Invitation access validation.

---

# 21. Timestamp Conventions

Persist absolute technical/audit timestamps as:

```text
timestamptz
```

Examples:

- `created_at`;
- `updated_at`;
- `published_at`;
- `revoked_at`;
- `token_created_at`;
- `responded_at`;
- `response_updated_at`.

Persist Event-local display/scheduling fields separately:

- `event_date` as `date`;
- `start_time` / `end_time` as local `time`;
- `rsvp_deadline_local` as local `timestamp`;
- `event_timezone` as IANA timezone text.

This prevents Event presentation from depending on the server's timezone.

---

# 22. Update-Timestamp Strategy

`events.updated_at` and `invitations.updated_at` should be maintained consistently through controlled write paths, preferably with a shared database trigger or equivalent persistence helper.

RSVP uses explicit product timestamps:

- `responded_at`;
- `response_updated_at`.

`response_updated_at` should change only when current RSVP content changes, not because an unrelated Invitation/Event field changed.

---

# 23. Deletion and Retention Behavior

D-27 defines one self-service permanent deletion operation: delete the entire owned Event when its runtime state is Draft or Ended.

Active Published Events cannot be self-service deleted.

Database behavior:

```text
events
  ON DELETE CASCADE -> invitations
      ON DELETE CASCADE -> rsvps
      ON DELETE CASCADE -> invitation_access_credentials
```

`events.owner_user_id -> auth.users.id` remains `ON DELETE RESTRICT`.

The controlled Event-deletion domain operation must verify:

- authenticated Organizer;
- Event ownership;
- Event runtime state is Draft or Ended.

The private Hero Image object is removed by the application/storage cleanup portion of the same logical operation.

No individual Invitation-delete or RSVP-delete product action is introduced.

No recycle bin / soft-delete restore model is introduced.

Event expiration by itself does not delete data.

Account-wide privacy/erasure requests are handled through a verified operational process; they are not modeled as an ordinary V1 self-service Auth-user cascade.

Deleted production data must age out of backups within 30 days maximum, with exact backup mechanics defined in `14-deployment-and-operations.md`.

---

# 24. Credential and Sensitive-Data Boundaries

The following must be treated as security-sensitive database content:

- `token_lookup_hash`;
- `token_ciphertext`;
- `token_key_version`;
- Guest Message;
- Dietary Requirements;
- Invitee Name;
- Attendee Names;
- Organizer Contact Information.

The credential table receives the strictest access boundary.

The privacy/security specification will define:

- logging rules;
- retention expectations;
- data-erasure requirements if any;
- operational access;
- key rotation.

---

# 25. Database Invariants Summary

The final database must guarantee or participate in guaranteeing these invariants:

1. Event belongs to one Organizer.
2. Invitation belongs to one Event.
3. RSVP belongs to one Invitation.
4. One current RSVP row exists per Invitation.
5. One current credential row exists per Invitation.
6. Maximum Party Size is integer `1..20`.
7. Attending Attendee Count is at least `1`.
8. Non-Attending Attendee Count is `0`.
9. Attendee Names count never exceeds Attendee Count.
10. Declined has no Attendee Names.
11. Declined has no Dietary Requirements.
12. Guest Message is not deleted by Declined cleanup.
13. RSVP Attendee Count cannot exceed current Maximum Party Size.
14. Maximum Party Size cannot be reduced below current Attendee Count.
15. Token lookup hash is unique.
16. Published Event contains all required publication fields.
17. RSVP Deadline is before Event Start when both are present.
18. End Time is later than Start Time when both are present.
19. Ended is derived rather than persisted.
20. Revocation preserves Invitation/RSVP rows.
21. Ended Events reject ordinary Event-scoped operational mutations while preserving read/export access.
22. Draft and Ended Events may be permanently deleted by the Owner, cascading dependent database rows.

Where a rule crosses tables or requires current-time/authorization context, the transactional domain write path is part of the enforcement strategy.

---

# 26. Conceptual SQL Skeleton

This is illustrative of the approved shape; migrations remain the executable source for exact SQL after this document is approved.

```sql
create type event_publication_status as enum ('draft', 'published');
create type rsvp_status as enum ('awaiting_response', 'attending', 'declined');

create table events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  publication_status event_publication_status not null default 'draft',
  event_type text,
  event_title text,
  host_display_names text[] not null default '{}',
  event_date date,
  start_time time,
  end_time time,
  event_timezone text,
  rsvp_deadline_local timestamp,
  venue_name text,
  venue_address text,
  venue_map_url text,
  dress_code text,
  invitation_message text,
  venue_arrival_notes text,
  hero_image_storage_path text,
  organizer_contact_information text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  invitee_name text not null,
  maximum_party_size smallint not null check (maximum_party_size between 1 and 20),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table invitation_access_credentials (
  invitation_id uuid primary key references invitations(id) on delete cascade,
  token_lookup_hash bytea not null unique,
  token_ciphertext text not null,
  token_key_version smallint not null check (token_key_version > 0),
  token_created_at timestamptz not null default now(),
  check (octet_length(token_lookup_hash) = 32)
);

create table rsvps (
  invitation_id uuid primary key references invitations(id) on delete cascade,
  status rsvp_status not null default 'awaiting_response',
  attendee_count smallint not null default 0,
  attendee_names text[] not null default '{}',
  dietary_requirements text,
  guest_message text,
  responded_at timestamptz,
  response_updated_at timestamptz,
  created_at timestamptz not null default now(),

  check (
    (status = 'attending' and attendee_count between 1 and 20)
    or
    (status <> 'attending' and attendee_count = 0)
  ),

  check (cardinality(attendee_names) <= attendee_count),

  check (
    status <> 'declined'
    or dietary_requirements is null
  ),

  check (
    responded_at is null
    or response_updated_at is null
    or response_updated_at >= responded_at
  )
);
```

The executable migration must additionally implement:

- Published Event completeness;
- local Event timing constraints;
- nonblank required text validation where appropriate;
- RLS;
- indexes;
- timestamp maintenance;
- controlled transactional functions for cross-table invariants.

---

# 27. Migration Order

Recommended schema migration dependency order:

```text
1. extensions / required DB capabilities
2. enum/domain types
3. events
4. invitations
5. invitation_access_credentials
6. rsvps
7. indexes
8. helper functions
9. transactional mutation functions
10. RLS policies
11. reporting views/functions
```

Seed data must not be required for production correctness.

---

# 28. Traceability

| Data-model area | Approved source |
|---|---|
| Event ownership | D-17, R-ORG, FR-SEC-003 |
| Event required fields | D-13, FR-EVT-002 |
| Event optional fields | D-14, FR-EVT-003 |
| Draft/Published/Ended | D-18, FR-EVT-004 |
| Event timing | D-19, FR-EVT-005 |
| Invitation identity | Product Concept, FR-INV-001 |
| Maximum Party Size | D-01, D-25, FR-INV-003, FR-INV-004 |
| Token credentials | D-10, D-11, FR-INV-002, FR-INV-005, FR-SEC-001, TA-05 |
| One current RSVP | D-05, FR-RSVP-001 |
| Attendee Count | D-06, FR-RSVP-003 |
| Attendee Names | D-06, D-20, FR-RSVP-004 |
| Dietary Requirements | D-08, FR-RSVP-005 |
| Declined cleanup | D-21, FR-RSVP-006 |
| Guest Message ownership | D-22, FR-RSVP-009 |
| Dashboard metrics | FR-DASH-001, FR-DASH-002 |
| CSV fields/exclusions | D-12, FR-CSV-001 through FR-CSV-004 |
| RLS/server Guest access | FR-SEC-001 through FR-SEC-003, TA-03, TA-04 |
| Hero Image | D-14, TA-06 |
| No product delete flow | Absence from approved PRD/User Flows; preservation requirements D-09/D-11 |
| Ended admin read-only | D-26, FR-EVT-006 |
| Event deletion | D-27, FR-EVT-007 |
| Organizer provisioning/auth | D-28, FR-SEC-004; no additional Organizer table required |

---

# 29. Intentionally Deferred Data Details

This document does not invent:

- Event or Invitation deletion product behavior;
- restore-revoked behavior;
- RSVP revision-history tables;
- per-Attendee records;
- attendee categories;
- Organizer profile fields;
- team membership tables;
- exact input character limits;
- exact Invitee search matching algorithm;
- exact token encryption envelope;
- cryptographic key rotation;
- file metadata/media tables beyond the single Hero Image reference;
- generalized multi-theme schema;
- event duplication tables or lineage.

If a later requirement needs one of these, update the appropriate higher-precedence specification first.

---

# 30. Review Checklist

Before marking this Data Model Approved, confirm:

- `events.owner_user_id` uses Supabase Auth as the Owner relationship;
- Draft Event fields may be incomplete;
- Published Events cannot violate required-field/timing rules;
- Ended remains derived from expiration;
- Invitations use UUIDs internally but Tokens for Guest access;
- Maximum Party Size is `1..20`;
- credential data is isolated from ordinary Invitation data;
- one current credential exists per Invitation;
- one current RSVP row exists per Invitation;
- initial RSVP state is Awaiting Response;
- Attendee Count, not name count, remains the attendance authority;
- no separate Attendee table is introduced in V1;
- Declined cleanup preserves Guest Message;
- RSVP/party-size cross-table invariants are race-safe;
- Organizer ownership is protected by RLS;
- anonymous Guests do not receive broad direct table access;
- CSV projections cannot expose credential fields;
- core deletes are restricted because no V1 delete flow is approved;
- no new product business rule was introduced.

---

# 31. Next Document

After this Data Model is reviewed and approved, create:

**`06-design-system-and-ui-foundation.md`**

That document should define responsive strategy, typography, spacing, color/token foundations, components, accessibility, forms, loading/empty/error states, and animation principles while preserving the one curated wedding theme and the approved Guest/Admin behavior.
