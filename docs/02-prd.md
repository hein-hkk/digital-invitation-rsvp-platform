# 02 — Product Requirements Document

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This PRD converts `README.md`, `01-product-concept.md`, and approved decisions D-01 through D-28 in `product-decisions.md` into testable V1 product requirements.

---

## 1. Purpose

This document defines the V1 product requirements for the Digital Invitation & RSVP Platform.

It specifies:

- functional requirements;
- business rules;
- validation rules;
- permissions;
- edge cases;
- acceptance criteria;
- traceability to approved product decisions.

Implementation must not invent missing business behavior. If a requirement is unclear or conflicts with a higher-precedence document, update the specification before implementation.

---

## 2. Product Scope

V1 is a reusable digital invitation and RSVP platform with a polished wedding-focused first experience.

V1 must allow a provisioned Organizer authenticated by passwordless email OTP to:

- create and publish one or more Events;
- configure Event information;
- create personalized Invitations;
- set per-Invitation Maximum Party Size;
- copy guest Invitation links;
- monitor RSVP responses and actual attendee totals;
- search, filter, and manage Invitations;
- edit operational RSVP details;
- revoke or regenerate Invitation access;
- export Event-scoped RSVP data to CSV;
- permanently delete owned Draft or Ended Events.

V1 must allow a guest to:

- open one valid personalized Invitation link without an account;
- view Event information;
- accept or decline;
- provide valid attendee details when attending;
- update the RSVP while guest RSVP changes are permitted.

---

## 3. Roles and Permissions

### R-ORG — Organizer

The Organizer is an administratively provisioned authenticated user who owns Events. V1 uses passwordless email OTP and does not provide public Organizer self-sign-up.

V1 supports exactly one Owner per Event.

The Organizer may:

- create, edit, and publish owned Events;
- create and edit Invitations for owned Events;
- copy valid Invitation links;
- revoke or regenerate Invitation tokens;
- view and edit current RSVP operational fields;
- view dashboard totals;
- search and filter Invitations;
- export CSV data;
- permanently delete a Draft or Ended Event.

The Organizer must not edit Guest Message in V1.

### R-GUEST — Guest

The Guest is an unauthenticated user who accesses one Invitation through a valid personalized token.

The Guest may:

- view the personalized Invitation when the token is valid and access is allowed;
- submit or update the RSVP while guest RSVP changes are permitted;
- view the current RSVP state for that Invitation.

The Guest must not:

- access other Invitations;
- access Organizer dashboard data;
- exceed party-size limits;
- update RSVP after deadline/expiration rules prevent guest changes.

---

## 4. Event Requirements

### FR-EVT-001 — Create and Save Draft Event

The Organizer must be able to create and save an Event as a Draft even when required-to-publish fields are incomplete.

Acceptance criteria:

- Given an authenticated Organizer, when they create an incomplete Event, then the system saves it as Draft.
- Given a Draft Event, guest Invitation links for that Event are inaccessible.

### FR-EVT-002 — Required Fields for Publication

Before an Event can be Published, it must contain valid values for:

1. Event Type
2. Event Title
3. Wedding / Host Display Names
4. Event Date
5. Start Time
6. Event Timezone
7. Venue Name
8. Venue Address

Acceptance criteria:

- Given any required field is missing or invalid, when the Organizer attempts to publish, then publication is rejected with field-level errors.
- Given all required fields are valid, when the Organizer publishes, then the Event becomes Published.

### FR-EVT-003 — Optional Event Fields

V1 must support these optional Event fields:

- End Time
- RSVP Deadline
- Venue Map URL
- Dress Code
- Event Description / Invitation Message
- Venue / Arrival Notes
- Hero Image
- Organizer Contact Information

Acceptance criteria:

- Given an optional field is omitted, the Event can still be saved and published if all required fields are valid.
- Given optional content is present, the guest invitation may display it where defined by the guest experience specification.

### FR-EVT-004 — Event Lifecycle

V1 Event lifecycle is:

```text
Draft -> Published -> Ended
```

Rules:

