# 07 — Guest Experience Specification

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document defines the V1 public Guest Invitation experience using the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, `03-user-flows.md`, `04-technical-architecture.md`, `05-data-model.md`, and `06-design-system-and-ui-foundation.md`. It must not introduce new business behavior.

---

## 1. Purpose

This document defines the exact V1 Guest experience for a personalized wedding Invitation.

It specifies:

- page hierarchy;
- personalized Invitee context;
- Event detail presentation;
- Hero Image behavior;
- RSVP entry and editing;
- Attending and Declined interaction;
- Attendee Count and optional Attendee Names;
- Dietary Requirements and Guest Message;
- RSVP confirmation;
- read-only behavior after RSVP Deadline;
- venue/map interaction;
- optional Event content;
- loading, validation, success, and error states;
- invalid, obsolete, revoked, Draft, and Ended access states;
- mobile and desktop responsive behavior;
- accessibility and motion requirements.

This document defines Guest-facing behavior and presentation only. It does not redefine product rules, database behavior, authorization, or API contracts.

---

## 2. Guest Experience Goals

### GX-P01 — Immediate recognition

Within the first viewport, the Invitee should understand:

- this is a wedding Invitation;
- who is hosting;
- that the Invitation is personalized for them;
- the Event date;
- the primary RSVP action when RSVP changes are permitted.

### GX-P02 — Low-friction RSVP

A Guest should be able to complete a normal RSVP comfortably on a phone without an account.

### GX-P03 — Party-size clarity

The UI must make the Invitation's Maximum Party Size understandable before the Guest submits an Attending response.

### GX-P04 — Calm presentation

The Invitation should feel like an invitation first and a form second.

### GX-P05 — Current-state clarity

A returning Guest should immediately understand their current RSVP and whether it can still be changed.

### GX-P06 — Privacy-safe unavailable states

Guest access failure states must not expose private Event, Invitee, RSVP, or token information.

---

# 3. Guest Page State Model

The public Guest route resolves into one of these high-level UI states:

```text
Loading / resolving access
          |
          v
   Access evaluation
      /         \
     /           \
Unavailable     Accessible
                 |
                 +--> RSVP editable
                 |
                 +--> RSVP read-only
```

Accessible RSVP state may be:

```text
Awaiting Response
Attending
Declined
```

The Guest UI must derive its state from server-authorized data rather than browser assumptions.

---

# 4. Accessible Invitation Page Hierarchy

For a valid, accessible Invitation, use this V1 hierarchy:

```text
1. Personalized Intro / Hero
2. Event Summary
3. Invitation Message (optional)
4. RSVP Section
5. Venue / Map
6. Additional Event Details (optional)
7. Organizer Contact (optional)
8. Footer
```

This order keeps the RSVP prominent while still letting the Guest understand the Event before responding.

On desktop, sections may use more generous spacing and wider Hero media, but the semantic order remains the same.

---

# 5. Personalized Intro / Hero

## 5.1 Content order

The Guest intro should present:

1. small invitation context;
2. Host Display Names;
3. personalized Invitee Name;
4. Hero Image when configured;
5. primary RSVP anchor action when RSVP changes are permitted.

Conceptual presentation:

```text
You're invited

[Host Display Names]

For
[Invitee Name]

[Optional Hero Image]

[RSVP]
```

The exact warm prose may be refined in implementation/content review, but canonical domain meaning must remain clear.

## 5.2 Invitee Name

Display `invitee_name` as the recipient/household/group label.

The UI must not imply that every named person is confirmed as attending.

Example:

```text
For
John & Family
```

is personalized Invitation context, not attendance data.

## 5.3 Host Display Names

Host Display Names are the primary wedding display heading and use the Guest serif display typography.

If multiple names are stored, the Guest renderer presents them in a natural display composition without changing the underlying values.

Exact punctuation/joining is a content-formatting detail, not a new domain field.

## 5.4 Primary RSVP anchor

When Guest RSVP changes are permitted, the Hero includes a primary action:

```text
RSVP
```

Activation scrolls/focuses the RSVP section.

When RSVP is read-only after deadline, the Hero does not present an edit-oriented primary RSVP action.

---

# 6. Hero Image

## 6.1 Presence

Hero Image is optional.

When present:

- place it within or directly after the personalized Hero introduction;
- load it responsively;
- reserve stable layout space to reduce layout shift;
- use private authorized/signed image access as defined by Technical Architecture.

## 6.2 Aspect ratio

