# 08 — Admin Dashboard Specification

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document defines the V1 Organizer/Admin experience using the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, `03-user-flows.md`, `04-technical-architecture.md`, `05-data-model.md`, `06-design-system-and-ui-foundation.md`, and `07-guest-experience-spec.md`. It must not introduce new business behavior.

---

## 1. Purpose

This document defines the V1 authenticated Organizer experience.

It specifies:

- Admin information architecture;
- Event list;
- Event creation and Draft behavior;
- Event editing;
- Event publication;
- dashboard metrics;
- Invitation list;
- Invitation search and RSVP-status filtering;
- Invitation creation and editing;
- Maximum Party Size management;
- personalized Invitation link presentation;
- Token regeneration;
- Invitation revocation;
- RSVP inspection and editing;
- Guest Message read-only behavior;
- RSVP Deadline editing/reopening;
- CSV export;
- loading, empty, success, validation, and error states;
- responsive desktop/mobile Admin behavior;
- accessibility and confirmation behavior.

This document defines Organizer-facing interaction and presentation. It does not redefine authentication implementation, database rules, token cryptography, API contracts, or security policy.

---

## 2. Admin Experience Goals

### AD-P01 — Current Event state is obvious

The Organizer should always be able to identify:

- which Event they are managing;
- whether the Event is Draft, Published, or Ended;
- whether RSVP responses are currently editable by Guests;
- current Invitation and Attendee totals.

### AD-P02 — Common tasks are close to the data

The Organizer should not need to navigate through unrelated settings to:

- create an Invitation;
- copy an Invitation link;
- inspect an RSVP;
- update attendance;
- search/filter Invitations;
- export CSV.

### AD-P03 — High-impact actions explain consequences

Token regeneration and revocation must communicate their effects before completion.

### AD-P04 — Draft and publication are distinct

The Organizer may save incomplete Draft Event data without being misled into thinking the Event is public.

### AD-P05 — Admin is responsive, not desktop-only

The Admin experience may be denser on desktop but all required V1 workflows must remain usable on narrow screens.

### AD-P06 — Business truth remains server-authoritative

UI controls may prevent obvious invalid input, but server validation and authorization remain authoritative.

---

# 3. Admin Information Architecture

V1 uses two levels of Organizer information architecture.

```text
Organizer Area
|
+-- Events
|    |
|    +-- Create Event
|    |
|    +-- Event Workspace
|         |
|         +-- Overview
|         +-- Invitations
|         +-- Event Settings
|
+-- Account / Sign out entry
```

The exact URL paths are deferred to `09-api-and-server-contracts.md` / `12-development-architecture.md`.

## 3.1 Organizer global shell

The authenticated Admin shell contains:

- product identity;
- current page/Event context;
- navigation back to Events;
- account/sign-out entry.

Organizer sign-in uses the approved passwordless email OTP flow for administratively provisioned accounts. There is no public self-sign-up in V1. Exact visual Auth-screen composition remains outside this specification.

## 3.2 Event workspace navigation

For one selected Event, V1 uses three primary destinations:

1. **Overview**
2. **Invitations**
3. **Event Settings**

Invitation detail is opened as its own focused Admin page/view from the Invitations list.

This avoids overloading the dashboard with every editing control.

---

# 4. Global Admin Header

Within an Event workspace, the top-level header shows:

```text
[Back to Events]

[Event Title]
[Draft / Published / Ended badge]

[contextual primary action]
```

Contextual action examples:

- Draft Event -> `Publish Event` when appropriate;
- Invitations -> `Create Invitation`;
- Event Settings -> normal save action remains in the form rather than header duplication.

For Published Events, do not show an Unpublish action because V1 does not support one.

For Ended Events, show the Ended state clearly, preserve view/search/export access to records, and present Event-scoped operational data as read-only.

Do not present active controls to:

- edit Event settings;
- create/edit Invitations;
- edit RSVPs;
- change RSVP Deadline;
- regenerate links;
- revoke Invitations.

CSV export and read/search/filter workflows remain available. D-27 also permits permanent deletion of the entire Ended Event as the sole self-service mutation exception.

---

# 5. Events Index

## 5.1 Purpose

The Events index is the Organizer's entry point for owned Events.

## 5.2 Page structure

```text
Events

[Create Event]

[Event list/cards]
```

Each Event summary shows at minimum:

