# 09 — API and Server Contracts

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document defines V1 server contracts for the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, `03-user-flows.md`, `04-technical-architecture.md`, `05-data-model.md`, `06-design-system-and-ui-foundation.md`, `07-guest-experience-spec.md`, and `08-admin-dashboard-spec.md`. It must not introduce new business behavior.

---

## 1. Purpose

This document defines the exact V1 server-side application contracts used by the first-party Next.js application.

It specifies:

- Server Actions;
- Route Handlers;
- request/input shapes;
- response/result shapes;
- authentication requirements;
- Organizer ownership authorization;
- Guest Invitation Token authorization;
- Event-state and Ended-event mutation guards;
- validation;
- transactional behavior;
- concurrency expectations;
- structured error codes;
- CSV response behavior;
- Hero Image server contracts;
- search/filter query contracts;
- mutation idempotency expectations.

This document does not define the final repository structure, test implementation, logging vendor, cryptographic key-rotation procedure, or deployment runbook.

---

## 2. Server Contract Principles

### API-P01 — First-party server boundary

V1 is a first-party Next.js application.

Use:

- **Server Actions** for ordinary form-driven mutations;
- **Route Handlers** for file/binary HTTP responses and server endpoints that are better expressed as HTTP resources.

Do not create a parallel public REST API solely for architectural style.

### API-P02 — Server authorization is mandatory

Every Organizer mutation must independently verify:

1. authenticated Supabase user;
2. ownership of the target Event;
3. Event mutability when the operation changes Event-scoped data.

Every Guest mutation must independently verify the presented current Invitation Token and Guest write permission.

### API-P03 — Server validation is authoritative

Client validation is UX only.

All business rules are re-evaluated using current persisted state at mutation time.

### API-P04 — Error results are structured

Expected validation/authorization/state errors return stable application error codes.

Do not expose raw database, Supabase service-role, cryptographic, or stack-trace details to the UI.

### API-P05 — Mutations are transactional where invariants span rows

Cross-table invariants use controlled transactional persistence operations as defined by the Data Model.

---

# 3. Contract Result Envelope

Server Actions use a discriminated result.

## 3.1 Success

```ts
type ActionSuccess<T> = {
  ok: true;
  data: T;
};
```

## 3.2 Expected failure

```ts
type ActionFailure = {
  ok: false;
  error: {
    code: AppErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};
```

The UI may use `message` for safe display.

`fieldErrors` keys match the input contract's logical field names.

Unexpected exceptions are logged server-side and converted to a safe `INTERNAL_ERROR` response.

---

# 4. Error Code Catalog

V1 uses these stable application-level error codes.

```ts
type AppErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "EVENT_NOT_MUTABLE"
  | "EVENT_NOT_DELETABLE"
  | "EVENT_NOT_PUBLISHABLE"
  | "INVITATION_UNAVAILABLE"
  | "INVITATION_REVOKED"
  | "TOKEN_INVALID"
  | "RSVP_READ_ONLY"
  | "MAX_PARTY_SIZE_CONFLICT"
  | "ATTENDEE_COUNT_CONFLICT"
  | "CONCURRENT_UPDATE"
  | "UPLOAD_NOT_ALLOWED"
  | "EXPORT_FAILED"
  | "INTERNAL_ERROR";
```

## 4.1 Error exposure

Guest-facing contracts should prefer privacy-safe errors.

For example, invalid, obsolete, Draft, or revoked Guest access may all resolve to a generic unavailable response rather than exposing the underlying reason.

Organizer contracts may return more specific domain error codes after authentication/ownership succeeds.

---

# 5. Common Organizer Preconditions

Every Organizer Event-scoped mutation follows:

```text
resolve authenticated user
    |
    +--> none -> AUTH_REQUIRED
    |
    v
load target Event through owned scope
    |
    +--> not owned/not visible -> FORBIDDEN or NOT_FOUND
    |
    v
calculate Event expiration
    |
    +--> Ended -> EVENT_NOT_MUTABLE
    |
    v
validate input + execute transaction
```

D-26 applies to:

- Event edits;
- RSVP Deadline edits;
- Invitation creation/editing;
- Maximum Party Size edits;
- RSVP edits;
- Token regeneration;
- Invitation revocation;
- Hero Image mutation.

Reads and CSV export do not use the `EVENT_NOT_MUTABLE` guard. D-27 also permits the dedicated permanent `deleteEvent` operation for owned Draft or Ended Events; that operation uses its own runtime-state guard rather than ordinary `assertEventMutable`.