- Draft Events are not guest-shareable.
- Publication is an explicit Organizer action.
- Published Events may be edited by the Organizer before Event expiration.
- Ended is derived from Event expiration.
- Ended Events are administratively read-only in V1.
- V1 does not define a separate Unpublish action.

Acceptance criteria:

- Given a Draft Event, when a Guest opens an Invitation link, then guest access is denied.
- Given a Published Event before expiration, when a Guest opens a valid active Invitation link, then the Invitation is viewable.
- Given Event expiration has passed, then the Event is treated as Ended for guest access and Organizer operational mutations are no longer permitted.

### FR-EVT-005 — Event Time Validation

Event timing must be validated in the Event Timezone.

Rules:

- RSVP Deadline, when provided, is a date and time in the Event Timezone.
- RSVP Deadline must be before Event Start.
- End Time, when provided, must be later than Start Time on the same Event Date.
- If End Time is absent, Event expiration is the end of the Event calendar date in the Event Timezone.

Acceptance criteria:

- Given RSVP Deadline is at or after Event Start, when the Organizer saves or publishes, then validation fails.
- Given End Time is at or before Start Time, when the Organizer saves or publishes, then validation fails.
- Given no End Time exists, guest access expires after the Event date ends in the Event Timezone.

### FR-EVT-006 — Ended Event Admin Read-Only

After Event expiration, the Organizer may continue to view preserved Event records and export CSV, but may not mutate Event-scoped operational data.

Allowed after Ended:

- view Event configuration;
- view dashboard metrics;
- view/search/filter Invitations;
- view current RSVPs;
- export CSV.

Not allowed after Ended:

- edit Event fields or RSVP Deadline;
- create/edit Invitations or Maximum Party Size;
- edit RSVPs;
- regenerate Invitation Tokens;
- revoke Invitations.

Acceptance criteria:

- Given an Event is Ended, when the Organizer opens its records, then view and CSV-export capabilities remain available.
- Given an Event is Ended, when the Organizer attempts any Event-, Invitation-, RSVP-, deadline-, or access-management mutation, then the server rejects the operation and committed data remain unchanged.

---

### FR-EVT-007 — Event Retention and Permanent Deletion

V1 does not automatically delete Event data on Event expiration or on a fixed application-level retention timer.

The Owner may permanently delete an Event only when the runtime Event state is:

- Draft; or
- Ended.

An active Published Event cannot be self-service deleted in V1.

Permanent Event deletion removes:

- the Event;
- its Invitations;
- current RSVPs;
- Invitation access credentials;
- the Event Hero Image.

There is no V1 recycle-bin or restore flow for a permanently deleted Event.

D-27 is an explicit exception to the ordinary Ended read-only rule in D-26.

Acceptance criteria:

- Given a Draft Event owned by the Organizer, when permanent deletion is confirmed, then the Event and its dependent Invitation/RSVP/access-credential/Hero-Image data are removed.
- Given an Ended Event owned by the Organizer, when permanent deletion is confirmed, then the Event and its dependent data are removed.
- Given an active Published Event, when the Organizer attempts self-service deletion, then the operation is rejected.
- Given a permanently deleted Event, when a former personalized Invitation URL is opened, then no private Event/Invitation data are available.
- Given Event expiration alone, then data remain preserved until Owner deletion or a verified operational erasure process.

---

## 5. Invitation Requirements

### FR-INV-001 — Create Invitation

The Organizer must be able to create Invitations for an Event.

Each Invitation must include:

- Invitee Name or household/group label;
- Maximum Party Size;
- secure Invitation Token;
- RSVP state.

Acceptance criteria:

- Given a valid Event, when the Organizer creates an Invitation with valid fields, then the Invitation is saved.
- Given an Invitation is created, then it receives a secure personalized access token.

### FR-INV-002 — Personalized Guest Link

Each Invitation must have one guest access path derived from a secure, unguessable Invitation Token.

Acceptance criteria:

- Given a valid token for a Published, unexpired, unreveoked Invitation, when the Guest opens the link, then the guest sees only that Invitation.
- Given an invalid, expired, revoked, or old regenerated token, when the Guest opens the link, then access is denied.

