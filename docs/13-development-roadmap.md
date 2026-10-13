# 13 — Development Roadmap

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document defines the V1 implementation sequence for the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, `03-user-flows.md`, `04-technical-architecture.md`, `05-data-model.md`, `06-design-system-and-ui-foundation.md`, `07-guest-experience-spec.md`, `08-admin-dashboard-spec.md`, `09-api-and-server-contracts.md`, `10-security-and-privacy.md`, `11-testing-strategy.md`, and `12-development-architecture.md`. It is an implementation-order document and must not change approved product behavior.

---

## 1. Purpose

This document turns the approved specification set into a dependency-aware implementation sequence for Codex-assisted development.

It defines:

- implementation phases;
- vertical slices;
- milestone dependencies;
- required prerequisites;
- acceptance/test gates;
- source-document ownership for each slice;
- safe sequencing of database, server, UI, and tests;
- integration checkpoints;
- release-readiness checkpoints;
- explicit deferments to `14-deployment-and-operations.md`;
- conditions that require returning to specifications before coding.

This document does **not** assign calendar dates, sprint lengths, staffing estimates, or product priorities beyond the dependency order required to implement V1 safely.

---

# 2. Roadmap Principles

### ROAD-P01 — Specifications remain authoritative

Implementation follows approved specifications.

If implementation reveals missing or conflicting business behavior:

```text
stop implementation
    ↓
resolve specification
    ↓
record decision / ADR where required
    ↓
resume implementation
```

Do not use roadmap sequencing as permission to invent behavior.

### ROAD-P02 — Build complete vertical slices

Prefer a usable end-to-end capability with tests over disconnected layers.

A slice should normally include:

```text
schema / migration if needed
    ↓
domain logic
    ↓
persistence / authorization
    ↓
Server Action / Route Handler
    ↓
UI
    ↓
tests
```

### ROAD-P03 — Security boundaries arrive before sensitive features

Do not defer:

- ownership authorization;
- RLS;
- Token secrecy;
- service-role isolation;
- log redaction;
- private Storage rules

until the end.

### ROAD-P04 — Critical invariants are transactional before UI polish

Maximum Party Size, RSVP, Token regeneration, Event deletion, and lifecycle rules must be correct at the server/database level before presentation polish is considered complete.

### ROAD-P05 — Production deployment waits for Operations specification

`14-deployment-and-operations.md` must be approved before production launch or production implementation steps that depend on unresolved operational values.

### ROAD-P06 — Tests are part of each slice

A slice is not complete when the UI appears to work.

Its required unit, database, RLS, integration, E2E, security, and accessibility tests must be included according to `11-testing-strategy.md`.

---

# 3. Roadmap Completion Model

V1 implementation is organized into these milestones:

```text
M0  Specification / Operations Gate
 ↓
M1  Repository & Local Platform Foundation
 ↓
M2  Database, RLS & Core Domain Foundation
 ↓
M3  Organizer Authentication
 ↓
M4  Event Draft / Settings / Publication
 ↓
M5  Invitation Creation & Secure Token Access
 ↓
M6  Guest Invitation Read Experience
 ↓
M7  Guest RSVP Lifecycle
 ↓
M8  Organizer Invitation / RSVP Management
 ↓
M9  Dashboard, Search & RSVP Reopening
 ↓
M10 Token Regeneration & Revocation
 ↓
M11 CSV Export
 ↓
M12 Hero Image
 ↓
M13 Event Deletion
 ↓
M14 Security, Accessibility & Regression Hardening
 ↓
M15 Production Readiness / Launch Gate
```

Some work may be developed in parallel after its dependencies are stable, but a milestone must not bypass its prerequisite correctness/security boundary.

---

# 4. Pre-Implementation Gate — M0

## 4.1 Objective

Finish the specification set before production implementation begins.

Required documents:

- `01-product-concept.md`;
- `product-decisions.md`;
- `02-prd.md`;
- `03-user-flows.md`;
- `04-technical-architecture.md`;
- `05-data-model.md`;
- `06-design-system-and-ui-foundation.md`;
- `07-guest-experience-spec.md`;
- `08-admin-dashboard-spec.md`;
- `09-api-and-server-contracts.md`;
- `10-security-and-privacy.md`;
- `11-testing-strategy.md`;
- `12-development-architecture.md`;
- `13-development-roadmap.md`;
- `14-deployment-and-operations.md`.

## 4.2 Completion criteria

M0 is complete when:

- all core specification documents are Approved;
- unresolved production operational values required by implementation are defined in `14`;
- repository bootstrap can proceed without inventing a business rule;
- any architecture choice expensive to reverse has an ADR where the approved architecture requires one.

## 4.3 Important constraint