---

# 6. Common Guest Preconditions

Guest Invitation reads/writes begin with the raw Token from the personalized route.

Server flow:

```text
raw Token
  |
  v
validate token shape
  |
  v
HMAC lookup
  |
  v
resolve one current Invitation credential
  |
  v
load Invitation + Event + current RSVP
  |
  v
evaluate access
```

Read access requires:

```text
Event Published
AND not Ended
AND Invitation not revoked
AND current Token valid
```

Write access additionally requires:

```text
RSVP Deadline absent
OR now < RSVP Deadline
```

---

# 7. Organizer Auth Integration Contract

Organizer identity is managed by Supabase Auth.

V1 does not define a public sign-up endpoint.

The sign-in integration must:

- accept an Organizer email address;
- start passwordless email OTP for an already provisioned Auth user;
- be configured so an unknown email does not auto-create a new Auth user;
- establish the normal authenticated Supabase session only after valid OTP verification.

Account provisioning is an administrative/operational action and is not a public V1 Server Action.

Password login/reset and MFA contracts are not required in V1.

---

# 8. Organizer Read Contracts

Organizer reads may be implemented as server-side query functions rather than public HTTP endpoints.

## 8.1 `listOwnedEvents`

```ts
type ListOwnedEventsInput = void;

type EventListItem = {
  id: string;
  eventTitle: string | null;
  eventDate: string | null;
  venueName: string | null;
  runtimeState: "draft" | "published" | "ended";
};
```

Authorization:

- authenticated Organizer required;
- returns only owned Events.

The exact default ordering remains an implementation query choice because no product ordering rule is approved.

## 8.2 `getEventWorkspace`

Input:

```ts
{
  eventId: string;
}
```

Returns:

```ts
{
  event: EventAdminView;
  runtimeState: "draft" | "published" | "ended";
  canMutate: boolean;
}
```

`canMutate = false` when runtime state is Ended.

## 8.3 `getEventOverview`

Input:

```ts
{
  eventId: string;
}
```

Returns:

```ts
{
  totalInvitations: number;
  attendingInvitations: number;
  declinedInvitations: number;
  awaitingResponseInvitations: number;
  totalExpectedAttendees: number;
  guestRsvpPolicy: {
    state: "open" | "closed" | "ended";
    deadlineLocal: string | null;
  };
}
```

## 8.4 `listEventInvitations`

Input:

```ts
{
  eventId: string;
  search?: string;
  rsvpStatus?: "awaiting_response" | "attending" | "declined";
}
```

Returns:

```ts
{
  invitations: InvitationAdminListItem[];
}
```

V1 matching behavior:

- search is scoped to `invitee_name`;
- trim leading/trailing whitespace;
- empty search is treated as no search;
- match is case-insensitive substring matching;
- filter and search combine with logical AND.

No advanced filters are supported.

The V1 Admin experience may return the full matching Event-scoped result set because no pagination contract is approved or required for the expected V1 Event scale. Pagination can be introduced later without changing the business model.

## 8.5 `getInvitationAdminDetail`

Input:

```ts
{
  eventId: string;
  invitationId: string;
}
```

Returns:

```ts
{
  invitation: InvitationAdminDetail;
  rsvp: RsvpAdminView;
  eventRuntimeState: "draft" | "published" | "ended";
  accessState: "active" | "revoked";
  currentInvitationUrl: string | null;
  canMutate: boolean;
}
```

For Ended Events, `canMutate = false`.

The URL must be reconstructed only on the server after authorization.

---

# 9. Guest Read Contract

## 9.1 `resolveGuestInvitation`

This is a server-only query used by the personalized Guest page.

Input:

```ts
{
  rawToken: string;
}
```

Success result:

```ts
type GuestInvitationView = {
  inviteeName: string;
  maximumPartySize: number;

  event: {
    hostDisplayNames: string[];
    eventDate: string;
    startTime: string;
    endTime: string | null;
    eventTimezone: string;
    venueName: string;
    venueAddress: string;
    venueMapUrl: string | null;
    dressCode: string | null;
    invitationMessage: string | null;
    venueArrivalNotes: string | null;
    organizerContactInformation: string | null;
    heroImageSignedUrl: string | null;
    rsvpDeadlineLocal: string | null;
  };

  rsvp: {
    status: "awaiting_response" | "attending" | "declined";
    attendeeCount: number;
    attendeeNames: string[];
    dietaryRequirements: string | null;
    guestMessage: string | null;
    respondedAt: string | null;
    updatedAt: string | null;
  };

  permission: {
    canEditRsvp: boolean;
  };
};
```