### FR-INV-003 — Maximum Party Size Bounds

Maximum Party Size must be an integer from 1 through 20 inclusive.

Rules:

- Empty values are invalid.
- Non-integer values are invalid.
- Values below 1 are invalid.
- Values above 20 are invalid.
- Server-side validation is required.

Acceptance criteria:

- Given Maximum Party Size is 1, when the Organizer saves, then the value is valid.
- Given Maximum Party Size is 20, when the Organizer saves, then the value is valid.
- Given Maximum Party Size is 0, 21, decimal, non-numeric, or empty, when the Organizer saves, then validation fails.

### FR-INV-004 — Maximum Party Size Reduction

The Organizer must not reduce Maximum Party Size below the currently confirmed Attendee Count.

Acceptance criteria:

- Given an Invitation has Attendee Count 3, when the Organizer tries to reduce Maximum Party Size to 2, then the change is rejected.
- Given the Organizer first updates Attendee Count to 2 or lower, when they set Maximum Party Size to 2, then the change may be accepted.

### FR-INV-005 — Regenerate Invitation Token

The Organizer must be able to regenerate an Invitation Token.

Rules:

- The old token becomes invalid immediately.
- The new token points to the same Invitation.
- RSVP and attendance data are preserved.

Acceptance criteria:

- Given a token is regenerated, when the old link is opened, then access is denied.
- Given the new link is opened and the Event/Invitation allow guest access, then the same Invitation is shown.
- Given RSVP data existed before regeneration, then it remains unchanged after regeneration.

### FR-INV-006 — Revoke Invitation

The Organizer must be able to revoke an Invitation.

Rules:

- Guest access is disabled.
- Invitation data is preserved.
- RSVP data is preserved.
- Revocation does not automatically create a replacement token.

Acceptance criteria:

- Given an Invitation is revoked, when its guest link is opened, then access is denied.
- Given an Invitation is revoked, then Organizer records and RSVP data remain visible to the Organizer.

### FR-INV-007 — Search and Filter Invitations

The Organizer must be able to:

- search Invitations by Invitee Name;
- filter Invitations by RSVP Status.

Required RSVP Status filter values:

- Awaiting Response
- Attending
- Declined

Acceptance criteria:

- Given an Invitee Name search term, the list returns matching Invitations for the current Event.
- Given an RSVP Status filter, the list returns only Invitations with that current status for the current Event.

---

## 6. RSVP Requirements

### FR-RSVP-001 — RSVP Status Values

V1 must support these RSVP statuses:

- Awaiting Response
- Attending
- Declined

Acceptance criteria:

- Given a newly created Invitation, its RSVP status is Awaiting Response.
- Given a Guest submits Attending or Declined while changes are permitted, the current RSVP status updates.

### FR-RSVP-002 — Guest May Change RSVP While Permitted

The Guest may change between Awaiting Response, Attending, and Declined while guest RSVP changes are permitted.

Acceptance criteria:

- Given RSVP changes are permitted, when a Guest changes from Attending to Declined, then the RSVP updates.
- Given RSVP changes are permitted, when a Guest changes from Declined to Attending with valid attendee details, then the RSVP updates.

### FR-RSVP-003 — Attending Requires Valid Attendee Count

When RSVP Status is Attending, Attendee Count is required and must be between 1 and the Invitation's Maximum Party Size.

Acceptance criteria:

- Given Maximum Party Size is 4, when the Guest submits Attendee Count 4, then the RSVP can be accepted.
- Given Maximum Party Size is 4, when the Guest submits Attendee Count 5, then validation fails.
- Given Attendee Count is missing, 0, decimal, or non-numeric for Attending, then validation fails.

### FR-RSVP-004 — Attendee Names Are Optional

Guests may provide 0 up to Attendee Count Attendee Names.

Rules:

- Attendee Names are optional.
- Guest does not need to provide every name.
- Names do not need to be unique.
- Number of Attendee Names must not exceed Attendee Count.