- Event Title, when available;
- Event Date, when available;
- Event lifecycle badge;
- Venue Name, when available;
- entry action to manage the Event.

A Draft may be incomplete, so missing optional/required-to-publish fields must not render placeholder data such as `null` or `undefined`.

## 5.3 Draft Event display

A Draft badge is neutral.

If the Event is incomplete, the card may use a short UI hint such as:

```text
Setup incomplete
```

This is presentation of publication readiness, not a separate Event state.

## 5.4 Published Event display

Published badge uses the approved positive/info treatment.

## 5.5 Ended Event display

Ended badge is muted.

Admin records remain accessible.

## 5.6 Empty state

When the Organizer owns no Events:

```text
No events yet

Create your first event to start setting up invitations and RSVPs.

[Create Event]
```

Do not show Event duplication because V1 does not support it.

## 5.7 Ordering

The exact default Event ordering is not defined by approved product rules and is deferred to the server/API contract rather than invented here.

---

# 6. Create Event

## 6.1 Entry

Organizer activates:

```text
Create Event
```

## 6.2 Initial behavior

The creation experience produces a Draft Event.

The Organizer may save without completing every publication-required field.

## 6.3 Form sections

Use the same Event editor structure as Event Settings:

1. Basics
2. Date & Time
3. Venue
4. Invitation Content
5. RSVP Settings
6. Hero Image
7. Organizer Contact

The form is single-column on mobile and may place logically paired controls side-by-side on wider screens.

## 6.4 Save action

Primary action for Draft editing:

```text
Save Draft
```

Saving a valid incomplete Draft must not trigger publication.

After successful creation/save, the Organizer enters the Event workspace.

---

# 7. Event Settings

## 7.1 Basics

Fields:

- Event Type;
- Event Title;
- Wedding / Host Display Names.

V1 Event Type is `wedding`.

The UI does not expose unrelated future Event types.

## 7.2 Date & Time

Fields:

- Event Date;
- Start Time;
- optional End Time;
- Event Timezone.

Show timing validation close to the affected field.

End Time must be later than Start Time on the same Event Date.

## 7.3 Venue

Fields:

- Venue Name;
- Venue Address;
- optional Venue Map URL;
- optional Venue / Arrival Notes.

Venue Name and Venue Address are publication-required but a Draft may save without them.

## 7.4 Invitation Content

Fields:

- optional Event Description / Invitation Message;
- optional Dress Code.

The visual theme itself is not editable.

## 7.5 RSVP Settings

Field:

- optional RSVP Deadline.

Helper text communicates:

- when a deadline exists, Guest changes close after it;
- if no deadline exists, Guest changes remain allowed until Event expiration.

Do not introduce a separate "Reopen RSVP" toggle.

## 7.6 Hero Image

Admin supports:

- current Hero Image preview when present;
- upload/replace action;
- remove action.

Exact file type/size constraints are deferred to security/operations contracts.

Removing Hero Image affects presentation only and must not block publication.

## 7.7 Organizer Contact

Optional free-text Organizer Contact Information field.

The Admin UI must not infer structured phone/email behavior from this field.

---

# 8. Saving Event Settings

If the Event is Ended, Event Settings render as read-only and no Save action is available. The server must reject a direct mutation attempt.



## 8.1 Draft

Draft action:

```text
Save Draft
```

The system validates values that are present but does not require publication completeness.

## 8.2 Published

Published Event action:

```text
Save Changes
```

A successful Published edit must preserve required publication validity.

## 8.3 Validation

Examples:

```text
End Time must be later than Start Time.
RSVP Deadline must be before the Event start time.
Venue Name is required before publishing.
```

Publication-required-field errors should not be presented as blockers merely to save an incomplete Draft unless the entered value itself is invalid.

## 8.4 Success feedback

Normal Event saves may use:

```text
Saved
```

as inline/transient confirmation.

Critical validation errors must remain visible in the form.

---

# 9. Event Publication

## 9.1 Publish action

A Draft Event provides:

```text
Publish Event
```

Publication is explicit.

## 9.2 Publish validation

When activated:

1. server validates all required Event fields;
2. server validates Event timing;
3. if valid, Event becomes Published;
4. if invalid, Event remains Draft.

## 9.3 Failed publication

Display a persistent validation summary near the page action area:

```text
This event can't be published yet.
Complete the highlighted fields below.
```

Also show field-level errors in Event Settings.