Unavailable result:

```ts
{
  ok: false;
  error: {
    code: "INVITATION_UNAVAILABLE";
    message: string;
  };
}
```

Do not return Event/Invitee private data in the unavailable result.

---

# 10. Event Mutation Contracts

## 10.1 `createEventDraft`

Server Action.

Input:

```ts
type CreateEventDraftInput = {
  eventType?: "wedding";
  eventTitle?: string;
  hostDisplayNames?: string[];
  eventDate?: string;
  startTime?: string;
  endTime?: string | null;
  eventTimezone?: string;
  rsvpDeadlineLocal?: string | null;
  venueName?: string;
  venueAddress?: string;
  venueMapUrl?: string | null;
  dressCode?: string | null;
  invitationMessage?: string | null;
  venueArrivalNotes?: string | null;
  organizerContactInformation?: string | null;
};
```

Rules:

- authenticated Organizer required;
- creates `publication_status = draft`;
- incomplete publication fields are allowed;
- supplied values must still be individually valid;
- no automatic publication.

Success:

```ts
{
  eventId: string;
  runtimeState: "draft";
}
```

## 10.2 `updateEvent`

Input:

```ts
type UpdateEventInput = CreateEventDraftInput & {
  eventId: string;
};
```

Rules:

- ownership required;
- `EVENT_NOT_MUTABLE` if Ended;
- Draft may remain incomplete;
- Published Event must remain publication-valid;
- timing rules enforced.

## 10.3 `publishEvent`

Input:

```ts
{
  eventId: string;
}
```

Rules:

- ownership required;
- Event must be Draft and not Ended;
- all required fields present;
- timing valid;
- atomic publication transition.

Expected failure:

```text
EVENT_NOT_PUBLISHABLE
```

with field errors where applicable.

Success:

```ts
{
  runtimeState: "published";
  publishedAt: string;
}
```


## 10.4 `deleteEvent`

Server Action.

Input:

```ts
{
  eventId: string;
}
```

Authorization and state rules:

- authenticated Organizer required;
- Event ownership required;
- server recalculates current Event runtime state;
- deletion is allowed only when runtime state is `draft` or `ended`;
- an active `published` Event returns `EVENT_NOT_DELETABLE`.

Successful deletion:

1. permanently deletes the Event database row;
2. database cascades remove its Invitations, current RSVPs, and Invitation access credentials;
3. the Event is removed from Organizer Event queries;
4. former personalized Guest links no longer resolve to private Event data;
5. the referenced private Hero Image is removed through the storage-cleanup path.

Success result:

```ts
{
  deletedEventId: string;
}
```

There is no recycle-bin or restore contract.

The PostgreSQL delete is the authoritative business-data commit. Because private Supabase Storage cleanup is not part of the PostgreSQL transaction, a failed physical Hero Image object deletion must not roll back/recreate deleted Event records. The object remains private/unreferenced and must be retried or removed through the operational orphan-cleanup procedure defined in `14-deployment-and-operations.md`.

A repeated call after confirmed deletion returns the normal safe not-found result and must not recreate data.

---

# 11. Hero Image Mutation Contracts

Hero Image remains part of Event mutation policy.

## 11.1 `prepareHeroImageUpload`

Input:

```ts
{
  eventId: string;
  fileName: string;
  contentType: string;
}
```

Rules:

- authentication + ownership;
- Event must not be Ended;
- actual allowed content types/file-size policy is defined by `10-security-and-privacy.md` / `14-deployment-and-operations.md`;
- returns short-lived upload authorization rather than a public permanent write credential.

## 11.2 `setHeroImageReference`

Input:

```ts
{
  eventId: string;
  storagePath: string;
}
```

Rules:

- ownership;
- Event mutable;
- storage path must belong to the authorized Event upload namespace.

## 11.3 `removeHeroImage`

Input:

```ts
{
  eventId: string;
}
```

Rules:

- ownership;
- Event mutable;
- removing optional Hero Image does not affect publication validity.

---

# 12. Invitation Mutation Contracts

## 12.1 `createInvitation`

Input:

```ts
{
  eventId: string;
  inviteeName: string;
  maximumPartySize: number;
}
```