V1 Guest composition uses a portrait-friendly responsive frame:

```text
mobile: approximately 4:5
desktop: may expand up to approximately 3:2 / editorial crop
```

The implementation may use responsive `object-cover`.

The source image is not a required data field, and cropping must never affect access to Event information.

## 6.3 No-image state

When no Hero Image exists:

- omit the media frame entirely;
- keep the Hero composition centered and complete;
- do not show a placeholder box.

## 6.4 Accessibility

The V1 Hero Image is treated as **decorative presentation media** because all essential Event information is rendered as text nearby.

Use empty alternative text:

```html
alt=""
```

Organizers must not rely on text embedded inside the Hero Image to communicate essential Event information.

This avoids requiring a new image-alt database field that is not present in the approved V1 data model.

## 6.5 Image load failure

If the image fails to load:

- remove/collapse the broken media presentation;
- retain the complete textual Invitation;
- do not block RSVP.

---

# 7. Event Summary

The Event Summary appears near the top of the Invitation and must present:

- Event Date;
- Start Time;
- optional End Time;
- Venue Name;
- Venue Address.

## 7.1 Date and time

Display human-readable Event-local date/time.

Do not display raw ISO values.

If End Time exists, it may be shown as a range.

Example structure:

```text
Saturday, 21 November 2026
6:00 PM – 9:00 PM
```

Exact locale-specific formatting remains deferred until localization conventions are defined.

## 7.2 Venue

Display:

```text
Venue Name
Venue Address
```

Venue details remain readable without an external map link.

## 7.3 RSVP Deadline prompt

If an RSVP Deadline exists and Guest changes are still permitted, show a concise prompt near the RSVP section or Event Summary:

```text
Please RSVP by [deadline]
```

The deadline is displayed in the Event Timezone.

If no deadline exists, do not invent a deadline message.

---

# 8. Invitation Message

If `invitation_message` exists:

- render it as a distinct editorial text section;
- preserve paragraph breaks;
- keep line length comfortable;
- do not treat the content as HTML supplied by the Organizer.

If absent, omit the section completely.

The message must not replace structured Date, Time, Venue, or RSVP information.

---

# 9. RSVP Section — Overview

The RSVP section is the primary interaction area.

Use a visually distinct but calm surface within the Guest reading column.

Conceptual hierarchy:

```text
RSVP

[Current status / prompt]

[Attending] [Declined]

Conditional form fields

[Submit RSVP / Save Changes]
```

For a returning responded Guest, the default presentation is a **saved-response summary** rather than immediately opening a full editing form.

---

# 10. RSVP — Awaiting Response

When current RSVP status is `Awaiting Response` and Guest changes are permitted:

## 10.1 Prompt

Show:

```text
Will you be attending?
```

## 10.2 Status selection

Use two large accessible radio-card choices:

```text
Attending
Declined
```

Requirements:

- use native radio semantics;
- no option selected by default;
- selection is clear via text, border/state, and radio state;
- keyboard operation works with standard radio behavior.

## 10.3 Submission

The form does not submit until the Guest explicitly activates the primary action.

The primary action is:

```text
Submit RSVP
```

If no status is selected, submission produces an associated validation message.

---

# 11. RSVP — Attending Form

When the Guest selects `Attending`, show these fields in order:

```text
1. Attendee Count
2. Attendee Names (optional)
3. Dietary Requirements (optional)
4. Guest Message (optional)
5. Submit RSVP / Save Changes
```

---

## 11.1 Attendee Count

Label:

```text
How many people will attend?
```

Helper text:

```text
This invitation is for up to [Maximum Party Size] people.
```

Use an accessible native/select-style control with options:

```text
1 ... Maximum Party Size
```

Initial Awaiting Response state uses a blank prompt such as:

```text
Select number of attendees
```

For an existing Attending RSVP, preselect the current Attendee Count.

Do not present values above Maximum Party Size.

Server validation remains authoritative.

---

## 11.2 Optional Attendee Names

Label/heading:

```text
Attendee names
Optional
```

Helper:

```text
You can add names for some or all attendees.
```

No names are required.

### Interaction

Start with no name inputs unless existing RSVP names are present.

Provide:

```text
Add attendee name
```

Each activation adds one optional text input, up to current Attendee Count.

Existing names render as editable inputs while RSVP changes are allowed.

Each row supports removing that optional name.

Example:

```text
Attendee name 1
[________________]

Attendee name 2
[________________]

[+ Add attendee name]
```

### Count decreases

