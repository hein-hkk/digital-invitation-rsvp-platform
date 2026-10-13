# 01 — Product Concept

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved baseline; initial open decisions resolved in `product-decisions.md`  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document refines the product direction established in `README.md`. It does not override higher-precedence specifications or approved ADRs.

---

## 1. Purpose of This Document

This document defines the product concept for the **Digital Invitation & RSVP Platform** before detailed product requirements, user flows, technical architecture, or implementation work begins.

It establishes:

- the product vision;
- the problems the platform is intended to solve;
- the primary users;
- the core value proposition;
- the main use cases;
- the product principles;
- the V1 product boundary;
- future product direction;
- explicit V1 non-goals;
- initial success criteria.

Approved product/business decisions are recorded in `product-decisions.md`. Detailed requirements, edge cases, permissions, validation behavior, and acceptance criteria belong in `02-prd.md`.

---

## 2. Product Summary

The **Digital Invitation & RSVP Platform** is a reusable web platform for creating personalized digital invitations, collecting RSVP responses, controlling party size, and tracking the actual number of expected attendees for invitation-based events.

The first production use case is a **Wedding RSVP Website** for a wedding dinner in Bangkok in November 2026.

The product is designed so the first implementation can serve one real wedding well while the underlying product model remains reusable for future event types.

The platform should eventually be capable of supporting events such as:

- weddings;
- engagement parties;
- birthday parties;
- corporate dinners;
- private events;
- other invitation-based events.

V1 remains wedding-focused and should not attempt to become a full event-management suite.

---

## 3. Product Vision

### Vision statement

Create a simple, elegant, and reusable digital invitation experience that allows organizers to invite people personally, collect reliable RSVP responses, and understand the true expected attendance without requiring guests to create accounts.

### Long-term direction

The long-term product direction is a reusable digital invitation and RSVP platform where organizers can create events, issue personalized invitations, and manage responses through a consistent system.

The platform may later support multiple event types and broader customization, but future extensibility must not make the first release unnecessarily complex.

---

## 4. Problem Statement

Traditional invitation workflows create several practical problems for organizers:

- printed invitations are harder to update after they are distributed;
- attendance responses may arrive through multiple channels;
- organizers may have to count attendees manually;
- a single invitation may represent more than one person;
- generic public RSVP forms can make it difficult to know who was actually invited;
- organizers need a reliable way to control how many people each invitation can include;
- guests should be able to respond quickly from a phone without creating an account.

For the first wedding use case, the organizer needs to send personalized links to invited friends and know:

- who has responded;
- who has accepted;
- who has declined;
- who has not yet responded;
- how many people will actually attend;
- how many attendees each invitation is allowed to include.

The product should replace ad hoc tracking with one clear invitation and RSVP workflow.

---

## 5. Primary Users

## 5.1 Organizer / Admin

The **Organizer** is an authenticated user who manages an event.

The Organizer's main goals are to:

- create and configure an event;
- create personalized invitations;
- define a maximum party size for each invitation;
- copy and share personalized invitation links;
- monitor RSVP status;
- see accurate attendee totals;
- search and filter invitations;
- manage invitation access;
- export attendance information.

The Organizer should not need to edit the database manually to operate the event.

---

## 5.2 Invitee / Guest

The **Invitee** receives a personalized invitation link.

The Invitee's main goals are to:

- open the invitation easily on a phone or desktop;
- understand the event details;
- accept or decline;
- choose an attendee count within the invitation's allowed limit;
- optionally provide additional attendee information;
- optionally provide dietary requirements or a message;
- update the RSVP through the same valid invitation link when the event's RSVP policy allows it.

The Invitee should not need to create an account.

---

## 6. Core Value Proposition

### For the Organizer

The platform provides a single place to create personalized invitations, control invitation-level party limits, collect responses, and understand the event's actual expected attendance.

### For the Invitee

The platform provides a personal, mobile-friendly invitation experience that is fast to open and easy to respond to without account creation.