Validation:

```text
inviteeName nonblank
maximumPartySize integer
1 <= maximumPartySize <= 20
```

Rules:

- Organizer owns Event;
- Event not Ended;
- transaction creates:
  - Invitation;
  - current access credential;
  - Awaiting Response RSVP.

Success:

```ts
{
  invitationId: string;
  currentInvitationUrl: string;
}
```

## 12.2 `updateInvitation`

Input:

```ts
{
  eventId: string;
  invitationId: string;
  inviteeName: string;
  maximumPartySize: number;
}
```

Rules:

- ownership;
- Event not Ended;
- Maximum Party Size `1..20`;
- new Maximum Party Size must be `>= current attendee_count`;
- update is transactional against concurrent RSVP mutation.

Conflict:

```text
MAX_PARTY_SIZE_CONFLICT
```

---

# 13. Token / Access Management Contracts

## 13.1 `regenerateInvitationToken`

Input:

```ts
{
  eventId: string;
  invitationId: string;
}
```

Rules:

- ownership;
- Event not Ended;
- Invitation exists;
- regeneration atomically replaces current credential;
- existing Invitation/RSVP preserved.

Success:

```ts
{
  currentInvitationUrl: string;
  tokenCreatedAt: string;
}
```

Old Token is invalid immediately after commit.

## 13.2 `revokeInvitation`

Input:

```ts
{
  eventId: string;
  invitationId: string;
}
```

Rules:

- ownership;
- Event not Ended;
- preserves Invitation and RSVP;
- does not create a replacement Token.

Success:

```ts
{
  accessState: "revoked";
  revokedAt: string;
}
```

No V1 restore/reactivate Server Action exists.

---

# 14. Guest RSVP Mutation Contract

## 14.1 `submitGuestRsvp`

Server Action or equivalent server mutation called from the personalized Guest page.

Input:

```ts
type GuestRsvpInput = {
  rawToken: string;
  status: "attending" | "declined";
  attendeeCount?: number;
  attendeeNames?: string[];
  dietaryRequirements?: string | null;
  guestMessage?: string | null;
};
```

The raw Token must not be logged.

### Attending validation

```text
attendeeCount required integer
1 <= attendeeCount <= current maximumPartySize
0 <= attendeeNames.length <= attendeeCount
dietaryRequirements optional
guestMessage optional
```

### Declined normalization

Server ignores/rejects stale attendance-only submitted values and persists:

```text
attendeeCount = 0
attendeeNames = []
dietaryRequirements = null
guestMessage = submitted/preserved value
```

### Authorization/state validation

At mutation time, re-evaluate:

- current Token;
- Event Published;
- Event not Ended;
- Invitation not revoked;
- RSVP Deadline write permission;
- current Maximum Party Size.

Expected state error:

```text
RSVP_READ_ONLY
```

when deadline prevents Guest changes.

Privacy-sensitive invalid access resolves as:

```text
INVITATION_UNAVAILABLE
```

Success:

```ts
{
  rsvp: GuestRsvpView;
}
```

---

# 15. Organizer RSVP Mutation Contract

## 15.1 `updateOrganizerRsvp`

Input:

```ts
type OrganizerRsvpInput = {
  eventId: string;
  invitationId: string;
  status: "attending" | "declined";
  attendeeCount?: number;
  attendeeNames?: string[];
  dietaryRequirements?: string | null;
};
```

`guestMessage` is deliberately absent from the mutable input.

Rules:

- authenticated Owner;
- Event not Ended;
- may operate after RSVP Deadline;
- no reset-to-Awaiting operation;
- Attending validates against current Maximum Party Size;
- Declined applies approved cleanup;
- Guest Message remains persisted unchanged.

Success:

```ts
{
  rsvp: RsvpAdminView;
}
```

---

# 16. RSVP Deadline Reopen Contract

There is no `reopenRsvp()` action.

Reopening uses `updateEvent` with:

```ts
{
  rsvpDeadlineLocal: futureValidDeadline
}
```

or:

```ts
{
  rsvpDeadlineLocal: null
}
```

Rules:

- Organizer owns Event;
- Event not Ended;
- new deadline, when present, must be before Event Start;
- Guest write permission is derived from the saved deadline.

After Event expiration, `updateEvent` returns:

```text
EVENT_NOT_MUTABLE
```

---

# 17. CSV Export Route Handler

Recommended HTTP boundary:

```text
GET /admin/events/{eventId}/export.csv
```

The exact application route prefix may be adjusted by Development Architecture, but the contract semantics are fixed here.

## 17.1 Authorization

- valid Organizer session required;
- Event ownership required;
- Ended Event export remains allowed.

## 17.2 Response

On success:

```text
HTTP 200
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="<safe-event-name>-rsvp.csv"
Cache-Control: private, no-store
```

V1 uses UTF-8 CSV.

Required header order:

```text
Invitee Name,
RSVP Status,
Maximum Party Size,
Attendee Count,
Attendee Names,
Dietary Requirements,
Guest Message,
Responded At,
Updated At
```

All Event Invitations are included.

Attendee Names are serialized within one cell using:

```text
name1; name2; name3
```

Before CSV quoting/escaping, user-controlled text cells must be neutralized against spreadsheet formula execution.

Detection ignores leading whitespace when checking the first meaningful character. If that character is any of:

```text
=
+
-
@
```

prefix an apostrophe (`'`) at the start of the exported cell value, then perform normal RFC-4180-style CSV quoting/escaping.

This applies at minimum to:

- Invitee Name;
- Attendee Names;
- Dietary Requirements;
- Guest Message.

Any Event-derived text used in the download filename must also be sanitized for safe filename use and must not be interpreted as spreadsheet cell content.

CSV values are RFC-4180-style quoted/escaped after formula neutralization.

Credential/internal fields are never included.

## 17.3 Errors

Expected:

- `401` when no Organizer session;
- `403` or privacy-safe `404` when not authorized;
- `500` safe export error when generation unexpectedly fails.

Do not include database exception text in the response.

---

# 18. Search Contract

`listEventInvitations` supports only approved V1 search/filter dimensions.

Input normalization:

```text
search -> trim whitespace
rsvpStatus -> validated approved enum
```

Search semantics:

```text
case-insensitive substring on Invitee Name
```

Examples:

```text
"john" matches "John & Family"
"family" matches "John & Family"
```

Search and RSVP Status filter use AND semantics.

No token, Guest Message, Dietary Requirements, Attendee Names, or internal-ID search is included.

---

# 19. Runtime State Helpers

Server code should centralize these calculations rather than duplicate them across Actions.

## 19.1 `getEventRuntimeState`

Input:

```text
Event record + current instant
```

Output:

```ts
"draft" | "published" | "ended"
```

## 19.2 `assertEventMutable`

Input:

```text
owned Event + current instant
```

Behavior:

- return/continue for Draft or unexpired Published;
- throw/return `EVENT_NOT_MUTABLE` for Ended.

## 19.3 `getGuestRsvpPermission`

Output:

```ts
{
  canReadInvitation: boolean;
  canEditRsvp: boolean;
}
```

Uses Event state, revocation, current Token, expiration, and RSVP Deadline.

---

# 20. Concurrency Contracts

## 20.1 RSVP versus Maximum Party Size

`submitGuestRsvp`, `updateOrganizerRsvp`, and `updateInvitation` must participate in the Data Model locking/transaction strategy.

Invariant after commit:

```text
rsvp.attendee_count <= invitation.maximum_party_size
```

If another transaction changes the relevant state first, the losing mutation is rejected with a safe conflict/validation result rather than committing invalid data.

## 20.2 Token regeneration

Credential replacement is atomic.

No intermediate state with zero or multiple current credentials may be externally observable.

## 20.3 Publication

Publication validates and changes publication state atomically.

---

# 21. Idempotency Expectations

Most V1 Server Actions are invoked through first-party forms and are not required to expose user-supplied idempotency keys.

However:

- UI must prevent obvious duplicate submissions while pending;
- transactional uniqueness/constraints prevent duplicate credential/RSVP structures;
- mutation handlers must not intentionally retry non-idempotent operations after an ambiguous commit without re-reading state.

## 21.1 Safe/repeatable examples

Repeated read/export requests are safe.

Submitting the same RSVP desired state twice may result in the same current business state, but timestamps may reflect a real subsequent update according to the persistence contract.

## 21.2 Token regeneration

Token regeneration is intentionally non-idempotent: every successful invocation rotates to a new credential.

The UI confirmation/pending state must prevent accidental duplicate activation.

---

# 22. Validation Schema Boundaries

Shared TypeScript/Zod schemas should exist for:

- Event draft/update input;
- publication precondition validation;
- Invitation input;
- Guest RSVP input;
- Organizer RSVP input;
- search/filter input;
- identifiers.

No exact product-wide maximum character lengths are introduced here because approved product specifications do not define them.

Required textual values must at least reject blank/whitespace-only input where the corresponding product field is required.

Security/operations may later define transport/upload safety limits that do not silently alter approved product meaning.

---

# 23. Authorization Matrix

| Contract | Authenticated Organizer | Event ownership | Event mutable | Guest Token |
|---|---:|---:|---:|---:|
| listOwnedEvents | Yes | N/A | N/A | No |
| getEventWorkspace | Yes | Yes | No | No |
| getEventOverview | Yes | Yes | No | No |
| listEventInvitations | Yes | Yes | No | No |
| getInvitationAdminDetail | Yes | Yes | No | No |
| createEventDraft | Yes | N/A | N/A | No |
| updateEvent | Yes | Yes | Yes | No |
| deleteEvent | Yes | Yes | Draft or Ended only | No |
| publishEvent | Yes | Yes | Yes | No |
| createInvitation | Yes | Yes | Yes | No |
| updateInvitation | Yes | Yes | Yes | No |
| regenerateInvitationToken | Yes | Yes | Yes | No |
| revokeInvitation | Yes | Yes | Yes | No |
| updateOrganizerRsvp | Yes | Yes | Yes | No |
| CSV export | Yes | Yes | No | No |
| resolveGuestInvitation | No | No | N/A | Yes |
| submitGuestRsvp | No | No | Event active | Yes |

---

# 24. Guest Error Privacy Matrix

| Internal condition | Guest-facing result |
|---|---|
| malformed Token | Invitation unavailable |
| unknown Token hash | Invitation unavailable |
| old regenerated Token | Invitation unavailable |
| Draft Event | Invitation unavailable |
| revoked Invitation | Invitation unavailable |
| Ended Event | Invitation unavailable |
| valid active Invitation after deadline | Invitation visible, RSVP read-only |

This contract intentionally avoids exposing sensitive access-state distinctions to unauthenticated Guests.

---

# 25. HTTP / Cache Requirements

Personalized Guest Invitation responses:

```text
Cache-Control: private, no-store
```

Authenticated Admin responses containing Event/Invitee/RSVP data must not be publicly cacheable.

CSV export:

```text
Cache-Control: private, no-store
```

Hero Image signed URLs are short-lived as defined by the security/operations specification.

---

# 26. Logging and Secret Redaction Contract

Application server code must not intentionally log:

- raw Invitation Token;
- full personalized Invitation URL containing Token;
- decrypted Token value;
- service-role key;
- Token encryption/hash keys.

Request/error logging should use safe internal correlation identifiers rather than credential values.

Full logging/redaction rules are finalized in `10-security-and-privacy.md`.

---

# 27. No V1 Contracts for Out-of-Scope Operations

Do not implement V1 Server Actions/endpoints for:

- Invitation deletion;
- RSVP deletion;
- Event duplication;
- Unpublish;
- restore/reactivate revoked Invitation;
- reset responded RSVP to Awaiting Response;
- collaborator/team membership;
- ownership transfer;
- bulk Invitation creation;
- messaging/email/SMS delivery;
- theme editing.

If implementation requires one of these, resolve/update higher-precedence specifications first.

---

# 28. Contract Acceptance Scenarios

## API-AS-01 — Ended Event mutation rejected

Given an Organizer owns an Ended Event, when they submit `updateEvent`, `createInvitation`, `updateInvitation`, `updateOrganizerRsvp`, `regenerateInvitationToken`, or `revokeInvitation`, then the action returns `EVENT_NOT_MUTABLE` and committed records remain unchanged.

## API-AS-02 — Ended Event export allowed

Given an Organizer owns an Ended Event, when they request CSV export, then export succeeds subject to normal authorization.

## API-AS-03 — RSVP race safety

Given Maximum Party Size is `3`, when one transaction attempts Attendee Count `3` while another tries to reduce Maximum Party Size to `2`, then at most one conflicting state change commits and the final persisted invariant remains valid.

## API-AS-04 — Guest deadline race

Given a Guest renders an editable RSVP form before the deadline, when the deadline passes before submission, then `submitGuestRsvp` returns `RSVP_READ_ONLY` and does not update RSVP.

## API-AS-05 — Token rotation

