# Digital Invitation & RSVP Platform

> **Status:** Planning / Specification Phase  
> **Initial use case:** Wedding RSVP Website  
> **Development approach:** Specification-first, then Codex-assisted implementation

---

## 1. Project Overview

The **Digital Invitation & RSVP Platform** is a reusable web platform for creating personalized digital invitations, collecting RSVP responses, controlling party size, and managing actual attendee counts.

The first production use case is a **Wedding RSVP Website** for a wedding dinner in Bangkok in November 2026.

The platform is intentionally designed beyond a single wedding so that it can later support other event types such as:

- Weddings
- Engagement parties
- Birthday parties
- Corporate dinners
- Private events
- Other invitation-based events

The first release will stay focused on a polished wedding experience while keeping the underlying architecture reusable.

---

## 2. Product Direction

### Product name

**Digital Invitation & RSVP Platform**

### Initial vertical

**Wedding RSVP Website**

### Core idea

An organizer creates an event and generates a personalized invitation for each person, couple, family, or group.

Each invitation:

- has a secure personalized URL;
- belongs to one event;
- has a recipient or household name;
- defines a maximum allowed party size;
- can collect one current RSVP response;
- can be revisited so the guest can update the RSVP when allowed.

The organizer can then see both:

- the number of invitations that accepted or declined; and
- the actual number of attendees expected at the event.

---

## 3. Primary Users

### Organizer / Admin

The organizer manages the event, invitation links, guest limits, RSVP responses, and attendance information.

Typical organizer actions include:

- create and edit an event;
- configure event details;
- create personalized invitations;
- define maximum attendee count per invitation;
- copy personalized invitation links;
- view RSVP status;
- view actual attendee totals;
- search and filter invitations;
- edit guest information when necessary;
- revoke or regenerate invitation links;
- export attendance data to CSV.

### Invitee / Guest

The guest receives a personalized invitation link and does not need an account.

Typical guest actions include:

- open the invitation from a phone or desktop;
- view event details;
- accept or decline;
- select the number of attendees within the invitation limit;
- optionally provide attendee names;
- optionally provide dietary requirements or a message;
- update the RSVP through the same valid invitation link until the RSVP policy prevents further changes.

---

## 4. Core Domain Model

The platform should use consistent terminology.

```text
Organizer
   |
   +-- Event
         |
         +-- Invitations
         |      |
         |      +-- Recipient / Household
         |      +-- Secure Invitation Token
         |      +-- Maximum Party Size
         |      +-- RSVP
         |             |
         |             +-- Attendance Status
         |             +-- Attendee Count
         |             +-- Attendee Details
         |             +-- Dietary / Notes
         |
         +-- Event Configuration
```

### Canonical terminology

Use these terms consistently across product documentation, source code, APIs, database tables, UI copy, and tests.

- **Organizer** — authenticated person who manages an event.
- **Event** — a wedding or other invitation-based event.
- **Invitation** — one personalized invitation issued to a person, couple, household, family, or group.
- **Invitee** — the primary recipient of an invitation.
- **Invitation Token** — secure, unguessable token used to access one invitation.
- **Maximum Party Size** — maximum number of people allowed to attend through one invitation.
- **RSVP** — the current response associated with an invitation.
- **Attendee** — one person who will actually attend.
- **Attendee Count** — actual number of people attending under one accepted invitation.
- **RSVP Deadline** — event-specific deadline after which guest changes may be restricted.

Avoid introducing alternate terms such as `participant`, `recipient`, `party`, or `guest record` as domain-model replacements unless a later specification or ADR explicitly defines them.

---

## 5. V1 Scope

The first production release should include:

1. Organizer authentication.
2. Create and edit an event.
3. Configure event information.
4. Wedding-focused invitation presentation.
5. Create invitations manually.
6. Set invitee / household name.
7. Set maximum party size per invitation.
8. Generate secure personalized invitation URLs.
9. Copy invitation URLs from the admin dashboard.
10. Guest access without account creation.
11. RSVP accept / decline.
12. Select attendee count up to the invitation maximum.
13. Optional attendee names.
14. Optional dietary requirements.
15. Optional guest message or notes.
16. Allow guest RSVP updates through the same valid invitation link.
17. Event-level RSVP deadline behavior.
18. Admin dashboard statistics.
19. Actual attendee-count reporting.
20. Invitation search and filtering.
21. Invitation status management.
22. Revoke or regenerate invitation access.
23. Export guest / RSVP data to CSV.
24. Mobile-first guest invitation experience.
25. Responsive admin dashboard.
26. Production deployment using the agreed technology stack.

---

## 6. Non-Goals for V1

The following are intentionally outside the initial release unless a later PRD changes this decision:

- Canva-style drag-and-drop invitation builder;
- marketplace of dozens of invitation themes;
- payment processing;
- ticket sales;
- SMS delivery infrastructure;
- WhatsApp or LINE automation;
- full email marketing system;
- seating-chart designer;
- complex multi-tenant organization teams;
- native iOS or Android applications;
- public event discovery;
- social-network features.

The architecture may leave room for future capabilities, but V1 should not implement speculative complexity.

---

## 7. Initial Technical Direction

The current agreed direction is:

| Area | Technology |
|---|---|
| Web framework | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI motion | Motion / Framer Motion where useful |
| Database | PostgreSQL via Supabase |
| Authentication | Supabase Auth |
| Backend services | Supabase + Next.js server-side capabilities |
| Hosting | Vercel |
| Data export | CSV |
| Map / venue navigation | External map link initially |

These are current architectural decisions, not an excuse to skip later technical design. The technical architecture document must define the exact application boundaries, server/client responsibilities, authorization model, database access patterns, and deployment setup.

---

## 8. Security Principles

Personalized invitation links must be treated as access credentials.

V1 should follow these principles:

- invitation identifiers exposed publicly must not be sequential or predictable;
- invitation tokens must be cryptographically strong and unguessable;
- server-side validation is mandatory for all business rules;
- client-side validation is for usability only;
- a guest must never be able to access another invitation by modifying a URL;
- an RSVP attendee count must never exceed the invitation's maximum party size;
- organizer-only data must require authenticated authorization;
- ownership checks must be enforced server-side;
- secrets must never be committed to source control;
- invitation revocation / regeneration behavior must be explicitly defined.

The final token-storage strategy and access model will be documented in the technical architecture, data model, security specification, and relevant ADRs.

---

## 9. Documentation as the Source of Truth

This project follows a **specification-first development process**.

The documentation in this project is the authoritative source for product behavior and implementation constraints.

### Rule

When implementation and documentation disagree:

**The approved documentation wins unless a newer approved ADR or specification explicitly supersedes it.**

Do not silently change business rules during implementation.

If a required implementation change conflicts with the approved specification:

1. identify the conflict;
2. update the relevant specification;
3. record an ADR when the change is architectural or difficult to reverse;
4. then update the implementation.

---

## 10. Document Set

The planned project documentation is:

```text
README.md
AGENTS.md
docs/
├── 01-product-concept.md
├── product-decisions.md
├── 02-prd.md
├── 03-user-flows.md
├── 04-technical-architecture.md
├── 05-data-model.md
├── 06-design-system-and-ui-foundation.md
├── 07-guest-experience-spec.md
├── 08-admin-dashboard-spec.md
├── 09-api-and-server-contracts.md
├── 10-security-and-privacy.md
├── 11-testing-strategy.md
├── 12-development-architecture.md
├── 13-development-roadmap.md
├── 14-deployment-and-operations.md
└── adr/
    ├── 001-nextjs-app-router-and-server-first-rendering.md
    ├── 002-supabase-auth-postgres-storage.md
    ├── 003-guest-access-through-nextjs-server.md
    ├── 004-invitation-token-storage.md
    ├── 005-organizer-authorization-and-rls.md
    ├── 006-private-hero-image-storage.md
    └── 007-event-ended-derived-from-time.md
```