The UI may provide a direct action such as:

```text
Review Event Settings
```

## 9.4 Successful publication

After success:

- lifecycle badge becomes Published;
- show persistent/clear confirmation;
- Invitation links for non-revoked Invitations may now become usable by Guests.

Do not add an Unpublish action.

---

# 10. Event Overview Dashboard

The Overview is the operational summary for one Event.

## 10.1 Header

Shows:

- Event Title;
- lifecycle badge;
- Event date/time summary;
- Venue Name;
- RSVP Deadline when configured.

## 10.2 Metric cards

Show exactly these primary V1 metrics:

1. Total Invitations
2. Attending Invitations
3. Declined Invitations
4. Awaiting Response Invitations
5. Total Expected Attendees

Definitions come from the approved PRD/data model.

## 10.3 Responsive metric layout

Mobile:

```text
1 or 2 columns depending on available width
```

Desktop:

```text
multi-column grid
```

Metric meaning must remain textual and not color-only.

## 10.4 Quick actions

While the Event is Draft or active Published, Overview may provide shortcuts to:

- Create Invitation;
- View Invitations;
- Event Settings;
- Export CSV.

For an Ended Event, mutation-oriented shortcuts are removed or non-actionable. `View Invitations` and `Export CSV` remain available.

These shortcuts do not create new capabilities.

## 10.5 No activity feed

V1 does not provide an RSVP revision history or product requirement for an activity timeline.

Do not invent a "Recent Activity" feed based on unavailable historical data.

---

# 11. RSVP Availability Summary

The Event Overview should communicate the Guest RSVP policy currently in effect.

Examples of derived display:

### No deadline, Event active

```text
Guest RSVP: Open until the event ends
```

### Future deadline

```text
Guest RSVP: Open
Deadline: [Event-local deadline]
```

### Deadline passed, Event active

```text
Guest RSVP: Closed
Deadline passed
```

### Event Ended

```text
Guest access: Ended
```

This is a derived UI summary, not a persisted additional state.

---

# 12. Reopen Guest RSVP from Admin

Because V1 has no separate reopen flag, the Admin experience reuses Event Settings.

When RSVP Deadline has passed and Event has not expired, show a contextual action near the closed RSVP summary:

```text
Change RSVP Deadline
```

This navigates/focuses RSVP Settings.

The Organizer may:

- move the deadline into the future; or
- remove the deadline.

Do not show:

```text
Reopen RSVP [toggle]
```

because that would imply a separate state that does not exist.

---

# 13. Invitations Page

## 13.1 Purpose

The Invitations page is the main Organizer workspace for personalized Invitations and current RSVP state.

## 13.2 Header / toolbar

Show:

```text
Invitations
[Create Invitation]
[Search]
[RSVP Status filter]
[Export CSV]
```

Exact visual arrangement changes responsively.

For an Ended Event:

- Search remains available;
- RSVP Status filter remains available;
- Export CSV remains available;
- `Create Invitation` is not active/presented as an available mutation.

## 13.3 Search

Search field label/placeholder should clearly indicate Invitee Name.

Example:

```text
Search by invitee name
```

V1 does not expose additional search fields.

## 13.4 RSVP Status filter

Allowed values:

- All
- Awaiting Response
- Attending
- Declined

`All` is a UI convenience representing no RSVP-status filter, not a new domain status.

No additional V1 filters are introduced.

---

# 14. Invitation List — Desktop

At desktop widths, use an accessible data-table pattern.

Recommended columns:

1. Invitee Name
2. RSVP Status
3. Maximum Party Size
4. Attendee Count
5. Access
6. Updated
7. Actions

## 14.1 Invitee Name

Primary row link navigates to Invitation detail.

## 14.2 RSVP Status

Use semantic badge:

- Awaiting Response;
- Attending;
- Declined.

## 14.3 Attendee Count

Display:

- Attending -> current Attendee Count;
- Awaiting/Declined -> `0`.

Do not substitute number of submitted Invitations for attendee total.

## 14.4 Access

Show:

- Active; or
- Revoked.

Draft/Ended access behavior is Event-level and should be communicated in Event context rather than replacing the Invitation's own revocation status.

## 14.5 Updated

Use the current RSVP `Updated At` when a response exists.

If no RSVP response update exists, display a neutral placeholder such as em dash rather than invent a timestamp.

## 14.6 Row actions