### For future use

The product model is reusable enough to support additional invitation-based event types without rebuilding the RSVP system from scratch.

---

## 7. Core Product Concept

The core relationship is:

```text
Organizer
    |
    +-- Event
          |
          +-- Invitation
                  |
                  +-- Invitee
                  +-- Secure Invitation Token
                  +-- Maximum Party Size
                  +-- RSVP
                         |
                         +-- Attendance Status
                         +-- Attendee Count
                         +-- Optional Attendee Details
                         +-- Optional Dietary / Notes
```

An **Invitation** is not merely a URL.

It is the product object that represents one invited person, couple, family, household, or group.

Each Invitation:

- belongs to one Event;
- has an Invitee or household/group label;
- has a secure personalized invitation URL;
- defines a Maximum Party Size;
- can receive an RSVP;
- contributes to RSVP reporting and actual attendee totals.

This distinction is important because one accepted Invitation may represent multiple Attendees.

---

## 8. Product Principles

## 8.1 Mobile-first guest experience

The public invitation experience should be designed primarily for guests opening links from mobile messaging applications.

The experience should remain responsive and usable on larger screens.

---

## 8.2 No guest account requirement

Guests should be able to access their personalized invitation and respond without registration, login, or password management.

Invitation access is provided through the secure personalized invitation link.

---

## 8.3 Accurate attendance over simple response counting

The product must distinguish between:

- invitation response counts; and
- actual attendee counts.

A single accepted Invitation may represent multiple Attendees.

The organizer should be able to understand both.

---

## 8.4 Personalized access

The primary invitation model is personalized invitation links, not one public RSVP form shared by every guest.

Each Invitation has its own access path and its own Maximum Party Size.

---

## 8.5 Simple organizer workflow

The Organizer should be able to create, copy, monitor, and manage Invitations without technical knowledge.

The most important information should be visible quickly from the admin experience.

---

## 8.6 Server-enforced business rules

Important business rules must not rely only on client-side UI controls.

For example, an RSVP must not be accepted with an Attendee Count above the Invitation's Maximum Party Size even if a client attempts to bypass the UI.

---

## 8.7 Reusable architecture, focused product

The product model should support multiple Events and future event types.

However, V1 should remain intentionally focused on a polished wedding use case rather than implementing speculative platform features.

---

## 8.8 Explicit specification before implementation

Business behavior should be documented before it is implemented.

When a required behavior is unclear, the specification should be resolved first rather than allowing implementation code to become the accidental source of truth.

---

## 9. Primary V1 Use Cases

The following are the primary product use cases for V1.

### UC-01 — Organizer creates an event

The Organizer creates and configures the wedding event with the information required for the invitation experience.

### UC-02 — Organizer creates a personalized invitation

The Organizer creates an Invitation for an individual, couple, family, household, or group and defines its Maximum Party Size.

### UC-03 — Organizer shares an invitation

The Organizer copies the personalized invitation URL and sends it to the intended Invitee through an external communication channel.

The platform does not need to provide messaging automation in V1.

### UC-04 — Invitee views the invitation

The Invitee opens the personalized URL and sees the wedding invitation and event details.

No guest account is required.

### UC-05 — Invitee accepts

The Invitee confirms attendance and chooses an Attendee Count that does not exceed the Invitation's Maximum Party Size.

### UC-06 — Invitee declines

The Invitee records that they will not attend.

### UC-07 — Invitee updates an RSVP

The Invitee revisits the same valid personalized Invitation and may update between Attending and Declined while guest RSVP changes are permitted.

After the RSVP Deadline, the Invitation remains viewable but the guest RSVP becomes read-only. If no RSVP Deadline is configured, guest RSVP changes remain permitted until the Event expires.

The Organizer may still modify RSVPs after the deadline and may reopen guest RSVP for the Event.

### UC-08 — Organizer monitors responses

The Organizer views response status across Invitations, including accepted, declined, and awaiting-response states.

