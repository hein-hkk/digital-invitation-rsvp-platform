# 03 — User Flows

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document translates the approved Product Concept, Product Decisions D-01 through D-28, and `02-prd.md` into end-to-end V1 Organizer and Guest workflows. It does not introduce new business rules.

---

## 1. Purpose

This document defines the end-to-end user flows for V1.

It describes how the two product actors move through the system:

- **Organizer / Event Owner**
- **Invitee / Guest**

The flows cover Organizer authentication entry; Event creation, configuration, and publication; Invitation creation and sharing; guest RSVP and RSVP editing; decline behavior; deadline/read-only behavior; Organizer RSVP editing and reopening; token regeneration; revocation; dashboard reporting; search/filter; CSV export; and Event expiration.

This document defines behavioral flow and state transitions. Exact page layout, component design, route names, database structure, API contracts, and visual copy belong to later specifications.

---

## 2. Source-of-Truth Rules

The following sources govern this document:

1. approved ADRs affecting the relevant decision;
2. `product-decisions.md`;
3. `02-prd.md`;
4. this User Flows document.

If this document conflicts with a higher-precedence source, the higher-precedence source wins.

A flow must not invent behavior that is intentionally undefined in the approved specifications.

---

## 3. Actors

### 3.1 Organizer / Event Owner

The Organizer is an authenticated user who owns Events.

V1 supports exactly one Owner per Event.

The Organizer may:

- create and edit owned Events;
- publish valid Draft Events;
- create and edit Invitations;
- set Maximum Party Size;
- copy personalized Invitation links;
- edit operational RSVP fields;
- search and filter Invitations;
- view dashboard metrics;
- regenerate Invitation Tokens;
- revoke Invitations;
- export Event data to CSV.

The Organizer must not edit Guest Message.

### 3.2 Invitee / Guest

The Guest is an unauthenticated user who accesses one Invitation through a valid personalized Invitation Token.

The Guest may view one valid personalized Invitation, view Event information, submit or update RSVP data while permitted, and view the current RSVP after the RSVP Deadline while it is read-only.

The Guest must not access another Invitation, access Organizer/admin data, exceed Maximum Party Size, edit the RSVP after deadline rules make it read-only, or access the personalized Invitation after Event expiration.

---

## 4. State Models Used by the Flows

### 4.1 Event lifecycle

```text
Draft
  |
  | Organizer explicitly publishes
  | after required fields are valid
  v
Published
  |
  | Event expiration reached
  v
Ended
```

Rules:

- Draft Events may be incomplete.
- Draft guest Invitation links are inaccessible.
- Published Events may still be edited before Event expiration.
- V1 has no Unpublish action.
- Ended is derived automatically from Event expiration.
- Ended Event records remain viewable/exportable to the Organizer but are operationally read-only.

### 4.2 RSVP states

```text
Awaiting Response
    |          |
    v          v
Attending <-> Declined
```

Transitions between Attending and Declined are allowed while guest RSVP changes are permitted. V1 stores one current RSVP state rather than full revision history.

### 4.3 Guest Invitation access conditions

A personalized Invitation is guest-accessible only when all applicable conditions are satisfied:

```text
Event is Published
AND
Event has not expired
AND
Invitation is not revoked
AND
presented token is current and valid
```

If any required condition fails, the Guest must not receive the private Invitation experience. Exact unavailable/error copy is deferred to `07-guest-experience-spec.md`.

---

## 5. Organizer Journey Overview

```text
Authenticate
    |
    v
View owned Events
    |
    v
Create Event Draft
    |
    v
Configure Event
    |
    v
Create Invitations
    |
    v
Complete required Event fields
    |
    v
Publish Event
    |
    v
Copy/share Invitation links externally
    |
    v
Monitor RSVPs and attendee totals
    |
    +--> Search/filter Invitations
    +--> Edit RSVP operational data
    +--> Regenerate/revoke Invitation access
    +--> Change/remove RSVP Deadline when needed
    +--> Export CSV
    |
    v
Event expires automatically
    |
    v
Ended; records remain read-only except permanent Event deletion
```

The Organizer may create Invitations while the Event is still Draft, but those guest links are not accessible until the Event is Published.

---

# 6. Organizer Flows

## UF-ORG-01 — Sign In to Organizer Area

**Goal:** Allow an already provisioned Organizer to reach Organizer-only functionality using passwordless email OTP.

**Preconditions:**

- Organizer account has been provisioned administratively.
- User has access to the provisioned email inbox.