Low-risk quick action:

- Copy Link, when it represents a usable current credential action for the current UI state.

High-impact actions remain on Invitation detail to reduce accidental activation.

---

# 15. Invitation List — Mobile

On narrow screens, replace the wide table with stacked Invitation rows/cards.

Each item shows:

```text
Invitee Name
[RSVP Status] [Access status]

Attendees: X / Maximum Party Size
Updated: [time when available]

[View]
[Copy Link when appropriate]
```

Requirements:

- no horizontal scrolling;
- at least 44px action targets;
- status text remains visible;
- search/filter stays available above the list.

The mobile representation contains the same essential data as desktop, not a reduced-permission experience.

---

# 16. Invitation List Empty States

## 16.1 No Invitations

```text
No invitations yet

Create an invitation to generate a personalized guest link.

[Create Invitation]
```

## 16.2 Search/filter no results

```text
No invitations match your search or filter.

[Clear search and filters]
```

Do not show `Create Invitation` as the primary explanation for a filtered empty state when Invitations actually exist.

---

# 17. Invitation List Loading and Error

Prefer server-rendered list data.

When localized loading is required:

- use stable row/card skeletons;
- preserve search/filter toolbar.

On load failure:

```text
We couldn't load invitations.
[Try again]
```

Do not expose database details.

---

# 18. Create Invitation

## 18.1 Fields

Required:

- Invitee Name;
- Maximum Party Size.

## 18.2 Maximum Party Size

Use numeric input/select appropriate to Admin UX with range:

```text
1..20
```

Helper:

```text
Maximum number of people who can attend through this invitation.
```

## 18.3 Submit

Primary action:

```text
Create Invitation
```

On success:

- Invitation is created;
- current RSVP is Awaiting Response;
- personalized Token/link exists;
- navigate to Invitation detail or show the created Invitation detail state.

## 18.4 Draft Event notice

If the parent Event is Draft, show:

```text
This event is still a draft. The invitation link won't open for guests until the event is published.
```

The Organizer may still copy the link as already approved.

---

# 19. Edit Invitation

Invitation detail provides an editable Invitation section for:

- Invitee Name;
- Maximum Party Size.

Primary action:

```text
Save Invitation
```

## 19.1 Maximum Party Size conflict

If Organizer attempts to set the value below current confirmed Attendee Count:

```text
Maximum Party Size can't be lower than the current Attendee Count of [X].
Update the RSVP first, then lower the party size.
```

The existing RSVP must remain unchanged.

---

# 20. Invitation Detail — Structure

Use this page order:

```text
1. Invitation Header
2. Guest Link / Access
3. Invitation Details
4. Current RSVP
5. Access Management
```

## 20.1 Header

Show:

- Invitee Name;
- RSVP status badge;
- Access status;
- parent Event context.

## 20.2 Event state context

If Event is Draft:

```text
Guest link unavailable until Event is published.
```

If Event is Ended:

```text
Guest access has ended.
This event is read-only.
```

This does not erase current RSVP data. Invitation fields, RSVP fields, Token regeneration, and revocation are not editable/actionable after Ended.

---

# 21. Guest Link Section

For an Invitation that is not revoked, show the current personalized Invitation URL in a copy-oriented control.

Primary low-risk action:

```text
Copy Link
```

After copy:

```text
Invitation link copied
```

as non-blocking feedback.

Do not expose:

- token lookup hash;
- ciphertext;
- internal Invitation UUID;
- Token as a separate technical field.

## 21.1 Draft Event

The current URL may be copied, but show the Draft warning that Guest access is not yet available.

## 21.2 Ended Event

Do not present the link as usable Guest access.

The UI may retain the link field only if needed for administrative reference, but it must clearly indicate that Guest access has ended.

---

# 22. Regenerate Invitation Token

## 22.1 Entry

Action:

```text
Regenerate Link
```

## 22.2 Confirmation dialog

Title:

```text
Regenerate invitation link?
```

Required consequence text:

```text
The current link will stop working immediately. The RSVP and invitation data will be preserved.
```

Actions:

```text
Cancel
Regenerate Link
```

The confirm action is visually high-impact but should not imply data deletion.

## 22.3 Success

After successful regeneration:

- display the new current URL;
- show confirmation:

```text
A new invitation link was created. The previous link no longer works.
```

- make `Copy Link` immediately available.

## 22.4 Failure