### UC-09 — Organizer views actual attendance

The Organizer views the total expected Attendee Count across accepted Invitations.

### UC-10 — Organizer manages invitation access

The Organizer can revoke or regenerate an Invitation's access.

Regeneration immediately invalidates the old token and creates a new token for the same Invitation while preserving the existing RSVP.

Revocation disables guest access without creating a replacement token and preserves the Invitation and RSVP data.

### UC-11 — Organizer exports attendance information

The Organizer exports guest / RSVP information to CSV for practical event coordination.

---

## 10. V1 Scope

V1 should include the following product capabilities:

1. Organizer authentication.
2. Event creation and editing.
3. Event information configuration.
4. Wedding-focused public invitation presentation.
5. Manual personalized Invitation creation.
6. Invitee / household naming.
7. Maximum Party Size per Invitation.
8. Secure personalized invitation URLs.
9. Copy invitation URL from the admin experience.
10. Guest access without account creation.
11. RSVP accept / decline.
12. Attendee Count selection up to the Invitation limit.
13. Optional attendee names.
14. Optional dietary requirements.
15. Optional guest message or notes.
16. RSVP updates through the same valid Invitation when allowed.
17. Event-level RSVP deadline support.
18. Admin dashboard statistics.
19. Actual attendee-count reporting.
20. Invitation search and filtering.
21. Invitation status management.
22. Invitation revocation / regeneration capability.
23. CSV export.
24. Mobile-first guest invitation experience.
25. Responsive admin dashboard.
26. Production deployment.

Detailed rules for these capabilities belong in the PRD and later specifications.

---

## 11. V1 Non-Goals

V1 should not include the following unless a later approved PRD explicitly changes the scope:

- Canva-style drag-and-drop invitation builder;
- a marketplace of many invitation themes;
- payment processing;
- ticket sales;
- SMS delivery infrastructure;
- WhatsApp automation;
- LINE automation;
- full email marketing;
- seating-chart design;
- complex organization teams or enterprise multi-tenancy;
- native iOS applications;
- native Android applications;
- public event discovery;
- social-network features;
- attendee categories such as adult / child / infant;
- Event duplication;
- shared Event administration or additional Organizer roles;
- organizer-facing visual theme editor or arbitrary visual customization.

V1 should not build features only because they may be useful someday.

---

## 12. Initial Product Experience

## 12.1 Guest experience

The first guest-facing experience is a polished wedding invitation.

The guest experience should be:

- visually appropriate for a wedding;
- mobile-first;
- easy to understand;
- fast to navigate;
- clear about event details;
- clear about RSVP status;
- clear about party-size limits;
- usable without an account.

The exact section structure, components, content hierarchy, and interaction design will be defined in `07-guest-experience-spec.md`.

---

## 12.2 Admin experience

The first admin experience should help the Organizer answer practical event questions quickly.

Examples include:

- How many Invitations exist?
- How many have accepted?
- How many have declined?
- How many have not responded?
- How many actual Attendees are expected?
- What is the Maximum Party Size for a specific Invitation?
- What did a specific Invitee respond?
- Which Invitation link should I copy?

The exact dashboard structure and workflows will be defined in `08-admin-dashboard-spec.md`.

---

## 13. Initial Metrics and Reporting Concepts

V1 should distinguish at least the following concepts:

- total Invitations;
- accepted Invitations;
- declined Invitations;
- Invitations awaiting response;
- total expected Attendees;
- Maximum Party Size per Invitation.

Example:

```text
Invitations sent:        100
Invitations responded:    72
Accepted Invitations:     61
Declined Invitations:     11
Awaiting response:        28
Actual expected Attendees: 104
```

The exact calculation rules and dashboard definitions will be specified later.

---

## 14. Future Product Direction

The product may later expand beyond the first wedding implementation.

Potential future directions include:

- additional event types;
- additional invitation themes;
- richer visual customization;
- reusable event templates;
- event duplication;
- additional organizer roles;
- richer invitation delivery workflows;
- reminders;
- additional exports;
- deeper analytics;
- attendee categories;
- more advanced event configuration;
- integrations with external services.