This roadmap may be reviewed/approved before `14`, but **production implementation should not begin until `14-deployment-and-operations.md` is approved**, consistent with the README documentation order.

---

# 5. M1 — Repository & Local Platform Foundation

## 5.1 Goal

Create the executable project skeleton with no feature behavior beyond infrastructure needed by later slices.

## 5.2 Work

Bootstrap:

- Next.js App Router;
- TypeScript strict configuration;
- pnpm;
- current stable dependency/version verification required by `AGENTS.md` and `12-development-architecture.md`;
- Tailwind CSS;
- ESLint;
- Prettier;
- Vitest;
- React Testing Library;
- Playwright;
- local Supabase configuration;
- base environment validation;
- base CSS/design-token plumbing;
- repository quality scripts.

Create the approved repository boundaries:

```text
src/app
src/components
src/modules
src/server
src/styles
src/types
supabase/migrations
tests/*
docs/
```

Create:

- server-only environment module;
- authenticated Supabase client boundary;
- service-role client boundary;
- browser Supabase client only if required for OTP;
- Clock interface + production clock;
- safe logger interface;
- test configuration.

## 5.3 Do not implement yet

Do not implement:

- Event business UI;
- Token generation;
- RSVP;
- CSV;
- Hero Image;
- deletion;
- production secrets;
- production rate limits.

## 5.4 Governing specs

Primary:

- `04-technical-architecture.md`;
- `10-security-and-privacy.md`;
- `11-testing-strategy.md`;
- `12-development-architecture.md`.

## 5.5 Completion criteria

- Codex has verified the selected Node/pnpm/Next.js/React/TypeScript/Tailwind/Supabase/Zod/Motion/test-tool versions against current authoritative sources;
- selected versions are stable, production-supported, and mutually compatible;
- no alpha/beta/RC/canary/nightly/experimental dependency is present without explicit approval;
- `package.json`, runtime version configuration, and `pnpm-lock.yaml` record the implementation-time choices;
- app boots locally;
- local Supabase can start/reset;
- TypeScript strict mode passes;
- lint/format/test commands exist;
- server-only secret modules cannot be imported by client code;
- no production credential is required;
- a sample unit test and Playwright smoke test run;
- CI-ready scripts are present even if final CI topology waits for `14`.

---

# 6. M2 — Database, RLS & Core Domain Foundation

## 6.1 Goal

Establish the persistent model and pure domain rules before feature UI depends on them.

## 6.2 Work

Implement migrations for approved entities:

- `events`;
- `invitations`;
- `invitation_access_credentials`;
- `rsvps`.

Implement:

- keys;
- foreign keys;
- D-27 cascade behavior;
- check constraints;
- indexes;
- publication constraints where approved;
- RSVP structural constraints;
- RLS enablement/policies;
- generated database TypeScript types.

Implement pure domain modules for:

- Event timing;
- Event runtime state;
- RSVP Deadline evaluation;
- Maximum Party Size `1..20`;
- RSVP normalization;
- Declined cleanup;
- publication completeness;
- Event deletability;
- Guest RSVP permission calculation.

## 6.3 Transaction/RPC foundation

Add approved PostgreSQL transaction functions as needed for:

- Invitation creation;
- RSVP mutation;
- Maximum Party Size conflict prevention;
- Token regeneration;
- publication transition;
- Event deletion.

The exact SQL function names are implementation details.

## 6.4 Tests

Required:

- unit timing/domain tests;
- migration-from-empty test;
- database constraints;
- RLS A/B Organizer isolation;
- anonymous private-table denial;
- cascade tests;
- deterministic-clock tests.

## 6.5 Completion criteria

- schema reproduces from migrations;
- generated DB types compile;
- core invariants cannot be bypassed through direct test database operations where DB enforcement owns them;
- RLS isolates Organizer A from Organizer B;
- domain functions pass boundary tests;
- no UI feature is relied upon for correctness.

---

# 7. M3 — Organizer Authentication

## 7.1 Goal

Allow an administratively provisioned Organizer to authenticate with passwordless email OTP.

## 7.2 Work

Implement:

```text
/admin/sign-in
```

Build:

- OTP request form;
- OTP verification form/state;
- authenticated server-session resolution;
- sign-out entry;
- Admin route protection;
- operational/test provisioning helper outside public UI.

Configure Supabase OTP so:

```text
unknown email != create user
```

Use explicit no-auto-create behavior rather than relying on provider defaults.

## 7.3 Security requirements

- no public self-sign-up;
- no password login;
- no password reset;
- no production OTP bypass;
- session not persisted by application localStorage;
- auth errors do not expose private Event information.

## 7.4 Tests

Required:

- AUTH-01 through AUTH-06;
- unauthenticated Admin route protection;
- unknown-email no-user-creation assertion;
- session establishment test;
- client bundle secret test.

## 7.5 Completion criteria

A provisioned test Organizer can sign in and reach an authenticated empty Events area; an unknown email cannot create an account.

---

# 8. M4 — Event Draft, Settings & Publication

## 8.1 Goal

Complete the first Organizer-owned business vertical slice.

## 8.2 Work

Implement:

```text
/admin/events
/admin/events/new
/admin/events/[eventId]
/admin/events/[eventId]/settings
```

Capabilities:

- Events index;
- create incomplete Draft;
- edit Draft Event;
- required/optional Event fields;
- timing validation;
- publication-readiness errors;
- explicit Publish Event;
- Published Event editing before expiration;
- runtime Ended display/read-only behavior.

Do not add:

- Unpublish;
- Event duplication;
- active Published Event deletion.

## 8.3 Server contracts

Implement/use:

- `listOwnedEvents`;
- `getEventWorkspace`;
- `createEventDraft`;
- `updateEvent`;
- `publishEvent`;
- `getEventRuntimeState`;
- `assertEventMutable`.

## 8.4 Tests

Required coverage:

- FR-EVT-001 through FR-EVT-006 excluding D-27 delete behavior;
- AS-001 Event publish portion;
- E2E-A-02 through E2E-A-04;
- timing/deadline unit/integration cases;
- wrong-owner reads/writes;
- Ended ordinary mutation rejection.

## 8.5 Completion criteria

Organizer can create, save, configure, and publish an owned Event with correct lifecycle/timing behavior and ownership enforcement.

---

# 9. M5 — Invitation Creation & Secure Token Access

## 9.1 Goal

Create personalized Invitations and the secure current credential model.

## 9.2 Work

Implement:

```text
/admin/events/[eventId]/invitations
/admin/events/[eventId]/invitations/new
/admin/events/[eventId]/invitations/[invitationId]
```

Implement:

- Invitation create form;
- Invitee Name;
- Maximum Party Size;
- Awaiting Response RSVP initialization;
- Token generation;
- HMAC lookup hash;
- AES-256-GCM recoverable Token encryption;
- credential persistence;
- authorized current-link reconstruction;
- copy link interaction;
- Draft Event warning.

## 9.3 Server contracts

Implement:

- `createInvitation`;
- `getInvitationAdminDetail`;
- credential-generation service;
- current Invitation URL reconstruction.

Do not implement regeneration/revocation UI yet unless needed by the slice's internal tests; those are M10.

## 9.4 Tests

Required:

- Maximum Party Size bounds;
- one RSVP per Invitation;
- one credential per Invitation;
- Token entropy/encoding wrapper tests;
- encrypt/decrypt round trip;
- cross-Owner Invitation denial;
- credential-table RLS/isolation;
- create transaction atomicity.

## 9.5 Completion criteria

Organizer can create an Invitation for an owned non-Ended Event and copy the current personalized URL without plaintext-only Token persistence or credential leakage.

---

# 10. M6 — Guest Invitation Read Experience

## 10.1 Goal

Deliver the personalized mobile-first invitation page before RSVP write capability.

## 10.2 Work

Implement:

```text
/i/[token]
```

Implement Guest Access service:

- Token shape validation;
- HMAC lookup;
- current Token resolution;
- Event/Invitation load;
- Draft/Published/Ended evaluation;
- revocation evaluation;
- Guest-safe projection;
- deadline read/write permission;
- private/no-store response behavior;
- noindex/nofollow metadata;
- privacy-safe unavailable state.

Build Guest presentation:

- personalized Invitee context;
- Hero area without requiring an image;
- Event date/time;
- Venue;
- optional Invitation Message;
- Dress Code;
- Arrival Notes;
- map link;
- Organizer Contact where present;
- RSVP section placeholder/current read-only state as applicable.

## 10.3 Security requirements

Before private content is rendered:

```text
valid current Token
AND Published
AND not Ended
AND not revoked
```

## 10.4 Tests

Required:

- Token isolation;
- malformed/unknown Token unavailable;
- Draft unavailable;
- Ended unavailable;
- private metadata absent before access;
- private/no-store;
- no referrer;
- noindex/nofollow;
- Guest phone viewport;
- unavailable accessibility state.

## 10.5 Completion criteria

A valid personalized current link renders only its one authorized Invitation, and invalid/private states reveal no Event/Invitee data.

---

# 11. M7 — Guest RSVP Lifecycle

## 11.1 Goal

Allow Guests to submit and update current RSVP safely.

## 11.2 Work

Implement:

- Attending/Declined controls;
- Attendee Count;
- optional Attendee Names;
- optional Dietary Requirements;
- Guest Message;
- saved-response summary;
- Update RSVP flow;
- Attending -> Declined cleanup;
- Declined -> Attending;
- deadline read-only state;
- no-deadline-until-expiration behavior.

Implement `submitGuestRsvp`.

## 11.3 Transactional requirements

Every submit re-reads current:

- Token;
- Event state;
- revocation;
- RSVP Deadline;
- Maximum Party Size.

Do not trust rendered client state.

## 11.4 Tests

Required:

- AS-002 through AS-005;
- E2E-G-02 through E2E-G-07;
- attendee/name boundary tests;
- decline cleanup;
- Guest Message preservation;
- deadline race CONC-03;
- crafted-input validation bypass tests.

## 11.5 Completion criteria

A Guest can complete/update a valid RSVP from mobile while all party-size, cleanup, deadline, and privacy rules remain server-authoritative.

---

# 12. M8 — Organizer Invitation & RSVP Management

## 12.1 Goal

Complete the Organizer's operational management of current Invitation/RSVP data.

## 12.2 Work

Implement:

- Invitation detail read;
- Invitee Name edit;
- Maximum Party Size edit;
- conflict message when lowering below Attendee Count;
- current RSVP display;
- Organizer RSVP edit;
- Guest Message read-only;
- Attending/Declined transitions;
- Ended read-only UI.

Implement/use:

- `updateInvitation`;
- `updateOrganizerRsvp`.

## 12.3 Concurrency

Implement/test transactional protection for:

```text
Maximum Party Size vs current RSVP Attendee Count
```

## 12.4 Tests

Required:

- FR-INV-004;
- FR-RSVP-009;
- E2E-A-06;
- E2E-A-09;
- CONC-01;
- Guest Message injection rejection;
- Ended write rejection.

## 12.5 Completion criteria

Organizer can safely edit permitted current operational data without violating RSVP constraints or changing Guest Message.

---

# 13. M9 — Dashboard, Search, Filtering & RSVP Reopening

## 13.1 Goal

Provide the Event operational overview and Invitation discovery tools.

## 13.2 Work

Implement dashboard metrics:

- Total Invitations;
- Attending Invitations;
- Declined Invitations;
- Awaiting Response Invitations;
- Total Expected Attendees.

Implement Invitation list:

- desktop table;
- mobile cards;
- Invitee Name case-insensitive substring search;
- RSVP Status filter;
- AND semantics;
- URL search-parameter state.

Implement RSVP availability summary.

Implement reopening by:

- moving RSVP Deadline into future; or
- removing RSVP Deadline.

Do not add a separate reopen flag/toggle.

## 13.3 Tests

Required:

- FR-DASH-001/002;
- FR-INV-007;
- FR-RSVP-008;
- E2E-A-07/A-08/A-12;
- E2E-G-08;
- Event-scoped ownership for every query.

## 13.4 Completion criteria

Organizer can understand current attendance state, find Invitations, and reopen Guest RSVP only through the approved deadline mechanism.

---

# 14. M10 — Token Regeneration & Revocation

## 14.1 Goal

Complete the Invitation access-management lifecycle.

## 14.2 Work

Implement:

- Regenerate Link confirmation;
- atomic Token regeneration;
- new-link display/copy;
- Revocation confirmation;
- revoked access state;
- no restore/reactivate control.

Implement:

- `regenerateInvitationToken`;
- `revokeInvitation`.

## 14.3 Security requirements

Regeneration:

```text
old Token invalid immediately after commit
new Token current
RSVP preserved
```

Revocation:

```text
Guest access disabled
Invitation + RSVP preserved
no replacement Token
```

Both are unavailable after Ended.

## 14.4 Tests

Required:

- AS-007/008;
- API-AS-05;
- E2E-A-10/A-11;
- E2E-G-09/G-10;
- SEC-TEST-02/03;
- CONC-02 simultaneous regeneration;
- log-redaction assertions.

## 14.5 Completion criteria

Access-management actions work atomically, preserve business data, and expose no credential secrets outside approved UI.

---

# 15. M11 — CSV Export

## 15.1 Goal

Produce the approved Event-scoped Organizer export safely.

## 15.2 Work

Implement:

```text
GET /admin/events/[eventId]/export.csv
```

Build export module with:

- exact column order;
- all Invitations;
- Attendee Count normalization;
- Attendee Names `; ` serialization;
- UTF-8 output;
- RFC-4180 escaping;
- formula neutralization;
- safe filename;
- credential/internal-ID exclusion;
- private/no-store headers.

## 15.3 Tests

Required:

- CSV-01 through CSV-09;
- AS-009;
- API-AS-02/08/11;
- SEC-TEST-10;
- Ended Event export;
- wrong-owner denial.

