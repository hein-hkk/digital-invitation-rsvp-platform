# Product Decisions

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved decision ledger  
> **Applies to:** V1 unless explicitly stated otherwise  
> **Purpose:** Record approved product/business decisions before `02-prd.md` converts them into detailed, testable requirements.

---

## 1. Role of This Document

This document records product decisions that were explicitly resolved during specification work.

These decisions are binding inputs to the PRD and later specifications. They must not be silently changed during implementation.

When a later requirement needs to change one of these decisions:

1. identify the affected decision ID;
2. update this decision ledger;
3. update every dependent specification;
4. create an ADR if the change is architectural or costly to reverse;
5. only then update implementation.

The PRD should restate these rules in testable requirement form rather than inventing alternatives.

---

## 2. Decision Summary

| ID | Topic | Approved V1 Decision |
|---|---|---|
| D-01 | Maximum Party Size reduction | Cannot be reduced below the currently confirmed Attendee Count. |
| D-02 | RSVP status changes | Invitee may change between Attending and Declined while guest RSVP changes are permitted. |
| D-03 | RSVP Deadline behavior | Invitation stays viewable; guest RSVP becomes read-only after the deadline. |
| D-04 | Organizer deadline override | Organizer may modify RSVPs after the deadline and may reopen guest RSVP for the Event. |
| D-05 | RSVP history | Store one current RSVP with timestamps; no full revision history in V1. |
| D-06 | Attendee names | Optional; Attendee Count is required when status is Attending. |
| D-07 | Attendee categories | No adult/child/infant categories in V1; every attending person counts as 1. |
| D-08 | Dietary requirements | One optional RSVP-level free-text field, separate from Guest Message. |
| D-09 | Invitation expiration | Guest access expires after the Event while Invitation/RSVP data is preserved. |
| D-10 | Token regeneration | Old token becomes invalid immediately; new token accesses the same Invitation; RSVP data is preserved. |
| D-11 | Invitation revocation | Revocation disables guest access but preserves Invitation/RSVP data and does not create a replacement token. |
| D-12 | CSV export | Event-scoped export includes all Invitations and approved RSVP fields; never exports access credentials. |
| D-13 | Required Event fields | Drafts may be incomplete; required fields must be complete before Invitations can be shared. |
| D-14 | Optional Event fields | Optional presentation/convenience fields are supported with defined deadline/expiration defaults. |
| D-15 | Theme customization | One curated wedding theme; content and Hero Image are customizable, visual theme editing is not. |
| D-16 | Event duplication | Out of scope for V1. |
| D-17 | Organizer roles | Exactly one Owner per Event in V1; no collaboration roles or ownership transfer. |
| D-18 | Event lifecycle | `Draft → Published → Ended`; publishing is explicit; Ended is derived from Event expiration; no Unpublish action in V1. |
| D-19 | Event time validation | RSVP Deadline is date + time in Event Timezone and must be before Event Start; optional End Time must be later than Start Time on the same Event Date. |
| D-20 | Attendee Names cardinality | An attending RSVP may provide from 0 up to Attendee Count names; names need not be unique. |
| D-21 | Decline data cleanup | Changing to Declined sets Attendee Count to 0, clears Attendee Names and Dietary Requirements, and preserves Guest Message. |
| D-22 | Organizer RSVP editing | Organizer may edit RSVP Status, Attendee Count, Attendee Names, and Dietary Requirements; Guest Message is read-only to the Organizer. |
| D-23 | Invitation search/filter | V1 supports search by Invitee Name and filter by RSVP Status (`Awaiting Response`, `Attending`, `Declined`). |
| D-24 | Reopening RSVP | No separate reopen switch; Organizer reopens RSVP by moving RSVP Deadline into the future or removing it; expiration still prevents reopening. |
| D-25 | Maximum Party Size bounds | Maximum Party Size must be an integer from 1 through 20 inclusive. |
| D-26 | Ended Event admin behavior | After Event expiration, the Event is administratively read-only in V1; Organizer may view records and export CSV but may not mutate Event, Invitation, RSVP, deadline, or Invitation-access state. |
| D-27 | Event retention and deletion | No automatic Event-data purge. Owner may permanently delete Draft or Ended Events; active Published Events cannot be self-service deleted. Deletion removes Event, Invitations, RSVPs, access credentials, and Hero Image; no restore/recycle bin. |
| D-28 | Organizer provisioning and sign-in | No public Organizer self-sign-up. Organizer accounts are provisioned administratively and sign in with passwordless email OTP through Supabase Auth; unknown emails must not auto-create accounts. |