### Main flow

1. User enters the Organizer sign-in area.
2. User enters the provisioned Organizer email address.
3. System starts the Supabase Auth passwordless email OTP flow without allowing unknown emails to auto-create accounts.
4. User receives a one-time code by email.
5. User enters/verifies the valid OTP.
6. System establishes the authenticated Organizer session.
7. System shows Events owned by that Organizer or the appropriate Event-management entry state.

### Alternative / failure flow

- If OTP verification fails or expires, Organizer-only functionality remains unavailable.
- An unknown email must not create a new Organizer account.
- The UI must not expose another Organizer's Event/account information.
- An authenticated Organizer must not receive management access to an Event they do not own.

### V1 boundaries

- No public Organizer self-sign-up.
- No password-based sign-in requirement.
- No password reset/recovery flow.
- MFA is not required in V1.

**Related requirements:** R-ORG, FR-SEC-003, FR-SEC-004, D-28.

---

## UF-ORG-02 — Create Event Draft

**Goal:** Allow the Organizer to begin an Event without having every publication field ready.

**Preconditions:** Organizer is authenticated.

### Main flow

1. Organizer chooses to create an Event.
2. System creates or prepares a new Event in **Draft** state.
3. Organizer enters any information currently available.
4. Organizer saves.
5. System validates fields that are present.
6. If the provided values are valid, the Draft is saved.
7. Organizer may leave and return later.

### Result

- Event remains Draft.
- Incomplete required-to-publish information is allowed.
- Guest Invitation links remain inaccessible.

### Validation branch

If a provided value violates an approved validation rule, the system rejects that invalid value/save behavior rather than treating invalid data as merely incomplete.

**Related requirements:** FR-EVT-001, FR-EVT-005, FR-SEC-003.

---

## UF-ORG-03 — Configure Event Information

**Goal:** Prepare an Event for the wedding Invitation experience.

### Main flow

1. Organizer opens an owned Event.
2. Organizer enters/edits required Event fields:
   - Event Type;
   - Event Title;
   - Wedding / Host Display Names;
   - Event Date;
   - Start Time;
   - Event Timezone;
   - Venue Name;
   - Venue Address.
3. Organizer may enter optional fields:
   - End Time;
   - RSVP Deadline;
   - Venue Map URL;
   - Dress Code;
   - Event Description / Invitation Message;
   - Venue / Arrival Notes;
   - Hero Image;
   - Organizer Contact Information.
4. Organizer saves.
5. System validates Event timing in Event Timezone.
6. System stores valid changes.

### Timing validation branches

- If RSVP Deadline is at or after Event Start, the invalid timing is rejected.
- If End Time is at or before Start Time, the invalid timing is rejected.

**Related requirements:** FR-EVT-002, FR-EVT-003, FR-EVT-005.

---

## UF-ORG-04 — Publish Event

**Goal:** Move a valid Event from Draft to Published.

**Preconditions:** Organizer owns the Event; Event is Draft.

### Main flow

1. Organizer chooses **Publish**.
2. System validates every required-to-publish Event field.
3. System validates Event timing.
4. If all requirements pass, Event changes `Draft -> Published`.
5. Personalized Invitations may now become guest-accessible when their own access conditions are valid.

### Validation failure

1. Publication is rejected.
2. Event remains Draft.
3. System identifies invalid/missing fields.
4. Organizer corrects the Event and may retry.

### Important rules

- Publication is explicit.
- Completing the final required field does not publish automatically.
- V1 has no Unpublish flow.

**Related requirements:** FR-EVT-002, FR-EVT-004.

---

## UF-ORG-05 — Edit Published Event

**Goal:** Maintain Event information after publication.

### Main flow

1. Organizer opens an owned Published Event.
2. Organizer changes allowed Event information.
3. System validates the proposed values.
4. System saves valid changes.
5. Event remains Published.

### Invalid-change branch

Invalid timing or publication-invalid changes are rejected; the previously valid Published Event data remain intact.

### Deadline side effect

Changing/removing RSVP Deadline changes Guest RSVP editability according to UF-ORG-14 and UF-GUEST-08.

**Related requirements:** FR-EVT-003, FR-EVT-004, FR-EVT-005, FR-RSVP-008.

---

## UF-ORG-06 — Create Personalized Invitation

**Goal:** Create one Invitation for an individual, couple, family, household, or group.

**Preconditions:** Organizer owns the Event. Event is Draft or Published and has not Ended.