## 15.4 Completion criteria

Organizer can download a usable Event CSV without exposing credential/internal fields or spreadsheet formula execution risk.

---

# 16. M12 — Hero Image

## 16.1 Goal

Add the optional private Hero Image without weakening Guest access boundaries.

## 16.2 Work

Implement:

- upload preparation;
- private object upload;
- server finalization;
- JPEG/PNG/WebP validation;
- magic-byte validation;
- 10 MiB maximum;
- replace/remove;
- private signed Guest read URL;
- no-image fallback.

## 16.3 Security constraints

- no public bucket;
- no SVG;
- ownership required;
- non-Ended Event mutation only;
- signed Guest read only after Invitation authorization.

## 16.4 Tests

Required:

- UPLOAD-01 through UPLOAD-08 as applicable before deletion slice;
- SEC-TEST-09;
- ownership;
- Ended mutation denial;
- Guest image absent/failure resilience.

## 16.5 Completion criteria

Organizer can manage one optional Hero Image and authorized Guests can view it without making Event media public.

---

# 17. M13 — Event Permanent Deletion

## 17.1 Goal

Implement D-27 after the core Event dependency graph is fully established.

## 17.2 Why this is late

Deletion is intentionally sequenced after:

- Event;
- Invitation;
- RSVP;
- credential;
- Hero Image

are implemented so cascade and private-storage behavior can be proven end to end.

## 17.3 Work

Implement:

- Draft Event Delete action;
- Ended Event Delete action;
- destructive confirmation;
- `deleteEvent` service/action;
- DB cascade;
- private Hero Image cleanup attempt;
- safe Events-index return;
- former-token unavailable behavior.

Active Published Event deletion remains forbidden.

## 17.4 Storage failure rule

Database deletion is authoritative.

If private Storage cleanup fails:

- deleted database records are not recreated;
- object remains private/unreferenced;
- redacted operational cleanup signal is emitted;
- `14-deployment-and-operations.md` defines orphan cleanup.

## 17.5 Tests

Required:

- FR-EVT-007;
- AS-010/011;
- API-AS-09/10;
- E2E-A-15/A-16/A-17;
- E2E-G-13;
- cascade tests;
- CONC-05;
- wrong-owner delete rejection.

## 17.6 Completion criteria

Draft/Ended deletion is permanent and safe, active Published deletion is impossible through supported server behavior, and old Guest links expose no private data.

---

# 18. M14 — Security, Accessibility & Regression Hardening

## 18.1 Goal

Run the complete cross-feature hardening pass after all approved V1 behavior exists.

This milestone is not permission to defer earlier security rules. It verifies the composed system.

## 18.2 Security hardening

Verify:

- no Token/session/secret leakage;
- no broad anonymous DB access;
- no service-role client bundling;
- CSRF/request-origin protections;
- CSP/security headers;
- `Referrer-Policy: no-referrer`;
- noindex/nofollow;
- unsafe URL rejection;
- XSS inert rendering;
- CSV formula neutralization;
- private Hero Images;
- configured rate-limit categories;
- logging redaction.

## 18.3 Accessibility hardening

Run:

- axe-equivalent scans;
- keyboard journeys;
- focus handling;
- form error association;
- status announcement;
- table/card semantics;
- reduced-motion checks.

## 18.4 Responsive hardening

Verify:

- mobile Guest flow end-to-end;
- tablet behavior;
- Admin mobile cards;
- Admin desktop table;
- dialogs/forms at narrow widths;
- no horizontal overflow.

## 18.5 Full regression

Run all required:

- unit;
- component;
- database;
- RLS;
- integration;
- auth;
- Guest E2E;
- Admin E2E;
- concurrency;
- CSV;
- upload;
- security;
- accessibility;
- responsive suites.

## 18.6 Completion criteria

All required testing-strategy mappings pass with no unresolved critical security regression.

---

# 19. M15 — Production Readiness / Launch Gate

## 19.1 Dependency

This milestone depends on approved:

```text
14-deployment-and-operations.md
```

## 19.2 Goal

Move the tested application into the approved production operating model.

## 19.3 Roadmap-level gate

Before production release, confirm at minimum that `14` has defined and implementation has applied:

- local/preview/production environment model;
- production Vercel/Supabase linkage;
- environment/secrets configuration;
- production rate-limit thresholds/provider;
- OTP production email configuration;
- migration/deployment procedure;
- backup frequency/retention/restore procedure;
- 30-day maximum backup aging for deleted data;
- monitoring/error-reporting configuration;
- alert thresholds;
- orphaned private Hero Image cleanup procedure;
- Organizer provisioning procedure;
- verified privacy/erasure procedure;
- key-rotation operational procedure;
- security header configuration;
- rollback/recovery approach;
- launch checklist.