If regeneration fails:

- keep the previous current link/state;
- do not claim that the old link was invalidated;
- show persistent/retryable error feedback.

---

# 23. Revoke Invitation

## 23.1 Entry

Action:

```text
Revoke Invitation
```

Use destructive styling because it disables Guest access.

## 23.2 Confirmation dialog

Title:

```text
Revoke this invitation?
```

Required consequence text:

```text
The guest will no longer be able to open this invitation link. The invitation and current RSVP will be preserved. No replacement link will be created.
```

Actions:

```text
Cancel
Revoke Invitation
```

## 23.3 Success

After success:

- Access status becomes Revoked;
- preserve Invitation details and RSVP;
- show persistent notice:

```text
Guest access is revoked.
```

## 23.4 After revocation

Do not show any UI action that implies V1 can restore/reactivate the revoked Invitation.

The current approved specifications do not define a restore flow.

`Regenerate Link` must not be presented as a reactivation control.

---

# 24. Current RSVP Section

The Invitation detail page shows the one current RSVP.

## 24.1 Awaiting Response

Display:

```text
Awaiting Response
Attendee Count: 0
```

Guest Message, Attendee Names, and Dietary Requirements are empty.

Admin may choose to enter a response on behalf of the Invitation using the Edit RSVP flow.

## 24.2 Attending

Display:

- Status: Attending;
- Attendee Count;
- optional Attendee Names;
- optional Dietary Requirements;
- optional Guest Message;
- Responded At;
- Updated At.

## 24.3 Declined

Display:

- Status: Declined;
- Attendee Count `0`;
- optional Guest Message;
- Responded At;
- Updated At.

Do not show stale Attendee Names or Dietary Requirements.

---

# 25. Organizer RSVP Editing

Action:

```text
Edit RSVP
```

The Organizer may edit RSVP operational data even after RSVP Deadline while the Event has not Ended.

For an Ended Event, the current RSVP is view-only and `Edit RSVP` is not available.

## 25.1 RSVP Status control

The Admin editor supports current-response management without inventing a reset-to-Awaiting operation.

Available status actions:

- Awaiting Response -> Attending;
- Awaiting Response -> Declined;
- Attending -> Declined;
- Declined -> Attending;
- keep current Attending/Declined status while editing its details.

Do **not** provide a control that resets a previously responded RSVP back to Awaiting Response, because the approved Data Model does not define reset timestamp semantics.

## 25.2 Attending

Fields:

- Status = Attending;
- Attendee Count;
- optional Attendee Names;
- optional Dietary Requirements.

Rules:

- Attendee Count `1..Maximum Party Size`;
- number of names `0..Attendee Count`.

## 25.3 Declined

Changing to Declined applies approved cleanup:

- Attendee Count -> `0`;
- Attendee Names -> cleared;
- Dietary Requirements -> cleared;
- Guest Message preserved.

Before save, show an inline consequence note if attendance-only data currently exists.

## 25.4 Guest Message

Guest Message appears in the RSVP editor/detail as:

```text
Guest Message
[read-only content]
```

The Organizer cannot edit it.

Do not render it as an enabled textarea.

## 25.5 Save

Primary action:

```text
Save RSVP
```

On success:

- current RSVP summary updates;
- dashboard totals reflect current values.

---

# 26. RSVP Edit Validation

Examples:

### Attendee Count above Maximum Party Size

```text
Attendee Count can't exceed the Maximum Party Size of [X].
```

### Too many names

```text
The number of attendee names can't exceed the Attendee Count.
```

### Maximum Party Size changed concurrently

If server-authoritative state has changed, show the current valid limit and preserve safe entered values for correction.

All validation remains server-authoritative.

---

# 27. RSVP Deadline and Organizer Editing

RSVP Deadline affects Guest editing but not the approved Organizer ability to edit after the deadline.

When deadline has passed but the Event has not Ended:

- Guest policy summary shows Closed;
- Admin `Edit RSVP` remains available according to the approved deadline-override behavior;
- `Change RSVP Deadline` remains available before Event expiration.

After Event expiration, the Event is Ended and both RSVP editing and RSVP Deadline mutation are unavailable.

Do not hide current RSVP records merely because Guest editing is closed.

---

# 28. Permanently Delete Event

Permanent Event deletion is available only when the Event is:

- Draft; or
- Ended.

It is not available for an active Published Event.