If the Guest reduces Attendee Count below the number of currently populated Attendee Name inputs:

- do not silently discard entered names;
- keep the temporary form values visible;
- show a validation message explaining that the number of names must not exceed Attendee Count;
- require the Guest to remove extra names or raise Attendee Count before successful submission.

This is a form-state behavior; the persisted RSVP invariant remains unchanged.

---

## 11.3 Dietary Requirements

Show only when the selected/current status is `Attending`.

Label:

```text
Dietary requirements
Optional
```

Use a textarea.

Helper copy should clarify that it applies to the RSVP as a whole, not to a specific individual attendee.

Do not create per-Attendee dietary controls.

---

## 11.4 Guest Message

Show for both Attending and Declined responses.

Label:

```text
Message for the hosts
Optional
```

Use a textarea.

This field remains separate from Dietary Requirements.

---

# 12. RSVP — Declined Form

When the Guest selects `Declined`:

- hide Attendee Count;
- hide Attendee Names;
- hide Dietary Requirements;
- keep Guest Message available.

Before saving a change from an existing Attending response to Declined, show a concise inline note:

```text
Changing to Declined will remove the attendee count, attendee names, and dietary requirements from your RSVP.
```

This communicates approved cleanup behavior without adding a new confirmation requirement.

Primary action:

```text
Submit RSVP
```

or, for an existing response:

```text
Save Changes
```

After successful persistence, the resulting state is Declined with the approved cleanup behavior.

---

# 13. Saved RSVP Confirmation State

After a successful RSVP submission/update, replace the editable form with a persistent saved-response summary.

## 13.1 Success heading

Use a clear success message such as:

```text
Your RSVP has been saved.
```

Do not use a transient toast as the only confirmation.

## 13.2 Attending summary

Show:

```text
Attending
[Attendee Count] attending

[Attendee Names, if provided]
[Dietary Requirements, if provided]
[Guest Message, if provided]
```

The summary must not imply that missing optional names are an error.

## 13.3 Declined summary

Show:

```text
Declined

[Guest Message, if provided]
```

Do not show stale attendance or dietary fields.

## 13.4 Update action

While Guest changes are permitted, show:

```text
Update RSVP
```

Activating it switches the RSVP section into editable mode with current saved values.

---

# 14. Returning Guest

When a responded Guest returns through the same current valid Invitation link before the deadline/expiration:

1. show the normal Invitation;
2. show the current saved RSVP summary;
3. show `Update RSVP`;
4. do not force the Guest back into editing mode automatically.

This makes the current state clear and reduces accidental edits.

---

# 15. Read-Only RSVP After Deadline

When the RSVP Deadline has passed but Event access remains valid:

## 15.1 Invitation visibility

The full accessible Invitation remains visible.

## 15.2 RSVP alert

At the RSVP section, show a persistent informational state:

```text
RSVP changes are now closed.
```

If a deadline exists, the UI may also show:

```text
The RSVP deadline was [deadline].
```

## 15.3 Existing response

If current status is Attending or Declined:

- show the saved RSVP summary;
- remove/hide `Update RSVP`;
- do not render editable RSVP controls.

## 15.4 Awaiting Response

If status is Awaiting Response:

- show `Awaiting Response`;
- show that RSVP changes are closed;
- do not render submit controls.

The Guest can still read Event details until Event expiration.

---

# 16. RSVP Reopened

No special "reopened" UI state exists.

If the Organizer moves RSVP Deadline into the future or removes it before Event expiration:

- the next authorized Guest render derives that RSVP editing is permitted;
- a responded Guest again sees `Update RSVP`;
- an Awaiting Response Guest again sees the RSVP form.

Do not show or persist a separate "reopened" badge/flag.

---

# 17. Venue and Map Section

Always show Venue Name and Venue Address for a valid Published Event because they are required for publication.

If `venue_map_url` exists, show a secondary action:

```text
View on Map
```

Behavior:

- opens the external map destination;
- visually indicates external navigation where appropriate;
- does not expose an empty button when URL is absent.

Venue / Arrival Notes, when present, appear immediately after venue information.

---

# 18. Additional Event Details

Optional Event details use discrete text rows/sections rather than blank placeholders.

## 18.1 Dress Code

When present:

```text
Dress Code
[free-text value]
```

## 18.2 Venue / Arrival Notes

When present, preserve paragraph breaks.

## 18.3 Organizer Contact Information

When present, display near the practical information/footer area under a heading such as:

```text
Questions?
```

Render the stored content as text unless a later approved specification defines structured contact types.