Acceptance criteria:

- Given Attendee Count is 3, when no Attendee Names are provided, then the RSVP is valid.
- Given Attendee Count is 3, when 1, 2, or 3 names are provided, then the RSVP is valid.
- Given Attendee Count is 3, when 4 names are provided, then validation fails.

### FR-RSVP-005 — Dietary Requirements and Guest Message

V1 must support:

- one optional RSVP-level Dietary Requirements field;
- one optional Guest Message field.

Dietary Requirements and Guest Message are separate fields.

Acceptance criteria:

- Given a Guest submits Dietary Requirements, then they are stored on the RSVP as catering information.
- Given a Guest submits Guest Message, then it is stored separately from Dietary Requirements.

### FR-RSVP-006 — Declined RSVP Cleanup

When an RSVP changes to Declined:

- Attendee Count becomes `0`;
- Attendee Names are cleared;
- Dietary Requirements are cleared;
- Guest Message is preserved.

Acceptance criteria:

- Given an RSVP is Attending with Attendee Count, Attendee Names, Dietary Requirements, and Guest Message, when it changes to Declined, then only Guest Message remains preserved.

### FR-RSVP-007 — Deadline Behavior

After RSVP Deadline:

- the Guest may view the Invitation;
- the Guest may view the current RSVP;
- guest RSVP submission/editing is read-only;
- the Organizer may still edit RSVP fields after the deadline only while the Event has not Ended.

If no RSVP Deadline exists, guest RSVP changes remain permitted until Event expiration.

Acceptance criteria:

- Given RSVP Deadline has passed and Event has not expired, when the Guest opens the link, then the Invitation and RSVP are viewable but RSVP controls are read-only.
- Given no RSVP Deadline exists and Event has not expired, when the Guest opens the link, then RSVP changes are permitted.

### FR-RSVP-008 — Reopen RSVP

V1 has no separate reopen switch.

The Organizer reopens guest RSVP by:

- moving RSVP Deadline into the future; or
- removing RSVP Deadline.

Event expiration still prevents guest RSVP changes.

Acceptance criteria:

- Given RSVP Deadline has passed and Event has not expired, when the Organizer moves the deadline into the future, then guest RSVP changes become permitted again.
- Given the Event is Ended, when the Organizer attempts to change RSVP Deadline, then the mutation is rejected and guest access remains unavailable.

### FR-RSVP-009 — Organizer RSVP Editing

The Organizer may edit:

- RSVP Status;
- Attendee Count;
- Attendee Names;
- Dietary Requirements.

The Organizer may not edit Guest Message in V1.

Organizer RSVP editing is available after RSVP Deadline only while the Event has not Ended.

Acceptance criteria:

- Given an active Published Event, when an Organizer edits Attendee Count within valid bounds, then the RSVP updates.
- Given an Organizer attempts to edit Guest Message, then the system prevents the edit.
- Given the Event is Ended, when the Organizer attempts to edit RSVP operational fields, then the mutation is rejected.

---

## 7. Dashboard and Reporting Requirements

### FR-DASH-001 — Dashboard Totals

The admin dashboard must show at least:

- total Invitations;
- accepted Invitations;
- declined Invitations;
- awaiting-response Invitations;
- total expected Attendees.

Acceptance criteria:

- Given multiple Invitations with different statuses, dashboard counts reflect current RSVP state.
- Given an RSVP changes, dashboard totals update to reflect the current data.

### FR-DASH-002 — Actual Attendee Count

Total expected Attendees must be calculated from current Attendee Count values on Attending RSVPs.

Rules:

- Awaiting Response contributes 0.
- Declined contributes 0.
- Attending contributes its current Attendee Count.

Acceptance criteria:

- Given Attending counts 2 and 3 plus one Declined RSVP, total expected Attendees is 5.

---

## 8. CSV Export Requirements

### FR-CSV-001 — Event-Scoped Export

The Organizer must be able to export one Event's Invitation and RSVP data to CSV.

The export must include all Invitations for that Event, including Awaiting Response Invitations.