## 28.1 Entry

Use a Danger-styled action in Event Settings or an equivalent clearly separated danger area:

```text
Delete Event
```

## 28.2 Confirmation

Title:

```text
Permanently delete this event?
```

Required consequence text must explain that deletion permanently removes:

- the Event;
- Invitations;
- current RSVPs;
- Invitation access credentials;
- Hero Image.

It must also state:

```text
This cannot be undone.
```

The confirmation must identify the Event by title where available.

Actions:

```text
Cancel
Permanently Delete Event
```

## 28.3 Success

After successful deletion:

- return to the Events index;
- remove the Event from Organizer lists;
- former personalized Guest URLs no longer expose private Event data.

## 28.4 Active Published Event

Do not present `Delete Event` as an available self-service action while the Event is active Published.

A direct server attempt must be rejected.

## 28.5 Ended Event exception

For an Ended Event, ordinary editing remains read-only under D-26, but the permanent Event deletion action remains available under D-27.

---

# 29. CSV Export

## 28.1 Placement

Provide:

```text
Export CSV
```

on the Invitations page toolbar and optionally as an Overview quick action.

## 28.2 Behavior

Activation requests a server-generated Event-scoped CSV.

The file includes all Invitations, including Awaiting Response.

## 28.3 Feedback

While preparing:

```text
Preparing export…
```

On recoverable failure:

```text
We couldn't export the CSV. Please try again.
```

## 28.4 Security

Admin UI must not offer any option to add:

- Invitation Token;
- personalized Invitation URL;
- internal database ID

to the default V1 export.

---

# 30. Search / Filter Interaction

Search and RSVP Status filter may be combined.

Example:

```text
Search: "John"
Filter: Attending
```

returns matching Attending Invitations within the current Event.

## 29.1 Clear behavior

Provide an obvious way to:

- clear search;
- reset filter to All.

## 29.2 Persistence

Whether search/filter values persist across navigation or reload is a UI implementation detail and is not a business rule defined here.

---

# 31. Admin Date/Time Presentation

Use Event-local readable formatting.

Examples may resemble:

```text
21 Nov 2026
6:00 PM
```

For RSVP Deadline, include sufficient context to avoid timezone ambiguity when appropriate.

Do not display raw ISO timestamps in normal Admin UI.

Exact locale formatting is deferred until localization conventions are specified.

---

# 32. Admin Responsive Behavior

## 31.1 Desktop

Desktop uses:

- Event workspace navigation;
- multi-column metric grid;
- data table for Invitations;
- wider multi-section forms.

## 31.2 Tablet

Maintain full functionality with:

- compressed navigation;
- reduced table columns or responsive wrapping;
- single/two-column forms based on available width.

## 31.3 Mobile

Mobile Admin must support all V1 tasks.

Use:

- single-column forms;
- stacked Invitation cards instead of an unusably wide table;
- 44px targets;
- accessible menus for secondary actions;
- visible page/Event context.

Do not hide a required V1 action solely because the viewport is narrow.

---

# 33. Loading States

Prefer server-rendered Admin data.

Localized pending states:

- `Saving…`
- `Publishing…`
- `Creating…`
- `Regenerating…`
- `Revoking…`
- `Preparing export…`

Pending state should prevent accidental duplicate mutations where appropriate.

Do not clear valid input before successful persistence.

---

# 34. Success Feedback

Low-risk actions may use transient confirmation:

```text
Saved
Invitation link copied
```

High-impact actions use persistent contextual confirmation:

```text
Event published.
A new invitation link was created.
Guest access is revoked.
```

Do not rely only on a disappearing toast for security-sensitive state changes.

---

# 35. Error States

## 34.1 Validation

Show specific field/form errors.

## 34.2 Authorization

If an Organizer is not authorized for an Event, do not render another Organizer's private Event data.

Exact authorization error contract belongs to security/API specifications.

## 34.3 Unexpected mutation failure

Preserve existing committed state and show a retryable safe message.

Never expose:

- stack traces;
- service-role details;
- database messages;
- Token cryptographic fields.

---

# 36. Accessibility

The Admin UI follows WCAG 2.2 AA foundations.

Additional requirements:

- Event workspace navigation has a clear current location;
- metric cards have textual labels;
- desktop Invitation table uses semantic table structure;
- mobile Invitation cards preserve equivalent information;
- search field has an accessible label;
- RSVP Status filter has an accessible label;
- status badges include text;
- Dialog focus is trapped and returned correctly;
- destructive confirmations identify the affected Invitation;
- Guest Message read-only state is programmatically clear;
- form errors are associated with controls;
- pending/success outcomes are announced where appropriate.

---

# 37. Keyboard Behavior

All required Admin operations must be usable without pointer input where native browser interaction supports it.

Examples:

- table row links reachable by Tab;
- Copy Link control keyboard-operable;
- Dialog actions keyboard-operable;
- search/filter controls use native semantics;
- form save/publish actions reachable predictably.

Do not make a whole row clickable in a way that prevents access to separate row actions.

---

# 38. High-Impact Action Matrix

| Action | Confirmation required | Preserves RSVP | Changes Guest access |
|---|---:|---:|---:|
| Publish Event | No destructive dialog; publication validation required | Yes | Enables valid Published access |
| Regenerate Link | Yes | Yes | Old Token invalid, new Token current |
| Revoke Invitation | Yes | Yes | Disables Guest access |
| Edit RSVP | No destructive dialog by default | Updates current RSVP | No credential change |
| Export CSV | No | No mutation | No |
| Permanently Delete Event | Yes | No; Event and dependent data are deleted | Former Guest access becomes unavailable |

Changing Attending -> Declined may use the inline cleanup consequence note defined above rather than an additional modal.

---

# 39. Event/Invitation Admin State Matrix

| State | Organizer visibility | Guest-link presentation | Main Admin behavior |
|---|---|---|---|
| Event Draft | Full owned-record access | Link may be copied but clearly inactive until publication | Configure, create Invitations, publish when valid |
| Event Published | Full owned-record access | Current non-revoked link usable | Monitor/manage Event and Invitations |
| Event Ended | Records remain visible | Must not be presented as usable Guest access | Historical/operational record access |
| Invitation Active | Visible | Current link available subject to Event state | Copy/regenerate/revoke |
| Invitation Revoked | Visible with preserved RSVP | Guest access disabled | No restore flow presented |

---

# 40. Admin Acceptance Scenarios

## AD-AS-01 — Create incomplete Draft

Given an authenticated Organizer, when they create an Event with only some publication fields and save, then the Event remains Draft and the UI does not require publication completeness merely to save.

## AD-AS-02 — Publish blocked

Given a Draft Event is missing Venue Name, when the Organizer chooses Publish Event, then publication fails, the Event remains Draft, and the missing field is identified.

## AD-AS-03 — Publish succeeds

Given all required fields and valid timing, when the Organizer publishes, then the lifecycle badge becomes Published and valid Invitation links may become Guest-accessible.

## AD-AS-04 — Dashboard accuracy

Given Attending RSVPs with counts 2 and 3 plus one Declined RSVP, when the Organizer opens Overview, then Total Expected Attendees shows 5.

## AD-AS-05 — Search/filter

Given multiple Invitations, when the Organizer searches by Invitee Name and selects Attending, then the list shows Invitations matching both criteria.

## AD-AS-06 — Maximum Party Size conflict

Given Attendee Count 3, when the Organizer attempts to lower Maximum Party Size to 2, then the save fails and the UI instructs the Organizer to update RSVP first.

## AD-AS-07 — Copy Draft link

Given a Draft Event with an Invitation, when the Organizer copies its link, then the copy action succeeds but the UI clearly communicates that Guests cannot open it until publication.

## AD-AS-08 — Regenerate link

Given an active Invitation, when the Organizer confirms regeneration, then the new link is shown, the old link is identified as no longer working, and RSVP data remain visible.

## AD-AS-09 — Revoke Invitation

Given an Invitation with an RSVP, when the Organizer confirms revocation, then the Access state becomes Revoked, Guest access is disabled, and RSVP data remain visible.

## AD-AS-10 — Organizer edits Guest RSVP after deadline

Given RSVP Deadline has passed, when the Organizer edits valid operational RSVP fields, then the save may succeed while Guest Message remains read-only.

## AD-AS-11 — Reopen Guest RSVP

Given the deadline has passed and Event has not expired, when the Organizer moves the deadline into the future or removes it, then the Admin summary reflects Guest RSVP as open again without creating a separate reopen state.

## AD-AS-12 — CSV export

Given Attending, Declined, and Awaiting Response Invitations, when the Organizer exports CSV, then the server-generated export includes all approved fields and no Invitation credentials.