Do not infer phone/email behavior from the string.

---

# 19. Footer

The Guest footer should be visually quiet.

It may repeat Host Display Names or a short fixed closing treatment, but must not introduce new Event content.

Do not expose:

- internal IDs;
- Organizer/admin links;
- Invitation Token value as visible text;
- technical debugging information.

---

# 20. Validation Presentation

Validation follows the approved design-system form foundation.

## 20.1 Status missing

Example:

```text
Choose Attending or Declined.
```

## 20.2 Attendee Count missing/invalid

Examples:

```text
Select how many people will attend.
```

If server state changed and a value now exceeds the current limit:

```text
This invitation allows up to [Maximum Party Size] attendees.
```

## 20.3 Too many names

Example:

```text
You have more attendee names than the selected attendee count.
```

## 20.4 Server-authoritative conflict

If a save fails because the Invitation/Event state changed after the page rendered:

- preserve Guest-entered values where safe;
- show a form-level message;
- re-render current authorized state;
- never claim success.

Examples include:

- deadline passed during editing;
- Invitation revoked;
- Event expired;
- Token regenerated;
- Maximum Party Size reduced before submission.

Exact server error codes belong to `09-api-and-server-contracts.md`.

---

# 21. Submission Pending State

When RSVP submission is in progress:

- disable duplicate submit activation;
- change the primary action to a pending state such as `Saving…`;
- keep form values visible;
- do not clear the form;
- preserve layout width to avoid button shift.

If submission fails, restore the actionable state.

---

# 22. Unexpected RSVP Save Error

If an unexpected recoverable server error occurs:

```text
We couldn't save your RSVP. Your previous response has not been changed. Please try again.
```

Do not surface technical details.

If no previous response exists, omit the sentence asserting a previous response.

The implementation may refine wording while preserving this meaning.

---

# 23. Initial Page Loading

The Guest page is server-first.

Preferred behavior:

- render authorized Invitation content with the initial server response;
- avoid a mandatory full-screen client spinner;
- use localized skeleton/loading treatment only for genuinely deferred media or interaction.

Do not display private Event details while access validation is unresolved.

---

# 24. Unavailable Invitation States

The Guest route must handle these states:

- invalid Token;
- obsolete Token after regeneration;
- Draft Event;
- revoked Invitation;
- Ended Event.

## 24.1 Privacy principle

Unavailable pages do not show:

- Invitee Name;
- Host Display Names;
- Event Date;
- venue;
- RSVP;
- Maximum Party Size;
- any other private Invitation content.

## 24.2 Invalid / obsolete / revoked / Draft

Use one privacy-safe generic presentation:

```text
Invitation unavailable

This invitation link is not available.
Please contact the person who shared it with you if you need help.
```

The UI should not reveal whether the cause was:

- invalid Token;
- old regenerated Token;
- revocation;
- Draft Event.

This reduces unnecessary access-state disclosure.

## 24.3 Ended Event

For a valid Token whose Event has ended, use:

```text
Invitation unavailable

This invitation is no longer available.
```

Do not show Event details after expiration.

The implementation may use the same fully generic unavailable page for all unavailable states if the security specification prefers stronger uniformity.

---

# 25. Invalid Map or Optional Content Failure

Optional Guest content failure must not block core RSVP use.

Examples:

- Hero Image fails -> omit image presentation.
- External map navigation fails after leaving the app -> core Invitation remains unaffected.
- Optional content is null -> section is omitted.

Do not render empty headings or placeholder values for missing optional Event fields.

---

# 26. Mobile Layout

The Guest experience is mobile-first.

## 26.1 Base layout

On narrow screens:

- single-column flow;
- `16px` horizontal page gutter;
- primary content within full available width;
- RSVP surface spans content width;
- touch targets at least `44px`;
- no horizontal scroll.

## 26.2 Hero

Host Display Names may use `display-xl` but must wrap gracefully.

Invitee Name and Event details must remain visible without requiring interaction.

## 26.3 RSVP

RSVP fields stack vertically.

Radio-card choices may use two equal columns only when both choices retain adequate touch size; otherwise stack.

## 26.4 Mobile keyboard

Text inputs/textarea must remain visible when the software keyboard opens.

Do not pin a persistent bottom action bar that obscures RSVP form fields in V1.

---

# 27. Tablet and Desktop Layout

At wider widths:

- preserve the same semantic order;
- center Guest reading/form content up to the approved max width;
- allow Hero Image to use the wider media max width;
- increase whitespace rather than dramatically increasing UI density.