### Main flow

1. Organizer opens the Event's Invitation management area.
2. Organizer chooses to create an Invitation.
3. Organizer enters Invitee Name / household/group label.
4. Organizer enters Maximum Party Size.
5. System validates Maximum Party Size as an integer from `1` through `20`.
6. System creates the Invitation.
7. System assigns a secure Invitation Token and RSVP state `Awaiting Response`.
8. Invitation appears in Organizer records.

### Invalid Maximum Party Size

Empty, non-integer, below `1`, or above `20` is rejected.

### Event-state effect

- Draft Event: Invitation exists but Guest link is inaccessible.
- Published Event: current Guest link may be used when all access conditions are valid.

**Related requirements:** FR-INV-001, FR-INV-003, FR-RSVP-001.

---

## UF-ORG-07 — Edit Invitation Maximum Party Size

**Goal:** Change the attendance limit without creating invalid RSVP data.

### Main flow

1. Organizer opens an Invitation.
2. Organizer changes Maximum Party Size.
3. System validates integer, range `1..20`, and value not below current confirmed Attendee Count.
4. If valid, system saves.

### Conflict branch

If current Attendee Count is `3` and Organizer enters Maximum Party Size `2`, the change is rejected and existing RSVP remains unchanged. Organizer may first reduce Attendee Count to `2` or lower, then retry.

**Related requirements:** FR-INV-003, FR-INV-004.

---

## UF-ORG-08 — Copy and Share Personalized Invitation Link

**Goal:** Allow the Organizer to send a personalized link through an external channel.

### Main flow

1. Organizer opens the Invitation or Invitation list.
2. Organizer chooses to copy the current personalized Guest link.
3. System provides/copies the current link.
4. Organizer sends it externally.

### V1 boundary

The platform does not automate LINE, WhatsApp, SMS, or email delivery.

### Draft behavior

A copied Draft-Event link does not provide the Guest Invitation experience until publication.

**Related requirements:** FR-INV-002, FR-EVT-004.

---

## UF-ORG-09 — View Dashboard and Attendance Totals

**Goal:** Give the Organizer a current operational view.

### Main flow

1. Organizer opens the Event dashboard.
2. System displays at least:
   - Total Invitations;
   - Attending Invitations;
   - Declined Invitations;
   - Awaiting Response Invitations;
   - Total Expected Attendees.
3. Metrics reflect current RSVP state.

```text
Awaiting Response -> 0 expected attendees
Declined          -> 0 expected attendees
Attending         -> current Attendee Count
```

When an RSVP changes, dashboard metrics reflect current data.

**Related requirements:** FR-DASH-001, FR-DASH-002.

---

## UF-ORG-10 — Search and Filter Invitations

**Goal:** Find relevant Invitations quickly.

### Search flow

1. Organizer enters an Invitee Name search term.
2. System constrains results to matching Invitations in the current Event.

### Filter flow

1. Organizer chooses RSVP Status:
   - Awaiting Response;
   - Attending;
   - Declined.
2. System constrains the current Event list accordingly.

Advanced search fields and filters are not required.

**Related requirements:** FR-INV-007, D-23.

---

## UF-ORG-11 — Edit Operational RSVP Data

**Goal:** Allow the Organizer to manage current RSVP operational information.

Organizer may edit RSVP Status, Attendee Count, Attendee Names, and Dietary Requirements. Organizer may view but must not edit Guest Message.

### Attending flow

1. Organizer opens an Invitation's RSVP.
2. Organizer sets/keeps Status = Attending.
3. Organizer sets valid Attendee Count `1..Maximum Party Size`.
4. Organizer may provide 0 through Attendee Count names.
5. Organizer may edit Dietary Requirements.
6. System validates and saves.
7. Dashboard reflects current state.

### Declined flow

1. Organizer sets Status = Declined.
2. System normalizes RSVP:
   - Attendee Count = `0`;
   - Attendee Names cleared;
   - Dietary Requirements cleared;
   - Guest Message preserved.
3. System saves and dashboard updates.

Organizer editing remains allowed after RSVP Deadline while the Event has not Ended.

**Related requirements:** FR-RSVP-003, FR-RSVP-004, FR-RSVP-006, FR-RSVP-009, FR-DASH-002.

---

## UF-ORG-12 — Regenerate Invitation Token

**Goal:** Rotate guest access without replacing Invitation or RSVP.

### Main flow