## AD-AS-13 — Responsive Invitation list

Given the Organizer opens Invitations on a narrow viewport, then required Invitation status/count data and management entry actions remain usable without horizontal table scrolling.

---

# 41. Traceability

| Admin area | Approved source |
|---|---|
| Organizer authentication/ownership | R-ORG, FR-SEC-003, Technical Architecture |
| Event Draft/create/edit | UF-ORG-02/03/05, FR-EVT-001/003 |
| Publication | UF-ORG-04, D-18, FR-EVT-002/004 |
| Event timing/deadline | D-19, D-24, FR-EVT-005, FR-RSVP-008 |
| Dashboard metrics | FR-DASH-001/002, UF-ORG-09 |
| Invitation creation | UF-ORG-06, FR-INV-001/003 |
| Maximum Party Size | D-01, D-25, UF-ORG-07 |
| Search/filter | D-23, UF-ORG-10 |
| RSVP edit | D-22, UF-ORG-11, FR-RSVP-009 |
| Declined cleanup | D-21, FR-RSVP-006 |
| Guest Message read-only | D-22, FR-RSVP-009 |
| Link copy | UF-ORG-08 |
| Regeneration | D-10, UF-ORG-12 |
| Revocation | D-11, UF-ORG-13 |
| CSV | D-12, UF-ORG-15 |
| Responsive/admin UI | `06-design-system-and-ui-foundation.md` |
| Current RSVP/data shape | `05-data-model.md` |
| Guest-facing state consequences | `07-guest-experience-spec.md` |
| Ended admin read-only | D-26, FR-EVT-006 |
| Event deletion | D-27, FR-EVT-007 |
| Organizer OTP sign-in | D-28, FR-SEC-004 |

---

# 42. Explicitly Deferred Admin Details

This specification does not define:

- exact Organizer authentication method or Auth-screen UI;
- exact route paths;
- Invitation deletion;
- Event duplication;
- Unpublish;
- restore/reactivate revoked Invitation;
- multiple Organizer roles;
- ownership transfer;
- full RSVP revision history;
- advanced search filters;
- sorting controls;
- pagination/infinite-scroll contract;
- bulk Invitation creation;
- bulk Invitation actions;
- automatic messaging/email/SMS delivery;
- exact image upload limits;
- exact CSV filename/encoding;
- localization/language selection;
- exact icon library.

These must not be invented during implementation.

---

# 43. Ended Event Read-Only Behavior

D-26 resolves the former OQ-ADMIN-01 with **Option A**.

After Event expiration, the Event is administratively read-only in V1.

Organizer may:

- view Event configuration;
- view dashboard metrics;
- view/search/filter Invitations;
- view current RSVPs;
- export CSV.

Organizer may not:

- edit Event fields or RSVP Deadline;
- create/edit Invitations or Maximum Party Size;
- edit RSVP operational fields;
- regenerate Invitation Tokens;
- revoke Invitations.

Mutation controls must not be presented as active operations, and direct server mutation attempts must be rejected.

---

# 44. Review Checklist

Before marking this document Approved, confirm:

- Admin navigation structure is acceptable;
- Event creation saves Draft without forcing publication completeness;
- Publish Event is explicit;
- no Unpublish action exists;
- dashboard shows the five approved metrics;
- Invitation search/filter stays within approved V1 scope;
- desktop table and mobile card behavior are acceptable;
- Maximum Party Size remains `1..20`;
- Draft links may be copied but are clearly not Guest-accessible;
- regeneration uses a consequence-confirmation dialog;
- revocation uses a destructive confirmation and no restore flow;
- Organizer RSVP editor does not make Guest Message editable;
- no reset-to-Awaiting flow was invented;
- RSVP reopening edits/removes the deadline rather than toggling a new flag;
- CSV action cannot expose credentials;
- accessibility foundation is preserved;
- Ended Event records follow D-26 read-only behavior;
- no additional product business rule was introduced.

---

# 45. Next Document

After this Admin Dashboard specification is approved, create:

**`09-api-and-server-contracts.md`**

The API and Server Contracts document should define the exact Server Actions/Route Handlers, request/response schemas, validation contracts, authorization preconditions, transaction boundaries, error codes, CSV response behavior, and idempotency/concurrency expectations needed to implement the approved Guest and Admin experiences without changing business rules.