Do not turn the Guest page into a multi-column dashboard.

A desktop composition may place compact Event Summary values in a balanced row/grid, but RSVP interaction remains in a focused reading/form column.

---

# 28. Motion

Use restrained motion only.

Permitted:

- subtle Hero/section entrance;
- RSVP form conditional-field transition;
- saved-summary transition;
- button micro-interaction.

Do not animate:

- status changes in a way that obscures confirmation;
- the RSVP form before it can be used;
- page scrolling automatically beyond a user-triggered RSVP anchor.

Under `prefers-reduced-motion: reduce`, remove non-essential movement.

---

# 29. Accessibility Requirements

In addition to the Design System baseline:

- personalized intro uses semantic heading structure;
- RSVP status selector is a labeled radio group;
- conditional fields remain in logical DOM order;
- `Add attendee name` is a real button;
- every attendee-name input has a unique accessible label;
- save validation errors are associated with relevant controls;
- successful RSVP save is announced with an appropriate status/live region;
- deadline read-only state is conveyed in text;
- unavailable states use a clear page heading;
- Hero Image uses empty alt because essential content is textual;
- map action has an accessible name that identifies it as map navigation.

---

# 30. Guest Content Rendering Rules

Organizer-entered free text must be rendered safely.

Requirements:

- render as text, not arbitrary HTML;
- preserve intended paragraph/line breaks where appropriate;
- escape unsafe markup;
- linkification behavior is not assumed unless later specified.

Applies to:

- Invitation Message;
- Venue / Arrival Notes;
- Dress Code;
- Organizer Contact Information;
- Dietary Requirements;
- Guest Message.

Guest Message and Dietary Requirements shown back to the Guest are treated as text.

---

# 31. Sensitive URL Handling

The personalized URL contains a credential.

Guest-facing UI must not:

- display the raw Token separately;
- encourage copying Token text outside the URL;
- include the personalized URL in page-visible diagnostics;
- include it in social metadata;
- expose it through client logging.

Technical log/redaction requirements are finalized in `10-security-and-privacy.md`.

---

# 32. SEO and Social Metadata

Personalized Invitation pages are private-by-link, not public landing pages.

Requirements:

```text
noindex
nofollow
```

Do not include personalized Invitee Name, RSVP state, Token, or private Event details in public social preview metadata.

If generic metadata is used, it must not reveal personalized content.

---

# 33. State Matrix

| Access / RSVP condition | Event details | RSVP summary | Editable form | Primary RSVP action |
|---|---:|---:|---:|---:|
| Valid, editable, Awaiting Response | Yes | Awaiting prompt | Yes | Yes |
| Valid, editable, Attending | Yes | Yes | On `Update RSVP` | Update action |
| Valid, editable, Declined | Yes | Yes | On `Update RSVP` | Update action |
| Valid, after deadline, Awaiting Response | Yes | Awaiting + closed notice | No | No |
| Valid, after deadline, Attending | Yes | Yes + closed notice | No | No |
| Valid, after deadline, Declined | Yes | Yes + closed notice | No | No |
| Draft | No private details | No | No | No |
| Invalid/obsolete Token | No private details | No | No | No |
| Revoked | No private details | No | No | No |
| Ended | No private details | No | No | No |

---

# 34. Guest Acceptance Scenarios

## GX-AS-01 — Open valid Invitation on mobile

Given a valid current Token for a Published unexpired Event, when the Guest opens the link on a phone, then the Guest can identify the hosts, their personalized Invitee context, Event date/time/venue, and RSVP entry without an account.

## GX-AS-02 — Attending with no names

Given Maximum Party Size `3`, when the Guest chooses Attending, selects `2`, provides no names, and submits valid optional fields, then the RSVP succeeds and the saved summary shows `2` attending without requiring names.

## GX-AS-03 — Attending with partial names

Given Attendee Count `3`, when the Guest provides one Attendee Name, then the RSVP may be saved.

## GX-AS-04 — Too many names

Given Attendee Count `2`, when the form contains three attendee names, then the Guest receives validation and the invalid state is not persisted.

## GX-AS-05 — Decline clears attendance-only fields

Given an existing Attending RSVP with names and Dietary Requirements, when the Guest changes to Declined and saves, then the summary shows Declined, attendance-only fields are absent, and Guest Message remains when previously present.

## GX-AS-06 — Returning responded Guest

Given an editable Attending or Declined RSVP, when the Guest returns, then the saved-response summary is visible and `Update RSVP` is available.