1. Organizer chooses **Regenerate Invitation Token**.
2. System warns that the previously shared link will stop working.
3. Organizer proceeds.
4. Old token becomes invalid immediately.
5. New token is created for the same Invitation.
6. Existing RSVP and attendance data remain unchanged.
7. Organizer may copy/share the new link.

**Guest consequence:** old link denied; new current link reaches the same Invitation when access rules allow it.

**Related requirements:** FR-INV-005, D-10.

---

## UF-ORG-13 — Revoke Invitation

**Goal:** Disable Guest access while preserving business data.

### Main flow

1. Organizer revokes the Invitation.
2. Guest access is disabled.
3. Invitation record remains.
4. Current RSVP remains.
5. Attendance data remain.
6. No replacement token is automatically generated.

### Boundary

V1 does not define a standalone **restore revoked Invitation** workflow. This document does not invent one.

**Related requirements:** FR-INV-006, D-11.

---

## UF-ORG-14 — Reopen Guest RSVP

**Goal:** Permit Guest changes again after the RSVP Deadline, before Event expiration.

### Option A — Move deadline

1. Organizer edits RSVP Deadline.
2. Organizer selects a future date/time still before Event Start.
3. System validates and saves.
4. Guest RSVP becomes editable again.

### Option B — Remove deadline

1. Organizer removes RSVP Deadline.
2. System saves.
3. Guest RSVP becomes editable until Event expiration.

### Expired Event branch

After Event expiration, changing/removing RSVP Deadline does not restore Guest access.

V1 has no independent reopen switch.

**Related requirements:** FR-RSVP-008, D-24.

---

## UF-ORG-15 — Export Event CSV

**Goal:** Obtain a practical Event attendance file.

### Main flow

1. Organizer chooses CSV export.
2. System gathers all Invitations, including Awaiting Response.
3. System outputs:
   - Invitee Name;
   - RSVP Status;
   - Maximum Party Size;
   - Attendee Count;
   - Attendee Names;
   - Dietary Requirements;
   - Guest Message;
   - Responded At;
   - Updated At.
4. Declined and Awaiting Response rows use Attendee Count `0`.
5. System excludes Invitation Tokens, personalized Invitation URLs, and internal database identifiers by default.
6. Organizer receives the CSV.

**Related requirements:** FR-CSV-001 through FR-CSV-004.

---

## UF-ORG-16 — View Ended Event Read-Only

**Goal:** Preserve Organizer access to records after Event expiration without permitting post-event operational changes.

### Main flow

1. Event expiration is reached and runtime Event state is Ended.
2. Organizer opens the owned Event.
3. System allows the Organizer to:
   - view Event configuration;
   - view dashboard metrics;
   - view/search/filter Invitations;
   - view current RSVPs;
   - export CSV.
4. Mutation controls for that Ended Event are absent, disabled, or otherwise non-actionable according to the Admin specification.
5. A direct server mutation attempt is rejected.

### Mutations not permitted

- Event field or RSVP Deadline changes;
- Invitation creation/editing;
- Maximum Party Size changes;
- RSVP operational edits;
- Token regeneration;
- Invitation revocation.

**Related requirements:** FR-EVT-006, D-26.

---

## UF-ORG-17 — Permanently Delete Event

**Goal:** Allow the Owner to permanently remove a Draft or Ended Event and its dependent data.

### Preconditions

- Organizer is authenticated and owns the Event.
- Event runtime state is Draft or Ended.

### Main flow

1. Organizer opens the owned Event.
2. Organizer chooses the permanent Event deletion action.
3. System presents a high-impact confirmation explaining that the Event, Invitations, current RSVPs, Invitation access credentials, and Hero Image will be permanently removed with no V1 restore/recycle-bin flow.
4. Organizer explicitly confirms deletion.
5. Server re-validates ownership and current Event runtime state.
6. System permanently deletes the Event and approved dependent data.
7. Organizer returns to the Events index.
8. Former Guest Invitation URLs no longer expose private data.

### Active Published branch

If the Event is currently Published and has not Ended:

1. deletion is not available as a valid self-service action;
2. a direct mutation attempt is rejected;
3. Event data remain unchanged.

### Important rule

D-27 is the sole approved self-service exception to D-26's Ended Event read-only rule.

**Related requirements:** FR-EVT-007, D-27.

---

# 7. Guest Journey Overview