### Document responsibilities

#### `AGENTS.md`

Defines repository-level execution instructions for Codex and other coding agents.

It does not override the source-of-truth precedence. It reinforces implementation discipline, including the mandatory rule to verify and select the latest stable, production-supported, mutually compatible dependency versions at implementation time rather than relying on model-training-time version knowledge.

#### `01-product-concept.md`

Defines:

- product vision;
- target users;
- problems being solved;
- product principles;
- major use cases;
- V1 boundaries;
- future direction;
- non-goals;
- success criteria.

#### `product-decisions.md`

Records approved product/business decisions that were resolved before the PRD, including RSVP lifecycle, attendee details, invitation access, CSV export, Event fields, theme scope, duplication scope, and Event ownership.

These decisions are binding inputs to the PRD and must be updated explicitly if product behavior changes.

#### `02-prd.md`

Defines:

- functional requirements;
- business rules;
- feature requirements;
- permissions;
- edge cases;
- acceptance criteria;
- product-level constraints.

#### `03-user-flows.md`

Defines end-to-end flows for:

- organizer onboarding;
- event creation;
- invitation creation;
- invitation sharing;
- guest RSVP;
- RSVP editing;
- decline flow;
- deadline behavior;
- invitation revocation;
- admin reporting.

#### `04-technical-architecture.md`

Defines:

- application architecture;
- Next.js boundaries;
- Supabase responsibilities;
- authentication;
- authorization;
- server/client separation;
- deployment architecture;
- integration boundaries;
- major technical decisions.

#### `05-data-model.md`

Defines:

- entities;
- tables;
- relationships;
- identifiers;
- constraints;
- indexes;
- lifecycle rules;
- ownership;
- deletion behavior;
- database invariants.

#### `06-design-system-and-ui-foundation.md`

Defines:

- responsive strategy;
- typography;
- spacing;
- colors / tokens;
- components;
- accessibility;
- forms;
- loading / empty / error states;
- animation principles.

#### `07-guest-experience-spec.md`

Defines the public invitation experience, including:

- mobile-first invitation;
- sections and page hierarchy;
- RSVP interaction;
- confirmation states;
- validation;
- expired / revoked / invalid invitations;
- loading and error states.

#### `08-admin-dashboard-spec.md`

Defines:

- dashboard information architecture;
- event management;
- invitation management;
- RSVP status;
- attendee totals;
- filters;
- search;
- exports;
- link management;
- admin states and workflows.

#### `09-api-and-server-contracts.md`

Defines:

- server actions and/or API endpoints;
- request schemas;
- response schemas;
- validation;
- authorization requirements;
- error contracts;
- idempotency where required.

#### `10-security-and-privacy.md`

Defines:

- invitation-token security;
- organizer authorization;
- data exposure boundaries;
- rate limiting / abuse considerations;
- privacy requirements;
- logging rules;
- secrets handling.

#### `11-testing-strategy.md`

Defines:

- unit testing;
- integration testing;
- database / authorization tests;
- end-to-end tests;
- acceptance test mapping;
- critical regression scenarios.

#### `12-development-architecture.md`

Defines Codex-facing implementation conventions, including:

- repository structure;
- modules;
- naming;
- TypeScript rules;
- validation approach;
- dependency rules;
- state-management rules;
- component boundaries;
- coding standards.

#### `13-development-roadmap.md`

Defines:

- implementation phases;
- dependencies;
- milestones;
- vertical slices;
- completion criteria.

#### `14-deployment-and-operations.md`

Defines:

- development / preview / production environments;
- environment variables;
- Supabase migrations;
- Vercel deployment;
- backup strategy;
- monitoring;
- operational procedures.

#### `docs/adr/`

Architecture Decision Records document decisions that are important, architectural, or costly to reverse.

---