## 19.4 Release verification

Run the approved manual release verification from `11-testing-strategy.md`.

No destructive automated suite runs against production.

## 19.5 Completion criteria

Production readiness is complete only when all operations/security/test gates are satisfied and the release can be run without undocumented manual database edits.

---

# 20. Dependency Matrix

| Milestone | Depends on | Enables |
|---|---|---|
| M0 Specifications/Operations Gate | Approved docs | all implementation |
| M1 Repository Foundation | M0 | every code slice |
| M2 DB/RLS/Domain Foundation | M1 | authenticated/domain features |
| M3 Organizer Auth | M1, core auth infrastructure | Admin workflows |
| M4 Event Draft/Publication | M2, M3 | Invitations, dashboard |
| M5 Invitation/Token Creation | M2, M4 | Guest access |
| M6 Guest Read | M5 | Guest RSVP |
| M7 Guest RSVP | M6, M2 transactions | attendance data |
| M8 Admin Invitation/RSVP | M5, M7 | operations management |
| M9 Dashboard/Search/Reopen | M4, M7, M8 | Event operations |
| M10 Regeneration/Revocation | M5, M6 | access lifecycle |
| M11 CSV Export | M7, M8 | reporting/export |
| M12 Hero Image | M4, M6 | optional media |
| M13 Event Deletion | M4–M12 relevant data paths | retention/deletion |
| M14 Hardening | M3–M13 | release candidate |
| M15 Production Readiness | M14 + approved `14` | production launch |

---

# 21. Parallelization Guidance

After foundational dependencies are stable, limited parallel implementation is acceptable.

Examples:

### Can overlap after M5

- Guest presentation work for M6;
- Admin Invitation detail presentation for M8;
- dashboard query implementation for M9.

### Can overlap after M7

- CSV export M11;
- dashboard metrics M9;
- token-access UI M10.

### Must not bypass dependency

Do not implement:

- Guest RSVP before current Token resolution exists;
- Event deletion before all dependent data/storage paths are known;
- Hero Image public delivery before private Guest authorization exists;
- dashboard totals from client-side copied data;
- production deployment before `14`.

When parallel branches touch shared domain/database contracts, integrate the lower-level invariant first.

---

# 22. Recommended Codex Task Size

Each Codex request should target one coherent, reviewable unit.

Good task examples:

```text
Add Event runtime-state domain helper + tests.

Add initial events migration and Event-owner RLS tests.

Implement createEventDraft service + Server Action + integration tests.

Implement Guest Token resolution service + unavailable behavior tests.

Implement Guest Attending RSVP transaction + E2E happy path.

Implement CSV formula neutralization helper + unit tests.
```

Avoid requests such as:

```text
Build the whole RSVP platform.
Implement all admin functionality.
Finish the backend.
```

Smaller coherent units reduce accidental requirement invention and make review against specifications practical.

---

# 23. Standard Slice Execution Checklist

For every implementation slice:

1. identify governing requirement IDs;
2. read related user flow;
3. read data-model constraints;
4. read API contract;
5. read security requirements;
6. read UI specification;
7. identify required tests from `11-testing-strategy.md`;
8. confirm no unresolved behavior is needed;
9. implement migration/schema change if required;
10. implement domain logic;
11. implement persistence/transaction behavior;
12. implement authorization;
13. implement Server Action/Route Handler;
14. implement UI;
15. add required tests;
16. run typecheck/lint/tests;
17. inspect client/server secret boundaries;
18. inspect logging/redaction;
19. review acceptance criteria manually;
20. commit only when the slice is coherent.

---

# 24. Milestone Exit Gate Template

A milestone is complete only when:

```text
[ ] all planned approved behavior is implemented
[ ] server authorization exists
[ ] server validation exists
[ ] database invariants exist where specified
[ ] expected errors match contract
[ ] UI matches approved Guest/Admin spec
[ ] required tests pass
[ ] accessibility checks for affected UI pass
[ ] no prohibited secret/private data exposure
[ ] docs remain aligned with code
[ ] no new business rule was invented
```

A visually finished feature that fails any required server/security/test condition is not complete.

---

# 25. Source-of-Truth Mapping by Milestone