## GX-AS-07 — Deadline read-only

Given RSVP Deadline has passed but Event has not expired, when the Guest opens the Invitation, then Event details and current RSVP are visible, a closed notice is shown, and no RSVP editing action is available.

## GX-AS-08 — Reopened RSVP

Given the Organizer moves the deadline into the future or removes it before expiration, when the Guest returns, then RSVP editing is available again without a separate reopened state.

## GX-AS-09 — Old regenerated Token

Given Token regeneration occurred, when the Guest opens the old link, then the generic unavailable page appears and private Invitation content is not shown.

## GX-AS-10 — Revoked Invitation

Given an Invitation is revoked, when the Guest opens its link, then the generic unavailable page appears and private Invitation content is not shown.

## GX-AS-11 — Ended Event

Given Event expiration has passed, when the Guest opens the personalized link, then no Event/RSVP details are shown and the Invitation is unavailable.

## GX-AS-12 — Deleted Event Invitation URL

Given the Owner permanently deleted a Draft or Ended Event, when a former personalized Invitation URL is opened, then no private Event/Invitation data are shown and the Invitation is unavailable.

## GX-AS-13 — No Hero Image

Given a valid Invitation has no Hero Image, when the page renders, then the intro remains visually complete without a blank media placeholder.

---

# 35. Traceability

| Guest Experience area | Approved source |
|---|---|
| Valid Guest access | UF-GUEST-01, FR-INV-002, FR-SEC-001 |
| Mobile-first presentation | FR-PRES-002, DS-P01 |
| Personalized Invitee context | Product Concept, UF-GUEST-01 |
| Event details | FR-EVT-002/003, UF-GUEST-01 |
| Hero Image | D-14, TA-06, Design System Section 19 |
| Attending | UF-GUEST-02, FR-RSVP-003/004/005 |
| Declined | UF-GUEST-03, FR-RSVP-006 |
| RSVP update | UF-GUEST-04/05/06, D-02 |
| Deadline read-only | UF-GUEST-07, D-03, FR-RSVP-007 |
| RSVP reopening | UF-GUEST-08, D-24 |
| Token regeneration unavailable state | UF-GUEST-09, D-10 |
| Revoked unavailable state | UF-GUEST-10, D-11 |
| Event expiration | UF-GUEST-11, D-09 |
| Maximum Party Size | D-25, FR-INV-003 |
| Optional names | D-06, D-20 |
| Dietary Requirements | D-08 |
| Guest Message | D-08, D-21 |
| Design tokens/accessibility | `06-design-system-and-ui-foundation.md` |
| Private/no-store page | TA-07 |

---

# 36. Explicitly Deferred Guest Details

This document does not define:

- localization language selection;
- exact locale/date-format configuration;
- custom Organizer-written Hero Image alt text;
- calendar-file downloads;
- social sharing controls;
- Guest account creation;
- public Event pages;
- message/contact linkification;
- animation customization;
- per-Attendee dietary controls;
- attendee categories;
- seating information;
- restore-revoked behavior.

These must not be introduced during implementation without specification changes where required.

---

# 37. Review Checklist

Before marking this document Approved, confirm:

- section order is acceptable;
- personalized Invitee Name is clearly invitation context, not attendance;
- RSVP status uses accessible radio semantics;
- Attendee Count uses values only within current Maximum Party Size;
- names remain optional and may be fewer than Attendee Count;
- reducing count does not silently discard typed names;
- Dietary Requirements show only for Attending;
- Guest Message is available for both response statuses;
- changing to Declined communicates cleanup and preserves Guest Message;
- successful RSVP receives persistent confirmation;
- returning Guests see saved state before edit mode;
- deadline state is read-only, not inaccessible;
- reopened RSVP derives from current deadline;
- no-image state remains complete;
- invalid/obsolete/revoked/Draft states do not leak private information;
- Ended state exposes no Event/RSVP details;
- mobile RSVP requires no horizontal scrolling;
- WCAG 2.2 AA foundation is preserved;
- no new business rule has been introduced.

---

# 38. Next Document

After this Guest Experience specification is reviewed and approved, create:

**`08-admin-dashboard-spec.md`**

The Admin Dashboard specification should define the Organizer information architecture, Event list/detail management, dashboard metrics, Event editing/publication, Invitation list/search/filter, Invitation creation/editing, RSVP editing, link copy/regeneration/revocation, CSV export, responsive admin states, and confirmation/error behavior without changing approved business rules.