## 11. Documentation Precedence

When documents conflict, use this precedence unless an ADR explicitly supersedes an older decision:

1. Approved ADR affecting the relevant decision
2. Approved `product-decisions.md` entries
3. PRD and explicit business rules
4. Security and privacy specification
5. Data model
6. API and server contracts
7. User-flow / UI specifications
8. Technical architecture
9. Development architecture
10. Development roadmap
11. README summaries

The README provides orientation and agreed high-level direction. Detailed specifications should contain the final implementation-level rules.

`AGENTS.md` is operational guidance for coding agents. It does not outrank or override this precedence; when it conflicts with an approved specification or ADR, the approved source-of-truth document wins.

---

## 12. Development Workflow

Before implementing a feature with Codex:

1. Read the relevant PRD requirements.
2. Read the relevant user flow.
3. Read the relevant data-model section.
4. Read the relevant guest/admin UI specification.
5. Read the relevant API/server contract.
6. Read the security requirements.
7. Read applicable ADRs.
8. Identify the acceptance criteria.
9. Implement the smallest coherent vertical slice.
10. Add or update tests that prove the acceptance criteria.
11. Do not invent new business behavior when the specification is silent; resolve the specification first.

---

## 13. Product Principles

The project should optimize for:

### Mobile-first guest experience

Most invitees are expected to open invitation links from mobile messaging applications. The public invitation experience must be excellent on mobile devices.

### Simple guest interaction

Guests should not be required to create accounts, remember passwords, or navigate a complex application.

### Accurate attendance

The system must distinguish between:

- accepted invitations; and
- actual attendee count.

One accepted invitation may represent multiple attendees.

### Secure personalized access

Each invitation link represents access to one invitation and must not expose other guests or organizer data.

### Organizer clarity

The organizer should be able to understand the event status quickly:

- total invitations;
- accepted;
- declined;
- awaiting response;
- total expected attendees;
- invitation limits.

### Reusable architecture, focused V1

The domain model should support multiple events and future event types, while the first release remains focused enough to ship as a polished wedding product.

### Explicit business rules

Rules should be documented and testable rather than hidden inside UI code.

---

## 14. Key Business Rules Already Agreed

The following are current baseline decisions:

1. One organizer can ultimately manage multiple events.
2. One event can contain multiple invitations.
3. An invitation may represent an individual, couple, family, household, or group.
4. Each invitation has its own maximum party size.
5. Guests do not need accounts.
6. Guests access the experience through personalized secure invitation links.
7. An RSVP belongs to an invitation rather than directly to an event.
8. An accepted invitation records the actual attendee count.
9. The actual attendee count must not exceed the invitation's maximum party size.
10. The server must enforce attendee limits independently of the UI.
11. The admin dashboard must report actual attendee totals.
12. The platform should be reusable beyond weddings.
13. The first production template / experience is wedding-focused.
14. V1 should remain intentionally smaller than a full invitation-design SaaS platform.

Detailed approved V1 business decisions are maintained in `docs/product-decisions.md`. Any new unresolved rule must be settled there or in a higher-precedence specification before implementation.

---

## 15. Resolved Product Decisions

The original product-question set has been resolved and recorded in **`docs/product-decisions.md`** as D-01 through D-28.

The decision ledger now defines V1 rules for:

- RSVP lifecycle and deadline behavior;
- Maximum Party Size changes;
- attendee names and attendee categories;
- dietary requirements;
- Invitation expiration, token regeneration, and revocation;
- CSV export content;
- required and optional Event fields;
- V1 theme customization boundaries;
- Event duplication scope;
- Event ownership and Organizer roles;
- Event lifecycle and Event time validation;
- Attendee Names cardinality and decline cleanup behavior;
- Organizer RSVP editing scope;
- V1 Invitation search/filter behavior;
- RSVP reopening behavior;
- Maximum Party Size bounds;
- Ended Event administrative read-only behavior;
- Event retention and self-service deletion behavior;
- Organizer provisioning and passwordless email OTP sign-in.