### FR-CSV-002 — Required CSV Fields

V1 CSV export must include:

1. Invitee Name
2. RSVP Status
3. Maximum Party Size
4. Attendee Count
5. Attendee Names
6. Dietary Requirements
7. Guest Message
8. Responded At
9. Updated At

### FR-CSV-003 — CSV Exclusions

CSV export must not include:

- Invitation Tokens;
- personalized Invitation URLs;
- internal database identifiers by default.

Acceptance criteria:

- Given a CSV export is generated, then no guest access credential appears in the file.

### FR-CSV-004 — CSV Attendee Count Rules

Declined and Awaiting Response Invitations export Attendee Count as `0`.

Acceptance criteria:

- Given a Declined RSVP previously had attendance details, the exported Attendee Count is `0` and cleared attendance details are not exported.

---

## 9. Presentation Requirements

### FR-PRES-001 — Wedding-Focused Guest Experience

V1 must provide one curated wedding invitation theme.

The Organizer may customize supported Event content and optional Hero Image.

V1 must not provide organizer-facing controls for:

- fonts;
- colors;
- layout;
- animations;
- custom CSS;
- arbitrary visual theme settings.

### FR-PRES-002 — Mobile-First Guest Experience

The public Invitation experience must be usable on mobile devices without a guest account.

Acceptance criteria:

- Given a Guest opens the Invitation on a phone-sized viewport, they can understand the Event details and complete a valid RSVP.

---

## 10. Security and Access Requirements

### FR-SEC-001 — Token-Based Guest Access

Invitation Tokens are guest access credentials.

Requirements:

- tokens must be unguessable;
- guests must access only the Invitation associated with the token;
- guest access must respect Draft, Published, Ended, revoked, and regenerated states.

### FR-SEC-002 — Server-Side Validation

All business rules must be enforced server-side.

Client-side validation may improve usability but must not be the only enforcement layer.

Acceptance criteria:

- Given a client bypasses the UI and submits invalid attendee count or party-size data, the server rejects the request.

### FR-SEC-003 — Organizer Authorization

Organizer-only operations must require authentication and ownership authorization.

Acceptance criteria:

- Given an Organizer does not own an Event, they cannot view, edit, export, or manage its records.

---

### FR-SEC-004 — Organizer Provisioning and Passwordless OTP Sign-In

V1 Organizer accounts are provisioned administratively.

V1 must not expose public Organizer self-sign-up.

Organizer sign-in uses passwordless email OTP through Supabase Auth.

Rules:

- sign-in is attempted with an already provisioned Organizer email address;
- an unknown email must not automatically create an Organizer account;
- successful OTP verification establishes an authenticated Organizer session;
- password authentication, password reset/recovery, public registration, and MFA are outside V1 unless later approved.

Acceptance criteria:

- Given a provisioned Organizer email, when the correct OTP is verified, then the Organizer receives an authenticated session.
- Given an unknown email, when sign-in is attempted, then no Organizer account is automatically created.
- Given an unauthenticated user, Organizer-only Event data remain unavailable.

---

## 11. Out of Scope for V1

V1 does not include:

- drag-and-drop invitation builder;
- multiple invitation themes;
- visual theme editor;
- payment processing;
- ticket sales;
- SMS, WhatsApp, LINE, or email automation;
- seating chart;
- public event discovery;
- native mobile apps;
- attendee categories;
- Event duplication;
- collaborators or additional Organizer roles;
- full RSVP revision history;
- overnight Event timing.

---

## 12. End-to-End Acceptance Scenarios

### AS-001 — Organizer Publishes Event and Shares Invitation

Given an Organizer creates a Draft Event, completes all required fields, publishes it, creates an Invitation with Maximum Party Size 2, and copies the personalized link, when the Guest opens the link before expiration, then the Guest sees the personalized wedding Invitation.

### AS-002 — Guest Accepts Within Limit

Given an Invitation has Maximum Party Size 3, when the Guest selects Attending with Attendee Count 2 and optional details, then the RSVP is saved and dashboard expected attendees increase by 2.