```text
Receive personalized link externally
    |
    v
Open link
    |
    v
Validate access
    |
    +--> invalid / old / revoked / Draft / expired
    |        |
    |        v
    |     Access unavailable
    |
    v
View personalized wedding Invitation
    |
    v
View current RSVP
    |
    +--> Before deadline / changes permitted
    |        |
    |        +--> Attending
    |        |      |
    |        |      v
    |        |   Choose count
    |        |   Optional names
    |        |   Optional dietary requirements
    |        |   Optional Guest Message
    |        |      |
    |        |      v
    |        |   Submit current RSVP
    |        |
    |        +--> Declined
    |               |
    |               v
    |            Submit current RSVP
    |
    +--> After deadline, before expiration
             |
             v
          View only
```

---

# 8. Guest Flows

## UF-GUEST-01 — Open Personalized Invitation

**Goal:** Allow the Guest to view the correct personalized wedding Invitation without an account.

**Preconditions:** Guest possesses a personalized Invitation URL.

### Access evaluation

The system evaluates whether:

- token is valid and current;
- Event is Published;
- Event has not expired;
- Invitation is not revoked.

### Success flow

1. Guest opens the link.
2. System validates access.
3. System identifies only the Invitation associated with that token.
4. System displays the personalized wedding Invitation and Event information.
5. System displays current RSVP state.
6. Guest is not required to create an account.

### Unavailable branches

Access is unavailable when the token is invalid, obsolete after regeneration, the Event is Draft, the Invitation is revoked, or the Event is Ended/expired.

Private Invitation data must not be exposed through unavailable states.

**Related requirements:** FR-INV-002, FR-EVT-004, FR-SEC-001, FR-PRES-002.

---

## UF-GUEST-02 — RSVP Attending

**Goal:** Confirm attendance within the Invitation's party limit.

**Preconditions:** Guest has valid Invitation access; RSVP changes are permitted.

### Main flow

1. Guest chooses **Attending**.
2. System presents Attendee Count choices constrained by Maximum Party Size.
3. Guest selects integer Attendee Count `1..Maximum Party Size`.
4. Guest may provide Attendee Names.
5. Number of names may be `0..Attendee Count`.
6. Guest may provide Dietary Requirements.
7. Guest may provide Guest Message.
8. Guest submits.
9. Server validates all RSVP rules.
10. If valid, current RSVP is stored as Attending.
11. RSVP timestamps are recorded/updated.
12. Guest sees the saved current RSVP.
13. Admin dashboard totals reflect the current RSVP.

### Invalid Attendee Count branch

Missing count, `0`, count above Maximum Party Size, decimal, or non-numeric invalid submission is rejected server-side and no invalid RSVP state is stored.

### Too many names branch

If Attendee Names count exceeds Attendee Count, submission is rejected until corrected.

**Related requirements:** FR-RSVP-003, FR-RSVP-004, FR-RSVP-005, FR-SEC-002.

---

## UF-GUEST-03 — RSVP Declined

**Goal:** Allow the Guest to decline.

**Preconditions:** Valid Invitation access; RSVP changes permitted.

### Main flow

1. Guest chooses **Declined**.
2. Guest may provide/update Guest Message.
3. Guest submits.
4. Current RSVP Status becomes Declined.
5. System ensures:
   - Attendee Count = `0`;
   - Attendee Names empty;
   - Dietary Requirements empty.
6. Guest Message is stored/preserved.
7. Guest sees current Declined state.
8. Dashboard counts the Invitation as Declined and contributes `0` expected Attendees.

**Related requirements:** FR-RSVP-002, FR-RSVP-006, FR-DASH-002.

---

## UF-GUEST-04 — Update Attending RSVP

**Goal:** Modify a current Attending response while changes are permitted.

### Main flow

1. Guest opens the same current personalized Invitation link.
2. System displays existing current RSVP.
3. Guest changes one or more guest-editable values:
   - Attendee Count;
   - Attendee Names;
   - Dietary Requirements;
   - Guest Message;
   - RSVP Status.
4. Guest submits.
5. Server validates the complete resulting RSVP.
6. Valid changes update the one current RSVP.
7. Updated timestamp changes.
8. Dashboard reflects the current data.

If Organizer previously changed Maximum Party Size, the submitted Attendee Count must satisfy the current limit.

**Related requirements:** FR-RSVP-002 through FR-RSVP-005.

---

## UF-GUEST-05 — Change Attending to Declined

**Goal:** Allow plans to change without stale attendance data.

### Main flow