New product questions may still emerge while writing the PRD. They must be resolved explicitly and added to the decision ledger rather than being silently decided by implementation.

---

## 16. Initial Success Criteria

The first release should be considered successful when an organizer can:

1. create and configure the wedding event;
2. create personalized invitations with per-invitation attendee limits;
3. share each invitation URL;
4. receive guest accept / decline responses;
5. receive accurate attendee counts;
6. see current RSVP status in the dashboard;
7. export usable attendance information;
8. manage the experience without manually editing the database.

A guest should be able to complete an RSVP comfortably from a mobile phone without creating an account.

---

## 17. Portfolio Positioning

This project is intended to be suitable for a professional portfolio and resume.

Recommended portfolio title:

**Digital Invitation & RSVP Platform**

Example short description:

> Designed and developed a reusable digital invitation and RSVP platform with personalized secure invitation links, per-invitation party-size controls, guest response management, real attendee-count tracking, and an organizer dashboard. Built with Next.js, TypeScript, Supabase/PostgreSQL, Tailwind CSS, and Vercel using a specification-first engineering process.

The final portfolio description should be updated after the implementation is complete so that it describes only features that were actually delivered.

---

## 18. Current Project Phase

**Current phase:** Implementation ready.

The numbered V1 specification set (`01` through `14`) and ADR 001 through ADR 007 are approved.

The repository should now include a root-level `AGENTS.md` for Codex/implementation-agent guidance. `AGENTS.md` does not override source-of-truth specifications or approved ADRs; it makes implementation-time rules explicit, especially the requirement to verify current stable dependency versions from authoritative sources rather than relying on model-training-time knowledge.

Begin **M1 — Repository & Local Platform Foundation** from `13-development-roadmap.md`.

### Recommended documentation order

```text
README.md
    ↓
AGENTS.md
    ↓
01-product-concept.md
    ↓
product-decisions.md
    ↓
02-prd.md
    ↓
03-user-flows.md
    ↓
04-technical-architecture.md
    ↓
05-data-model.md
    ↓
06-design-system-and-ui-foundation.md
    ↓
07-guest-experience-spec.md
    ↓
08-admin-dashboard-spec.md
    ↓
09-api-and-server-contracts.md
    ↓
10-security-and-privacy.md
    ↓
11-testing-strategy.md
    ↓
12-development-architecture.md
    ↓
13-development-roadmap.md
    ↓
14-deployment-and-operations.md
    ↓
Codex Implementation
```

Some later documents may be drafted in parallel once the PRD and domain model become stable, but implementation should always follow the approved source-of-truth specifications.

---

## 19. Next Step

Begin:

**M1 — Repository & Local Platform Foundation**

Use:

- `AGENTS.md` for Codex/implementation execution rules;
- `12-development-architecture.md` for repository and coding architecture;
- `13-development-roadmap.md` for implementation sequence;
- `11-testing-strategy.md` for quality gates;
- `14-deployment-and-operations.md` for environment and operational constraints;
- applicable approved ADRs for costly-to-reverse architectural decisions.

At M1 bootstrap, Codex must **actively verify the latest stable, production-supported, mutually compatible versions** of the approved runtime/framework/toolchain and direct dependencies from official current sources. It must not rely on package versions remembered from model training and must not use alpha/beta/RC/canary/nightly/experimental releases unless explicitly approved later.

Exact implementation-time versions belong in repository configuration and `pnpm-lock.yaml`, not in long-lived product specifications.

---

## 20. Change Discipline

Every meaningful product or architecture change should answer:

- What changed?
- Why did it change?
- Which documents are affected?
- Does the data model change?
- Does the API contract change?
- Does authorization change?
- Do acceptance criteria or tests change?
- Is an ADR required?

The goal is not to produce documentation for its own sake. The goal is to keep product intent, architecture, implementation, and tests aligned.