---

## 3. RSVP Lifecycle Decisions

### D-01 — Maximum Party Size cannot conflict with a confirmed RSVP

An Organizer cannot reduce an Invitation's **Maximum Party Size** below its currently confirmed **Attendee Count**.

If an Invitation currently has 3 confirmed Attendees, changing Maximum Party Size to 2 must be rejected.

The system must not automatically reduce or alter an existing RSVP to make the new limit fit.

The Organizer must first update the RSVP/attendance data so that the confirmed Attendee Count is less than or equal to the desired Maximum Party Size.

---

### D-02 — Invitees may change RSVP status while changes are permitted

An Invitee may change between:

- Awaiting Response → Attending;
- Awaiting Response → Declined;
- Attending → Declined;
- Declined → Attending;

while guest RSVP changes are permitted.

The RSVP is not permanently locked after its first submission.

---

### D-03 — Invitation stays viewable after the RSVP Deadline

After the **RSVP Deadline**:

- the personalized Invitation remains viewable;
- event information remains viewable;
- the existing RSVP remains viewable;
- guest RSVP submission/editing becomes read-only.

The RSVP Deadline restricts guest RSVP changes; it does not hide the invitation itself.

---

### D-04 — Organizer may override deadline restrictions

An authenticated Organizer may modify an RSVP after the RSVP Deadline.

The Organizer may also reopen guest RSVP for the Event.

The exact admin interaction and authorization checks will be specified in the PRD and admin/security specifications.

---

### D-05 — V1 stores one current RSVP, not full revision history

V1 stores one current RSVP per Invitation.

The RSVP must retain creation/update timestamps sufficient to identify when it was initially submitted and last modified.

Full historical revisions such as every prior status, count, or note change are out of scope for V1.

---

## 4. Attendee Detail Decisions

### D-06 — Attendee names are optional

Individual Attendee names are optional in V1.

When RSVP status is **Attending**, **Attendee Count** is required.

A valid accepted RSVP may therefore contain:

```text
Status: Attending
Attendee Count: 3
Attendee Names: not provided
```

The Invitee/household label on the Invitation must not be treated as proof that the named person is personally attending.

---

### D-07 — No attendee categories in V1

V1 does not distinguish:

- adults;
- children;
- infants;
- other attendee categories.

Every attending person contributes `1` to the Attendee Count.

Attendee categories are future scope unless later approved through the specification process.

---

### D-08 — Dietary requirements belong to the RSVP as a whole

V1 stores one optional free-text **Dietary Requirements** field on the RSVP as a whole.

Dietary Requirements are not attached to individual Attendee records in V1.

**Dietary Requirements** and **Guest Message** are separate concepts and separate fields:

- Dietary Requirements contain practical catering information.
- Guest Message contains an optional personal message to the hosts.

---

## 5. Invitation Access Decisions

### D-09 — Invitation access expires after the Event

Personalized Invitation access automatically expires after the Event is over.

Expiration:

- prevents further guest access through the personalized link;
- does not delete the Invitation;
- does not delete or modify the RSVP;
- does not delete attendance data;
- does not prevent the Organizer from accessing administrative records.

The exact expiration instant follows D-14.

---

### D-10 — Token regeneration rotates access to the same Invitation

When an Organizer regenerates an **Invitation Token**:

- the previous token becomes invalid immediately;
- a new token is issued;
- the new token points to the same Invitation;
- the Invitation identity does not change;
- the current RSVP is preserved;
- Attendee Count and related RSVP data are preserved.

Token regeneration is credential rotation, not Invitation replacement.

The admin UI should warn that previously shared links will stop working.

---

### D-11 — Revocation disables guest access but preserves business data

Revoking an Invitation:

- disables guest access;
- preserves the Invitation record;
- preserves the current RSVP;
- preserves attendance data;
- does not automatically create a replacement token.

Revocation is distinct from regeneration:

```text
Regenerate = invalidate old access + create new access
Revoke     = disable access without creating replacement access
```

---

## 6. Export Decision

### D-12 — Event-scoped CSV export

CSV export is scoped to one Event and includes **all Invitations**, including Invitations with no RSVP response.

V1 exports these fields:

1. Invitee Name
2. RSVP Status
3. Maximum Party Size
4. Attendee Count
5. Attendee Names
6. Dietary Requirements
7. Guest Message
8. Responded At
9. Updated At

Rules:

- `Attendee Names` may contain multiple optional names in one CSV cell.
- Declined and Awaiting Response Invitations export `0` as Attendee Count.
- Invitation Tokens are never exported.
- Personalized Invitation URLs are never exported.
- Internal database identifiers are not exported by default.

The CSV is intended for practical event coordination and may be shared outside the platform, so guest access credentials must not be included.

---

## 7. Event Configuration Decisions

### D-13 — Required Event fields and draft behavior

An Organizer may save an incomplete Event as a draft.

Before personalized Invitations can be made shareable, the Event must contain:

1. **Event Type**
2. **Event Title**
3. **Wedding / Host Display Names**
4. **Event Date**
5. **Start Time**
6. **Event Timezone**
7. **Venue Name**
8. **Venue Address**

For the initial V1 experience, Event Type is `wedding`, while the domain model keeps Event Type as a concept for future event types.

An incomplete draft must not become guest-shareable until all required-to-share fields are valid.

The complete Event lifecycle/state model will be defined in the PRD.

---

### D-14 — Optional Event fields and default timing behavior

V1 supports these optional Event fields:

- **End Time**
- **RSVP Deadline**
- **Venue Map URL**
- **Dress Code**
- **Event Description / Invitation Message**
- **Venue / Arrival Notes**
- **Hero Image**
- **Organizer Contact Information**

Additional rules:

#### Event expiration

If **End Time** is provided, Invitation access expires after that Event End Time.

If **End Time** is not provided, Invitation access expires at the end of the Event's calendar date in the Event Timezone.

#### RSVP Deadline

If an **RSVP Deadline** is provided, D-03 and D-04 apply after that deadline.

If no RSVP Deadline is provided, guest RSVP changes remain permitted until the Event expires.

The PRD must define validation relationships between Event Date/Time, RSVP Deadline, and expiration.

---

## 8. Presentation and Scope Decisions

### D-15 — One curated wedding theme in V1

V1 provides one curated wedding invitation theme.

The Organizer may customize supported Event content, including the optional Hero Image.

V1 does not provide organizer-facing customization of:

- font families;
- font sizes;
- color palettes;
- section layout;
- component layout;
- button styles;
- animation styles;
- custom CSS;
- arbitrary theme settings.

Multiple themes and a theme editor are future scope.

The implementation may be structured so future themes can be added, but V1 must not build speculative theme-management UI.

---

### D-16 — Event duplication is out of scope for V1

V1 does not provide a **Duplicate Event** feature.

Every Event is created independently.

If Event duplication is introduced later, its rules for copied fields, Invitations, RSVPs, tokens, media, dates, and status must be specified explicitly before implementation.

---

## 9. Ownership Decision

### D-17 — One Owner per Event in V1

Each Event has exactly one **Owner** in V1.

The Owner is the authenticated Organizer with full management authority over that Event.