1. Guest changes Status from Attending to Declined.
2. Guest submits.
3. System applies:
   - Attendee Count -> `0`;
   - Attendee Names -> cleared;
   - Dietary Requirements -> cleared;
   - Guest Message -> preserved.
4. Current RSVP becomes Declined.
5. Dashboard removes the former Attendee Count from Total Expected Attendees.

**Related requirements:** FR-RSVP-002, FR-RSVP-006, D-21.

---

## UF-GUEST-06 — Change Declined to Attending

**Goal:** Allow a previously declining Guest to attend later while changes are permitted.

### Main flow

1. Guest opens the same valid personalized Invitation.
2. Guest changes Status to Attending.
3. Guest chooses valid Attendee Count `1..current Maximum Party Size`.
4. Guest may add optional Attendee Names.
5. Guest may add Dietary Requirements.
6. Guest may update Guest Message.
7. Guest submits.
8. System validates and stores current RSVP = Attending.
9. Dashboard adds the new Attendee Count to Total Expected Attendees.

**Related requirements:** FR-RSVP-002 through FR-RSVP-005.

---

## UF-GUEST-07 — Open Invitation After RSVP Deadline

**Goal:** Retain useful Event access after RSVP editing closes.

**Preconditions:** Event Published and unexpired; Invitation access valid; RSVP Deadline passed.

### Main flow

1. Guest opens personalized Invitation.
2. System validates access.
3. System displays Event information.
4. System displays current RSVP.
5. RSVP controls are read-only.
6. Guest cannot submit/update RSVP.

RSVP Deadline closes Guest editing but does not hide the Invitation.

**Related requirements:** FR-RSVP-007, D-03.

---

## UF-GUEST-08 — RSVP Becomes Editable Again After Organizer Reopens

**Goal:** Reflect Organizer deadline changes without a separate reopen state.

### Preconditions

- RSVP was read-only because deadline passed.
- Event has not expired.
- Organizer moved deadline into future or removed it.

### Main flow

1. Guest opens/reopens valid Invitation.
2. System evaluates current Event deadline rules.
3. RSVP controls are editable again.
4. Guest may submit/update RSVP normally.

If Event is Ended, Guest editing remains unavailable regardless of deadline changes.

**Related requirements:** FR-RSVP-008, D-24.

---

## UF-GUEST-09 — Old Link After Token Regeneration

**Goal:** Prevent use of a rotated access credential.

1. Guest opens previously shared old link.
2. System determines token is no longer current/valid.
3. Access is denied.
4. Private Invitation data are not exposed.

Organizer may send the new current link externally.

**Related requirements:** FR-INV-005, FR-SEC-001.

---

## UF-GUEST-10 — Open Revoked Invitation

**Goal:** Respect Organizer revocation while preserving internal records.

1. Guest opens revoked personalized link.
2. System denies private Invitation access.
3. Guest cannot view/update RSVP through that link.

Organizer records and preserved RSVP remain available administratively.

**Related requirements:** FR-INV-006, D-11.

---

## UF-GUEST-11 — Open Invitation After Event Expiration

**Goal:** End personalized Guest access after the Event while preserving Organizer records.

### Expiration

Event expires:

- after End Time when End Time exists; or
- after the Event calendar date ends in Event Timezone when End Time is absent.

### Main flow

1. Guest opens personalized Invitation link.
2. System determines Event is Ended.
3. Personalized Guest access is unavailable.
4. Guest cannot view or edit RSVP through that Invitation.

Organizer administrative data remain preserved and accessible subject to authorization.

**Related requirements:** FR-EVT-004, FR-EVT-005, D-09.

---

# 9. Cross-Flow State Transition Tables

## 9.1 Event transitions

| Current State | Actor / Trigger | Action | Result |
|---|---|---|---|
| Draft | Organizer | Save incomplete valid data | Draft |
| Draft | Organizer | Attempt Publish with invalid/missing required fields | Draft; publication rejected |
| Draft | Organizer | Explicit Publish with valid required fields | Published |
| Published | Organizer | Edit with valid values | Published |
| Published | Time | Event expiration reached | Ended |
| Ended | Organizer | Attempt Event-scoped mutation | Ended; mutation rejected; records remain read-only |

There is no V1 Published -> Draft Unpublish transition.

## 9.2 RSVP transitions