Given an Invitation has an RSVP, when Token regeneration succeeds, then the returned URL contains the new Token, the old Token becomes unavailable, and RSVP data are unchanged.

## API-AS-06 — Organizer cannot edit Guest Message

Given `updateOrganizerRsvp`, the mutable input schema has no Guest Message field, and any manually injected unexpected field is stripped/rejected according to schema policy rather than persisted.

## API-AS-07 — Unauthorized Organizer

Given an authenticated Organizer does not own an Event, when they call an Event-scoped read or mutation, then private Event data are not returned.

## API-AS-08 — CSV credential exclusion

Given CSV export, when the response is generated, then no Token/hash/ciphertext/personalized URL/internal ID appears in the approved columns.

---


## API-AS-09 — Draft/Ended Event deletion

Given an Organizer owns a Draft or Ended Event, when `deleteEvent` succeeds, then the Event and its dependent Invitation/RSVP/access-credential database rows are removed, former personalized links expose no private data, and the Hero Image follows the approved private storage-cleanup path.

## API-AS-10 — Active Published Event deletion rejected

Given an Organizer owns an active Published Event, when `deleteEvent` is attempted, then the action returns `EVENT_NOT_DELETABLE` and committed Event data remain unchanged.

## API-AS-11 — CSV Formula Neutralization

Given a Guest-controlled exported text value whose first non-whitespace character is `=`, `+`, `-`, or `@`, when CSV export is generated, then the exported cell is neutralized before CSV escaping so spreadsheet software does not execute it as a formula.


# 29. Traceability

| Contract area | Approved source |
|---|---|
| Organizer ownership | FR-SEC-003, Technical Architecture TA-04 |
| Guest Token access | FR-SEC-001, TA-03/05 |
| Ended mutation guard | D-26, FR-EVT-006, Admin Spec Section 43 |
| Event deletion | D-27, FR-EVT-007 |
| Organizer OTP auth | D-28, FR-SEC-004 |
| Event lifecycle | D-18, FR-EVT-004 |
| Event time validation | D-19, FR-EVT-005 |
| Maximum Party Size | D-01, D-25, FR-INV-003/004 |
| Guest RSVP | FR-RSVP-001 through FR-RSVP-008, Guest Spec |
| Organizer RSVP | D-22, FR-RSVP-009, Admin Spec |
| Token regeneration | D-10 |
| Revocation | D-11 |
| RSVP reopening | D-24 |
| Search/filter | D-23 |
| CSV | D-12 |
| CSV formula injection defense | SEC-D08, SEC-TEST-10 |
| Transactional invariants | Data Model Section 15 |
| Private Hero Image | Technical Architecture TA-06 |
| Error/privacy presentation | Guest/Admin specifications |

---

# 30. Explicitly Deferred Server Details

This document intentionally defers:

- exact repository file/module names;
- exact Next.js route-group layout;
- exact SQL/RPC function names;
- exact Hero Image size/type limits;
- cryptographic key-rotation procedure;
- rate-limit thresholds;
- CSRF/security-header policy;
- monitoring/logging vendor;
- exact input text maximum lengths;
- localization;
- automated API versioning.

These belong to Security/Privacy, Development Architecture, or Deployment/Operations as appropriate.

---

# 31. Review Checklist

Before marking this document Approved, confirm:

- Server Actions are the primary form-mutation boundary;
- Route Handler is used for CSV;
- Organizer ownership is verified server-side;
- D-26 Ended mutation guard applies to all Event-scoped writes;
- Guest access never accepts browser-provided Invitation ID as authority;
- Guest RSVP revalidates deadline/access/Maximum Party Size on every write;
- Organizer RSVP input cannot edit Guest Message;
- no reset-to-Awaiting contract exists;
- token regeneration is atomic and non-idempotent;
- CSV excludes access credentials/internal IDs;
- search is limited to Invitee Name plus RSVP Status;
- privacy-safe Guest errors do not reveal unavailable-state cause;
- no out-of-scope delete/restore/team/theme contracts were introduced;
- no new business rule was introduced.

---

# 32. Next Document

After this API and Server Contracts document is reviewed and approved, create:

**`10-security-and-privacy.md`**

The Security and Privacy specification should define the detailed Invitation Token threat model, cryptographic key handling/rotation, Organizer authorization defense in depth, rate limiting and abuse controls, private-data exposure boundaries, logging/redaction rules, secure headers, Hero Image upload security, secrets handling, and privacy/retention requirements without changing approved business rules.