One Organizer account may own multiple Events.

V1 does not support:

- collaborators;
- editors;
- viewers;
- planners;
- additional Event roles;
- shared Event administration;
- ownership transfer.

Additional Organizer roles and collaboration are future scope and are intentionally undefined.

---

## 10. Event Lifecycle and PRD-Readiness Decisions

### D-18 — Event lifecycle is Draft → Published → Ended

V1 uses the following product lifecycle:

```text
Draft
  |
  | Organizer completes required fields
  | and explicitly publishes
  v
Published
  |
  | Event expiration is reached
  v
Ended
```

Rules:

- A Draft Event may be incomplete.
- Personalized guest links are not accessible while the Event is Draft.
- Publishing is an explicit Organizer action; completing the last required field does not publish automatically.
- A Published Event may still be edited, subject to Event validation rules.
- `Ended` is derived automatically when Event expiration is reached.
- V1 does not provide an **Unpublish** action after publication.
- Individual Invitation revocation remains available as defined by D-11.

The PRD may define product requirements around these states but must not introduce additional Event states without updating this decision ledger.

---

### D-19 — Event time validation

V1 applies these Event timing rules:

- **RSVP Deadline** is a date-and-time value interpreted in the Event Timezone.
- If RSVP Deadline is provided, it must be earlier than the Event Start DateTime.
- If End Time is provided, it must be later than Start Time.
- V1 treats End Time as occurring on the same Event Date as Start Time.
- Cross-midnight Events are not supported by this V1 timing model.

Event expiration continues to follow D-14.

---

### D-20 — Attendee Names may be partially provided

For an RSVP with status **Attending**, the number of provided Attendee Names may be anywhere from `0` through the current Attendee Count.

Examples for `Attendee Count = 4`:

- 0 names — valid;
- 1 name — valid;
- 2 names — valid;
- 4 names — valid;
- 5 names — invalid.

Attendee Names do not need to be unique in V1.

This rule does not change D-06: Attendee Names remain optional.

---

### D-21 — Changing an RSVP to Declined clears attendance-only data

When an RSVP changes to **Declined**:

- Attendee Count becomes `0`;
- Attendee Names are cleared;
- Dietary Requirements are cleared;
- Guest Message is preserved.

The system must not continue counting or exporting stale attendance or dietary information for a declined RSVP.

---

### D-22 — Organizer RSVP editing scope

The authenticated Event Owner may edit:

- RSVP Status;
- Attendee Count;
- Attendee Names;
- Dietary Requirements.

The **Guest Message** is guest-authored and is read-only to the Organizer.

Organizer edits remain subject to the same core validity rules, including Maximum Party Size and status-dependent RSVP data.

---

### D-23 — V1 Invitation search and filtering

V1 admin Invitation management must support:

- search by **Invitee Name**;
- filter by RSVP Status:
  - `Awaiting Response`;
  - `Attending`;
  - `Declined`.

Additional search fields, compound filters, sorting controls, and advanced query behavior are not required by this decision.

---

### D-24 — RSVP reopening uses the RSVP Deadline

V1 does not introduce a separate `reopened` flag or RSVP-reopen switch.

If guest RSVP has become read-only because the RSVP Deadline passed, the Organizer may reopen guest RSVP by:

- moving the RSVP Deadline to a future date/time; or
- removing the RSVP Deadline.

Guest RSVP remains unavailable after Event expiration even if the RSVP Deadline is moved or removed.

This decision supersedes any interpretation of D-04 that would require an independent reopen state.

---

### D-25 — Maximum Party Size bounds

Maximum Party Size must be an integer from **1 through 20 inclusive**.

Values below `1`, above `20`, non-integer values, and empty values are invalid.

This bound applies to Organizer Invitation creation/editing and to every RSVP Attendee Count derived from that Invitation.

---

### D-26 — Ended Events are administratively read-only

After Event expiration, the Event is **Ended** and becomes read-only for V1 operational administration.