| Current RSVP | Actor | Requested Status | Allowed while guest changes permitted? | Result |
|---|---|---|---|---|
| Awaiting Response | Guest | Attending | Yes | Attending with valid count/details |
| Awaiting Response | Guest | Declined | Yes | Declined, count 0 |
| Attending | Guest | Attending | Yes | Updated Attending RSVP |
| Attending | Guest | Declined | Yes | Declined; attendance details cleared |
| Declined | Guest | Attending | Yes | Attending with newly valid attendee data |
| Declined | Guest | Declined | Yes | Current Declined RSVP |
| Any current RSVP | Guest | Any edit | No, after deadline | No change; read-only |
| Any current RSVP | Organizer | Operational edit | Yes, including after deadline | Updated current RSVP subject to validation |

## 9.3 Invitation access outcomes

| Event | Invitation / Token | Guest result |
|---|---|---|
| Draft | Any | Access unavailable |
| Published, not expired | Current valid token, not revoked | Invitation accessible |
| Published, not expired | Invalid token | Access unavailable |
| Published, not expired | Old regenerated token | Access unavailable |
| Published, not expired | Revoked Invitation | Access unavailable |
| Ended | Any personalized token | Access unavailable |

---

# 10. Flow-Level Validation Summary

The following approved rules apply across relevant flows:

1. Maximum Party Size must be integer `1..20`.
2. Attending requires Attendee Count `1..Maximum Party Size`.
3. Number of Attendee Names must not exceed Attendee Count.
4. Attendee Names are optional and need not be unique.
5. Maximum Party Size cannot be reduced below confirmed Attendee Count.
6. Declined sets Attendee Count to `0`.
7. Declined clears Attendee Names.
8. Declined clears Dietary Requirements.
9. Declined preserves Guest Message.
10. RSVP Deadline must be before Event Start.
11. End Time must be later than Start Time on the same Event Date.
12. Guest RSVP becomes read-only after RSVP Deadline.
13. Event expiration overrides deadline reopening behavior.
14. Organizer must own the Event for Organizer-only flows.
15. Server-side validation remains authoritative even when UI prevents invalid choices.

---

# 11. Flow-Level Access Summary

## Guest can edit RSVP when

```text
Event = Published
AND Event not expired
AND Invitation not revoked
AND Token valid/current
AND (
  RSVP Deadline absent
  OR current time is before RSVP Deadline
)
```

## Guest can view Invitation with read-only RSVP when

```text
Event = Published
AND Event not expired
AND Invitation not revoked
AND Token valid/current
AND RSVP Deadline exists
AND current time is at/after RSVP Deadline
```

## Guest cannot access personalized Invitation when

```text
Event = Draft
OR Event = Ended
OR Invitation revoked
OR Token invalid
OR Token obsolete after regeneration
```

These expressions describe product behavior, not a required implementation algorithm.

---

# 12. Flow Traceability to PRD

| User Flow | Primary PRD Requirements |
|---|---|
| UF-ORG-01 | FR-SEC-003 |
| UF-ORG-02 | FR-EVT-001, FR-EVT-005 |
| UF-ORG-03 | FR-EVT-002, FR-EVT-003, FR-EVT-005 |
| UF-ORG-04 | FR-EVT-002, FR-EVT-004 |
| UF-ORG-05 | FR-EVT-003, FR-EVT-004, FR-EVT-005, FR-RSVP-008 |
| UF-ORG-06 | FR-INV-001, FR-INV-003, FR-RSVP-001 |
| UF-ORG-07 | FR-INV-003, FR-INV-004 |
| UF-ORG-08 | FR-INV-002, FR-EVT-004 |
| UF-ORG-09 | FR-DASH-001, FR-DASH-002 |
| UF-ORG-10 | FR-INV-007 |
| UF-ORG-11 | FR-RSVP-003, FR-RSVP-004, FR-RSVP-006, FR-RSVP-009 |
| UF-ORG-12 | FR-INV-005 |
| UF-ORG-13 | FR-INV-006 |
| UF-ORG-14 | FR-RSVP-008 |
| UF-ORG-15 | FR-CSV-001 through FR-CSV-004 |
| UF-GUEST-01 | FR-INV-002, FR-EVT-004, FR-SEC-001, FR-PRES-002 |
| UF-GUEST-02 | FR-RSVP-003, FR-RSVP-004, FR-RSVP-005, FR-SEC-002 |
| UF-GUEST-03 | FR-RSVP-002, FR-RSVP-006, FR-DASH-002 |
| UF-GUEST-04 | FR-RSVP-002 through FR-RSVP-005 |
| UF-GUEST-05 | FR-RSVP-002, FR-RSVP-006 |
| UF-GUEST-06 | FR-RSVP-002 through FR-RSVP-005 |
| UF-GUEST-07 | FR-RSVP-007 |
| UF-GUEST-08 | FR-RSVP-008 |
| UF-GUEST-09 | FR-INV-005, FR-SEC-001 |
| UF-GUEST-10 | FR-INV-006 |
| UF-GUEST-11 | FR-EVT-004, FR-EVT-005 |