These items are future possibilities only.

They are not approved V1 requirements unless they are later added through the project specification process.

---

## 15. Product Constraints

The current product direction includes the following constraints:

- guest participation should not require an account;
- personalized Invitation links are the primary guest access model;
- the Organizer must be authenticated;
- each Invitation has its own Maximum Party Size;
- RSVP Attendee Count must not exceed that maximum;
- the product must report actual expected Attendees;
- the public guest experience should be mobile-first;
- the first production experience is wedding-focused;
- the system should remain reusable for multiple Events and future event types;
- V1 should stay smaller than a full invitation-design SaaS product.

---

## 16. Initial Success Criteria

V1 is successful when the Organizer can:

1. create and configure the wedding Event;
2. create personalized Invitations;
3. assign a Maximum Party Size to each Invitation;
4. copy and share each personalized invitation URL;
5. receive accepted and declined RSVP responses;
6. receive an accurate Attendee Count for accepted Invitations;
7. see RSVP status through the admin dashboard;
8. see total expected attendance;
9. search or filter invitation records;
10. export useful attendance information;
11. operate the event without manually editing database records.

V1 is successful for the Invitee when the Invitee can:

1. open a personalized Invitation easily from a phone;
2. understand the event details;
3. accept or decline without creating an account;
4. choose a valid Attendee Count;
5. complete the RSVP without confusion;
6. revisit the same valid Invitation to see or update the RSVP when allowed.

---

## 17. Portfolio Goal

This project is intended to become a professional portfolio and resume project.

The portfolio value should come from building a complete and coherent product, not merely from demonstrating individual UI screens.

The project should demonstrate:

- product thinking;
- requirements design;
- reusable domain modeling;
- secure personalized-link access;
- authentication and authorization;
- database design;
- responsive UI design;
- guest and admin workflows;
- validation;
- testing;
- deployment;
- specification-first development.

The final portfolio description must describe only functionality that is actually implemented.

---

## 18. Resolved Product Decisions

The initial set of 17 open product questions has been resolved and is recorded in **`product-decisions.md`** as D-01 through D-28.

The approved decisions cover:

- Maximum Party Size changes;
- RSVP status changes and deadline behavior;
- Organizer deadline overrides;
- current RSVP versus revision history;
- optional Attendee names;
- attendee-category scope;
- Dietary Requirements placement;
- Invitation expiration;
- token regeneration;
- Invitation revocation;
- CSV export fields and exclusions;
- required Event fields;
- optional Event fields and timing defaults;
- V1 theme customization boundaries;
- Event duplication scope;
- single-Owner Event administration;
- Event lifecycle and timing validation;
- Attendee Names cardinality and decline cleanup behavior;
- Organizer RSVP editing scope;
- V1 Invitation search/filter behavior;
- RSVP reopening behavior.

The PRD must translate these approved decisions into explicit, testable product requirements.

Any new product question discovered while writing the PRD must be resolved explicitly rather than inferred by implementation.

---

## 19. Out of Scope for This Document

This Product Concept intentionally does not define:

- exact database tables;
- API endpoints;
- server actions;
- route structure;
- exact token format;
- token-storage implementation;
- authorization implementation;
- exact technical enforcement of RSVP deadline rules;
- exact technical implementation of invitation revocation/regeneration;
- exact CSV serialization/escaping details;
- exact UI components;
- final visual design;
- test framework;
- repository structure;
- deployment details.

Those belong in later project documents.

---

## 20. Next Document

The Product Concept is now an approved baseline, and the initial open product decisions are recorded in `product-decisions.md`.

Create:

**`02-prd.md`**

The PRD should convert this Product Concept and D-01 through D-28 into explicit, testable product requirements, permissions, validation rules, edge cases, and acceptance criteria.

No new unresolved business rule should be silently decided by implementation code.