The Organizer may continue to:

- view the Event and its configuration;
- view the dashboard and current metrics;
- view Invitations;
- view current RSVPs;
- search and filter Invitations;
- export the Event CSV.

The Organizer may not, for an Ended Event:

- edit Event fields;
- change or remove RSVP Deadline;
- create or edit Invitations;
- change Maximum Party Size;
- edit RSVP operational fields;
- regenerate Invitation Tokens;
- revoke Invitations;
- perform another access-management mutation.

Guest access remains expired regardless.

This decision does not itself delete or alter preserved Event, Invitation, RSVP, or attendance data. D-27 later adds permanent Owner deletion of the entire Ended Event as the sole approved self-service exception to this read-only rule.

---

### D-27 — Event retention and deletion

V1 does **not** automatically delete Event data when the Event ends or after a fixed application-level retention timer.

The Event Owner may permanently delete:

- a **Draft** Event;
- an **Ended** Event.

The Event Owner may **not** self-service delete an active **Published** Event in V1.

Permanent Event deletion removes the Event's:

- Event record;
- Invitations;
- current RSVPs;
- Invitation access credentials;
- Hero Image.

V1 does not provide a recycle bin, soft-delete recovery, or restore workflow for a permanently deleted Event.

This is the one approved exception to D-26's Ended Event read-only rule: an Ended Event is read-only for ordinary operational edits, but the Owner may permanently delete the entire Ended Event.

Account-wide privacy/data-erasure requests are handled through a verified operational process rather than a self-service V1 account-deletion UI.

Backup copies containing deleted production data must age out within a maximum of **30 days**. The exact backup implementation and restore procedure belong to `14-deployment-and-operations.md`.

---

### D-28 — Organizer account provisioning and passwordless email OTP

V1 does **not** provide public Organizer self-sign-up.

Organizer accounts are provisioned administratively using the approved Supabase Auth identity system.

Organizer sign-in uses **passwordless email OTP**.

Rules:

- the Organizer enters the email address associated with an already provisioned Organizer account;
- the authentication system sends a one-time email code using the configured Supabase Auth flow;
- an unknown email must **not** automatically create a new Organizer account;
- successful OTP verification establishes the authenticated Organizer session;
- password-based Organizer authentication is not required in V1;
- password reset/recovery flows are therefore not required in V1;
- public registration and MFA are outside V1 unless later approved.

Exact operational account-provisioning steps and OTP/session configuration belong to the security, development, and deployment specifications.

---

## 11. Derived V1 Behavior Matrix

| Situation | Guest | Organizer |
|---|---|---|
| Before RSVP Deadline | May view and update RSVP | May view and update RSVP |
| After RSVP Deadline, before Event expiration | May view Invitation/RSVP; RSVP is read-only | May edit RSVP and may reopen guest RSVP |
| After Event expiration | Personalized guest access is expired | Records remain viewable and CSV-exportable; Event/Invitation/RSVP/access-management data are read-only |
| Invitation revoked | Guest access denied | Invitation and RSVP data remain available |
| Token regenerated | Old link invalid; new link valid | Same Invitation and RSVP remain intact |

---

## 12. Decisions Explicitly Deferred

These approved decisions do **not** define implementation details that belong in later specifications.

Still deferred:

- exact database schema;
- exact token format and token-storage strategy;
- exact URL route format;
- exact authorization implementation;
- exact Event status/state names;
- exact form component design;
- exact media upload/storage implementation;
- exact CSV serialization/escaping details;
- exact rate limiting and abuse-prevention rules;
- exact UI copy for expired/revoked/invalid Invitations;
- exact testing framework;
- exact repository structure.

These must be defined in their appropriate documents rather than inferred from this ledger.

---

## 13. Next Step

Use D-01 through D-28 as binding inputs to:

**`02-prd.md`**

The PRD should translate D-01 through D-28 into explicit requirements, validation rules, permissions, edge cases, and acceptance criteria.