---

# 13. Flow Traceability to Product Decisions

| Decision | Primary Flow Coverage |
|---|---|
| D-01 | UF-ORG-07 |
| D-02 | UF-GUEST-04, UF-GUEST-05, UF-GUEST-06 |
| D-03 | UF-GUEST-07 |
| D-04 | UF-ORG-11, UF-ORG-14 |
| D-05 | RSVP state model; UF-GUEST-04 |
| D-06 | UF-GUEST-02 |
| D-07 | Flow-Level Validation Summary / V1 boundary |
| D-08 | UF-GUEST-02, UF-ORG-11 |
| D-09 | UF-GUEST-11 |
| D-10 | UF-ORG-12, UF-GUEST-09 |
| D-11 | UF-ORG-13, UF-GUEST-10 |
| D-12 | UF-ORG-15 |
| D-13 | UF-ORG-02, UF-ORG-03, UF-ORG-04 |
| D-14 | UF-ORG-03, UF-GUEST-07, UF-GUEST-11 |
| D-15 | Guest Invitation presentation boundary |
| D-16 | No Event duplication flow |
| D-17 | UF-ORG-01 and ownership checks across Organizer flows |
| D-18 | Event lifecycle model, UF-ORG-04, UF-GUEST-11 |
| D-19 | UF-ORG-03 |
| D-20 | UF-GUEST-02 |
| D-21 | UF-GUEST-03, UF-GUEST-05, UF-ORG-11 |
| D-22 | UF-ORG-11 |
| D-23 | UF-ORG-10 |
| D-24 | UF-ORG-14, UF-GUEST-08 |
| D-25 | UF-ORG-06, UF-ORG-07, UF-GUEST-02 |
| D-26 | UF-ORG-16 and Ended mutation guards across Organizer flows |
| D-27 | UF-ORG-17 |
| D-28 | UF-ORG-01 |

---

# 14. Explicitly Deferred UX / Technical Details

This User Flows document intentionally does not decide:

- exact URL routes;
- exact admin navigation structure;
- exact page names;
- exact button labels;
- modal versus page interactions;
- exact confirmation dialog design;
- exact invalid/revoked/expired Guest copy;
- exact authentication provider experience;
- exact loading states;
- exact component structure;
- exact search matching algorithm;
- exact CSV download filename;
- exact token implementation;
- exact database lifecycle representation;
- exact API/server-action design.

Those belong to later specifications.

---

# 15. No New Business Decisions Introduced

While translating the approved PRD into these flows, this document does not add a new product rule.

One previously deferred boundary remains explicitly preserved:

> V1 does not define a standalone workflow to restore a revoked Invitation.

Therefore this document includes revocation and token regeneration as approved, separate flows and does not invent a restore/reactivation action.

If a restore flow is later desired, it must first be added to `product-decisions.md` and the PRD according to project precedence.

---

# 16. Review Checklist

Before marking this document Approved, confirm that:

- Event lifecycle matches `Draft -> Published -> Ended`;
- no Unpublish flow exists;
- Draft Invitation links are inaccessible;
- Maximum Party Size remains `1..20`;
- Guest RSVP transitions match approved status rules;
- deadline behavior keeps Invitation viewable but RSVP read-only;
- reopening uses RSVP Deadline change/removal, not a new flag;
- expiration overrides reopening;
- regeneration invalidates old token while preserving RSVP data;
- revocation preserves business data;
- no restore-revoked flow was invented;
- Organizer cannot edit Guest Message;
- Declined cleanup behavior is preserved;
- search/filter scope is limited to approved V1 behavior;
- CSV never exposes Invitation Tokens or personalized URLs;
- no new product rule has been introduced.

---

# 17. Next Document

After this User Flows document is reviewed and approved, create:

**`04-technical-architecture.md`**

The Technical Architecture document should define how the approved product behavior is implemented across Next.js, Supabase/PostgreSQL, authentication, authorization, server/client boundaries, deployment, and integration boundaries without changing the approved business rules.