### AS-003 — Guest Cannot Exceed Limit

Given an Invitation has Maximum Party Size 3, when the Guest attempts to RSVP with Attendee Count 4, then the RSVP is rejected and no invalid attendance data is stored.

### AS-004 — Guest Declines After Attending

Given a Guest previously responded Attending with Attendee Count 2, Attendee Names, Dietary Requirements, and Guest Message, when the Guest changes to Declined while changes are permitted, then Attendee Count becomes 0, Attendee Names and Dietary Requirements are cleared, and Guest Message remains.

### AS-005 — Deadline Makes Guest RSVP Read-Only

Given the RSVP Deadline has passed and the Event has not expired, when the Guest opens the Invitation, then the Invitation remains viewable but RSVP editing is read-only.

### AS-006 — Organizer Reopens RSVP

Given the RSVP Deadline has passed and the Event has not expired, when the Organizer moves the deadline into the future, then guest RSVP editing is permitted again.

### AS-007 — Revoked Invitation Denies Guest Access

Given an Organizer revokes an Invitation, when the Guest opens the link, then access is denied and the Organizer can still view preserved Invitation/RSVP records.

### AS-008 — Token Regeneration Preserves RSVP

Given an Invitation has an RSVP, when the Organizer regenerates the token, then the old link stops working, the new link opens the same Invitation, and the RSVP remains unchanged.

### AS-009 — CSV Export Excludes Credentials

Given an Organizer exports Event data to CSV, then the file includes all Invitations and approved RSVP fields, and excludes Invitation Tokens, personalized URLs, and internal database identifiers.

---

### AS-010 — Owner Deletes Draft or Ended Event

Given the Organizer owns a Draft or Ended Event, when they confirm permanent deletion, then the Event and its Invitations, current RSVPs, access credentials, and Hero Image are removed and cannot be restored through V1.

### AS-011 — Active Published Event Cannot Be Deleted

Given the Organizer owns an active Published Event, when they attempt self-service deletion, then the operation is rejected and the Event remains unchanged.

### AS-012 — Provisioned Organizer Signs In with Email OTP

Given an Organizer account was provisioned administratively, when the Organizer enters its email address and verifies the valid one-time email code, then an authenticated Organizer session is established without using a password.


## 13. Traceability

| Decision | PRD Requirements |
|---|---|
| D-01 | FR-INV-004 |
| D-02 | FR-RSVP-002 |
| D-03 | FR-RSVP-007 |
| D-04 | FR-RSVP-007, FR-RSVP-008, FR-RSVP-009 |
| D-05 | Section 11 |
| D-06 | FR-RSVP-003, FR-RSVP-004 |
| D-07 | Section 11 |
| D-08 | FR-RSVP-005 |
| D-09 | FR-EVT-004, FR-EVT-005, FR-SEC-001 |
| D-10 | FR-INV-005 |
| D-11 | FR-INV-006 |
| D-12 | FR-CSV-001, FR-CSV-002, FR-CSV-003, FR-CSV-004 |
| D-13 | FR-EVT-001, FR-EVT-002 |
| D-14 | FR-EVT-003, FR-EVT-005, FR-RSVP-007 |
| D-15 | FR-PRES-001 |
| D-16 | Section 11 |
| D-17 | Section 3, FR-SEC-003 |
| D-18 | FR-EVT-004, FR-SEC-001 |
| D-19 | FR-EVT-005 |
| D-20 | FR-RSVP-004 |
| D-21 | FR-RSVP-006 |
| D-22 | FR-RSVP-009 |
| D-23 | FR-INV-007 |
| D-24 | FR-RSVP-008 |
| D-25 | FR-INV-003, FR-RSVP-003 |
| D-26 | FR-EVT-004, FR-EVT-006, FR-RSVP-007, FR-RSVP-008, FR-RSVP-009 |
| D-27 | FR-EVT-007 |
| D-28 | FR-SEC-004 |

---

## 14. Next Step

Create:

**`03-user-flows.md`**

The User Flows document should define end-to-end organizer and guest workflows from this approved PRD.