| Milestone | Primary governing documents |
|---|---|
| M1 Repository foundation | `AGENTS.md`, `04`, `10`, `11`, `12`, `14` |
| M2 DB/RLS/domain | `05`, `09`, `10`, `11`, `12` |
| M3 Auth | D-28, `03`, `09`, `10`, `11`, `12` |
| M4 Event lifecycle | D-13/14/18/19/26, `02`, `03`, `08`, `09` |
| M5 Invitation/token create | D-25, `05`, `08`, `09`, `10` |
| M6 Guest read | `07`, `09`, `10` |
| M7 Guest RSVP | D-02/03/05/06/08/20/21, `02`, `07`, `09` |
| M8 Admin RSVP/Invitation | D-01/22/25/26, `08`, `09` |
| M9 Dashboard/search/reopen | D-23/24, `08`, `09` |
| M10 Token lifecycle | D-10/11/26, `08`, `09`, `10` |
| M11 CSV | D-12, SEC-D08, `09`, `10`, `11` |
| M12 Hero Image | D-14/15, `07`, `08`, `09`, `10` |
| M13 Deletion | D-27, `02`, `08`, `09`, `10`, `11` |
| M14 Hardening | `06`, `07`, `08`, `10`, `11` |
| M15 Production readiness | `10`, `11`, `14` |

All milestones also follow `12-development-architecture.md`.

---

# 26. Test Gate by Milestone

| Milestone | Minimum gate before exit |
|---|---|
| M1 | typecheck/lint/unit smoke/Playwright smoke |
| M2 | unit + DB constraints + RLS |
| M3 | AUTH suite + route protection |
| M4 | Event unit/INT + Admin Event E2E |
| M5 | Token utility + Invitation DB/INT |
| M6 | SEC token/access regressions + Guest read E2E |
| M7 | RSVP unit/INT/E2E + deadline concurrency |
| M8 | Admin RSVP/Invitation INT/E2E + party-size concurrency |
| M9 | dashboard/search/reopen INT/E2E |
| M10 | regeneration/revocation INT/E2E + concurrent rotation |
| M11 | full CSV suite |
| M12 | full UPLOAD suite |
| M13 | deletion DB/INT/E2E + delete concurrency |
| M14 | full required regression/security/a11y/responsive |
| M15 | production-like manual release verification |

---

# 27. Security-Critical Stop Conditions

Stop implementation and do not merge when any of these are observed:

- raw Invitation Token intentionally logged;
- service-role key reachable from client code;
- Token crypto key exposed through browser configuration;
- anonymous broad table access used for Guest Invitation data;
- Organizer ownership check missing;
- RLS isolation failure;
- Guest can identify another Invitation by changing an ID;
- Event/RSVP rule enforced only in UI;
- private Hero Image bucket becomes public;
- active Published Event can be self-service deleted;
- Ended ordinary mutation bypass;
- CSV includes credentials/internal IDs;
- CSV formula defense missing;
- unknown email creates Organizer account through public sign-in;
- a critical `SEC-TEST-*` regression fails;
- a dependency version was chosen from model memory without current authoritative verification;
- an unapproved prerelease/experimental dependency is introduced.

Fix or update approved specifications/architecture before proceeding.

---

# 28. Product-Rule Stop Conditions

Return to the specification process if implementation requires an answer to a question such as:

- a new RSVP status;
- a new Event lifecycle state;
- restoring a revoked Invitation;
- resetting a responded RSVP to Awaiting Response;
- Invitation deletion;
- changing Guest Message as Organizer;
- active Published Event deletion;
- collaborators;
- ownership transfer;
- automatic Invitation delivery;
- Event duplication;
- arbitrary theme controls;
- attendee categories;
- overnight Event timing.

These are not implementation details in V1.

---

# 29. ADR Trigger Points During Implementation

Create/review an ADR before proceeding if implementation proposes to:

- replace Next.js App Router;
- replace Supabase Auth/PostgreSQL/Storage;
- change Token hash/encryption model;
- expose Guest tables directly to anonymous clients;
- change private Hero Image storage model;
- replace the transaction/RPC strategy for cross-row invariants;
- introduce a public REST/GraphQL API;
- introduce microservices/monorepo deployment;
- introduce a new ownership/tenant model.

The roadmap itself does not approve such changes.

---

# 30. Database Migration Sequencing

Within implementation milestones:

```text
write migration
    ↓
apply to local clean database
    ↓
run DB/RLS tests
    ↓
generate TypeScript DB types
    ↓
implement server code depending on migration
    ↓
implement UI
```

Do not merge application code that assumes an unapplied schema migration.

Production migration procedure and rollback policy belong to `14-deployment-and-operations.md`.

---

# 31. Vertical Slice Integration Order

For a slice touching all layers, use:

```text
1. requirements/tests
2. domain types/schema
3. migration/DB transaction
4. persistence adapter
5. application service
6. auth/access guard
7. Server Action/Route Handler
8. Server Component data wiring
9. Client Component interaction
10. component styling/accessibility
11. E2E
12. regression/security check
```

This order minimizes UI-first implementation that later conflicts with server rules.

---

# 32. UX Polish Timing

Use the approved Design System from the start for:

- tokens;
- typography;
- spacing;
- semantic form controls;
- accessible dialogs;
- status badges;
- responsive layout.

However, defer non-essential animation/polish within a slice until:

- server contract works;
- persistence invariants pass;
- core accessibility semantics exist.

Do not postpone mobile Guest usability until the end; Guest slices are mobile-first from their first E2E test.

---

# 33. Data Privacy During Development

Throughout every milestone:

- use synthetic local/CI data;
- do not copy production Guest data into development;
- do not use production Token keys in preview/local;
- do not use production service-role keys outside production;
- redact test artifacts;
- do not send Invitee/RSVP data to unapproved analytics.

This is a continuous constraint, not only M14 work.

---

# 34. Performance Scope

V1 targets the approved Event scale of tens to hundreds of Invitations per typical Event.

During implementation:

- use approved indexes/query projections;
- avoid obvious N+1 query patterns;
- avoid downloading full private Event datasets to the browser for calculations;
- calculate metrics server-side;
- do not invent hard product volume caps;
- do not introduce distributed-system infrastructure without evidence.

Formal production capacity/monitoring values belong to `14`.

---

# 35. Documentation During Implementation

Normal implementation does not rewrite approved business specifications.

Update docs only when:

- an approved requirement changes;
- a conflict is discovered;
- a security rule changes;
- an architectural decision changes;
- an ADR is required;
- operations details are finalized in their owning document.

Code comments should explain implementation constraints, not become a hidden replacement for source-of-truth rules.

---

# 36. Portfolio / Demo Readiness

Portfolio/demo work occurs only after the implemented system truthfully supports the claimed features.

Before presenting as complete, verify at least:

- real personalized links;
- secure Guest access;
- mobile RSVP;
- party-size enforcement;
- Organizer dashboard;
- actual attendee totals;
- token regeneration/revocation;
- CSV export;
- responsive Admin;
- deletion behavior;
- security/access controls.

Do not describe unimplemented roadmap items as delivered features.

---

# 37. Roadmap Decisions Proposed by This Document

These are implementation-order decisions only.

### ROAD-D01 — Foundation before feature UI

Repository, DB/RLS, and Auth foundations precede dependent product slices.

### ROAD-D02 — Guest Invitation read before Guest RSVP write

Credential resolution/access privacy is completed before RSVP mutation.

### ROAD-D03 — Core RSVP before reporting

Current RSVP persistence is completed before dashboard/export features depending on it.

### ROAD-D04 — Event deletion after dependent resources

Deletion is implemented after Invitations, RSVPs, credentials, and Hero Images so the full cascade/cleanup path can be proven.

### ROAD-D05 — Hardening is a composed-system gate, not a security deferral

Security rules apply in every slice; M14 performs complete regression/hardening.

### ROAD-D06 — Production launch requires approved Operations specification

M15 cannot complete without `14-deployment-and-operations.md`.

---

# 38. Explicit Roadmap Deferrals

This document intentionally does not set:

- implementation dates;
- sprint lengths;
- staffing/ownership assignments;
- story-point estimates;
- production environment variable values;
- production rate-limit thresholds;
- monitoring vendor;
- alert thresholds;
- backup schedule/restore commands;
- Vercel plan/runtime configuration;
- Supabase production sizing;
- production domain/DNS;
- OTP email sender/domain configuration;
- secrets rotation calendar;
- exact launch date.

Those are operational/project-management details, with production concerns owned by `14-deployment-and-operations.md`.

---

# 39. Review Checklist

Before marking this roadmap Approved, confirm:

- milestones follow technical dependencies;
- repository/DB/RLS/Auth foundations precede dependent features;
- Guest access is proven before Guest RSVP writes;
- party-size and RSVP invariants are transactional before Admin/Guest UI is considered done;
- dashboard/export depend on current RSVP implementation;
- Token regeneration/revocation have full access-security tests;
- Event deletion is sequenced after dependent resources;
- Hero Image remains private throughout;
- every milestone includes a test gate;
- M14 does not defer security requirements that belong in earlier slices;
- production launch is blocked on approved `14-deployment-and-operations.md`;
- no dates/effort estimates were invented;
- no new product/business rule was introduced.

---

# 40. Next Document

After this Development Roadmap is reviewed and approved, create:

**`14-deployment-and-operations.md`**

The Deployment and Operations specification should finalize the local/preview/production environment model, Vercel/Supabase deployment procedure, environment-variable inventory, secret provisioning, concrete rate-limit configuration, OTP production configuration, migration/deployment sequencing, backups and restore, monitoring/alerts, key rotation, Organizer provisioning, verified privacy/erasure operations, orphaned private-media cleanup, incident procedures, release/rollback workflow, and production launch checklist without changing approved product behavior.
