# 11 — Testing Strategy

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document defines the V1 testing strategy for the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, `03-user-flows.md`, `04-technical-architecture.md`, `05-data-model.md`, `06-design-system-and-ui-foundation.md`, `07-guest-experience-spec.md`, `08-admin-dashboard-spec.md`, `09-api-and-server-contracts.md`, and `10-security-and-privacy.md`. Tests must prove approved behavior rather than invent new behavior.

---

## 1. Purpose

This document defines how V1 product, security, persistence, and user-experience requirements are verified.

It establishes:

- test layers;
- test responsibilities;
- deterministic test data and clock handling;
- unit-test scope;
- database and Row Level Security testing;
- server-action/integration testing;
- Guest end-to-end testing;
- Admin end-to-end testing;
- Organizer passwordless OTP testing;
- concurrency/race-condition testing;
- Event deletion testing;
- upload-security testing;
- CSV/security testing;
- accessibility testing;
- responsive regression testing;
- security regression mapping;
- acceptance-scenario traceability;
- CI/release quality gates;
- flaky-test policy;
- manual release verification.

The exact repository folder layout and package versions belong to `12-development-architecture.md`.

---

# 2. Testing Principles

### TEST-P01 — Test approved behavior at the lowest reliable layer

A rule should be proven as close as practical to the layer that owns it.

Examples:

- pure timing logic -> unit test;
- SQL constraint/RLS policy -> database integration test;
- Server Action authorization -> server integration test;
- Guest RSVP journey -> browser end-to-end test.

Do not rely on a single E2E test to prove every lower-level invariant.

### TEST-P02 — Critical rules require defense-in-depth tests

Rules intentionally enforced in more than one layer should be tested in more than one layer.

Examples:

- Maximum Party Size;
- Organizer ownership;
- Ended Event mutability;
- Guest Token isolation;
- RSVP Deadline;
- deletion eligibility;
- CSV credential exclusion.

### TEST-P03 — Tests are deterministic

Tests must not depend on:

- current wall-clock time without control;
- production data;
- external email delivery;
- arbitrary sleep delays;
- ordering not defined by a specification;
- third-party services not required for the test.

### TEST-P04 — Security regressions are release blockers

Every `SEC-TEST-*` scenario in `10-security-and-privacy.md` must have an automated regression where technically feasible.

A failing critical security regression blocks release.

### TEST-P05 — Acceptance criteria remain traceable

Every PRD functional requirement and every end-to-end acceptance scenario must map to one or more tests.

### TEST-P06 — No destructive production testing

Automated tests must not run destructive fixtures, migrations, uploads, or deletion scenarios against production data.

---

# 3. Recommended Test Tooling

The testing architecture should use a small TypeScript-first toolset.

Recommended V1 tooling:

| Layer | Recommended tool |
|---|---|
| Unit / service integration | Vitest |
| React component behavior | React Testing Library with Vitest |
| Browser E2E | Playwright |
| Accessibility automation | `@axe-core/playwright` or equivalent |
| Database/RLS integration | Local/isolated Supabase PostgreSQL using real migrations and RLS |
| HTTP/Server Action integration | Next.js test harness + real application services against test database |
| Test data factories | Lightweight TypeScript factories/builders |

These are technical testing choices, not product behavior.

Exact versions, scripts, directory layout, and CI provider belong to `12-development-architecture.md`.

---

# 4. Test Layers

V1 uses these logical layers:

```text
Unit
  ↓
Component
  ↓
Database / RLS
  ↓
Server Integration
  ↓
Browser E2E
  ↓
Release / Manual Verification
```

Security tests cut across all layers.

The goal is not a fixed percentage distribution. The goal is fast feedback for pure logic and realistic integration coverage for authorization, persistence, and user flows.

---

# 5. Test Identifier Conventions

Use stable IDs in test names/descriptions where traceability matters.

Recommended prefixes:

```text
UT-        unit/domain
COMP-      component
DB-        database constraint/persistence
RLS-       Row Level Security
INT-       server integration / Server Action
AUTH-      Organizer authentication
E2E-G-     Guest browser flow
E2E-A-     Admin browser flow
CONC-      concurrency/race
SEC-       security regression
CSV-       export security/format
UPLOAD-    Hero Image upload security
A11Y-      accessibility
RESP-      responsive behavior
REL-       release smoke/manual
```

Tests may include the source requirement ID in their title.

Example:

```text
INT-FR-INV-004 rejects Maximum Party Size below current Attendee Count
```

---

# 6. Test Environment Strategy

## 6.1 Local developer environment

Tests use:

- local Next.js application;
- isolated/local Supabase project or local Supabase stack;
- test-only database seeded through migrations/factories;
- non-production cryptographic keys;
- local/private test Storage bucket;
- local email capture or test Auth mechanism for OTP verification.

Production credentials must never be required.

## 6.2 CI environment

CI uses an isolated non-production environment with:

- fresh/reproducible database migrations;
- test users;
- test-only Event/Invitation data;
- test-only cryptographic secrets;
- private test storage;
- no production service-role key.

## 6.3 Preview/staging E2E

A preview/staging environment may run a smaller post-deploy smoke suite.

It must use non-production Supabase/data.

## 6.4 Production

Do not run destructive automated suites against production.

Production verification is limited to safe operational smoke checks defined later in `14-deployment-and-operations.md`.

---

# 7. Deterministic Time

Event lifecycle, RSVP Deadline, and expiration behavior depend on time.

Tests must not wait for real deadlines.

The application/domain layer should expose a testable clock boundary or accept a controlled current instant so tests can evaluate:

- before RSVP Deadline;
- exactly at RSVP Deadline;
- after RSVP Deadline;
- before Event expiration;
- exactly at Event expiration;
- after Event expiration.

The approved behavior is:

```text
Guest RSVP editable only before RSVP Deadline
Guest RSVP read-only at/after deadline
Event Ended at/after calculated expiration
```

Tests should use fixed timestamps in an explicit Event Timezone.

---

# 8. Test Data and Factories

Use typed factories/builders for canonical domain states.

Required fixture builders include at least:

```text
Organizer
Draft Event
Published active Event
Published Event with future deadline
Published Event with passed deadline
Ended Event
Invitation / active credential
Revoked Invitation
Awaiting Response RSVP
Attending RSVP
Declined RSVP
Hero Image reference
```

Factories should default to valid data.

Tests that verify invalid behavior should override only the field relevant to the case.

Do not use production-like personal names/messages when unnecessary. Use synthetic fixtures.

---

# 9. Unit Test Scope

Unit tests cover pure or near-pure domain logic.

## 9.1 Event runtime state

Test:

- Draft remains Draft regardless of future Event time;
- Published before expiration -> Published;
- Published at expiration -> Ended;
- Published after expiration -> Ended;
- expiration uses End Time when provided;
- otherwise expiration is start of next Event-local calendar day.

## 9.2 Event timing validation

Test:

- valid Start/End relationship;
- End Time equal to Start -> invalid;
- End Time before Start -> invalid;
- cross-midnight representation -> invalid;
- deadline before Event Start -> valid;
- deadline equal to Event Start -> invalid;
- deadline after Event Start -> invalid.

## 9.3 Maximum Party Size

Test integer bounds:

```text
1 valid
20 valid
0 invalid
21 invalid
decimal invalid
empty invalid
```

## 9.4 RSVP normalization

Test:

- Attending requires Attendee Count >= 1;
- count cannot exceed current Maximum Party Size;
- 0 through Attendee Count names accepted;
- too many names rejected;
- duplicate names accepted;
- Declined normalizes count to 0;
- Declined clears names;
- Declined clears Dietary Requirements;
- Declined preserves Guest Message.

## 9.5 Guest RSVP permission

Test combinations of:

- Event Draft/Published/Ended;
- revoked/not revoked;
- valid/current Token;
- deadline absent;
- deadline future;
- deadline reached/passed.

## 9.6 CSV cell neutralization

Test at minimum:

```text
=SUM(A1:A2)
+1+1
-1+1
@SUM(A1:A2)
   =SUM(A1:A2)
normal text
apostrophe-prefixed normal text
```

Formula-significant values must be neutralized before CSV quoting.

## 9.7 Filename sanitization

Test Event-derived CSV filename input cannot produce unsafe path/control characters.

## 9.8 Token utility behavior

Without testing cryptographic algorithms themselves, test application wrappers for:

- Token byte length/encoding;
- HMAC result shape;
- encrypt/decrypt round-trip;
- wrong encryption key/version failure;
- regenerated Token differs from previous Token.

---

# 10. Component Test Scope

Component tests verify UI behavior that does not require a full browser/server journey.

Examples:

- RSVP radio-card accessibility semantics;
- conditional Attending fields;
- optional Attendee Name add/remove UI;
- validation message association;
- read-only deadline state;
- Guest saved-response summary;
- Admin status badges;
- destructive confirmation dialog content;
- Event deletion confirmation content;
- Guest Message rendered read-only in Admin RSVP editor;
- disabled/absent mutation controls for Ended Event views;
- keyboard/focus behavior for dialogs where practical.

Component tests do not replace Server Action authorization tests.

---

# 11. Database Constraint Tests

Run against real migrated PostgreSQL.

## 11.1 Schema/migration smoke

Every migration sequence must apply successfully to an empty test database.

The resulting schema must contain the expected:

- enums/domains;
- tables;
- primary/foreign keys;
- indexes;
- RLS enablement;
- functions/policies required by approved implementation.

## 11.2 Event constraints

Test:

- valid Draft may be incomplete;
- invalid Published row cannot bypass publication completeness;
- timing constraints reject invalid relationships where database-enforced.

## 11.3 Invitation constraints

Test:

- Maximum Party Size `1..20`;
- Event FK;
- cascade behavior only when parent Event is actually deleted.

## 11.4 Credential constraints

Test:

- one credential row per Invitation;
- unique Token lookup hash;
- 32-byte HMAC hash constraint;
- credential row cascades when Invitation/Event is permanently deleted.

## 11.5 RSVP constraints

Test:

- one RSVP row per Invitation;
- Awaiting/Declined count = 0;
- Attending count positive;
- names cardinality <= count;
- Declined Dietary Requirements null;
- RSVP cascades when Invitation/Event is permanently deleted.

---

# 12. Row Level Security Tests

RLS tests must use realistic authenticated Supabase user identities rather than only service-role queries.

Create at least two Organizer identities:

```text
Organizer A
Organizer B
```

with separate Events.

## RLS-01 — Event isolation

Organizer A can select/update owned Event but cannot select/update Organizer B's Event through authenticated client access.

## RLS-02 — Invitation isolation

Organizer A cannot retrieve Organizer B's Invitations.

## RLS-03 — RSVP isolation

Organizer A cannot retrieve/update Organizer B's RSVP rows.

## RLS-04 — Insert ownership

Organizer cannot create rows that assign ownership to another Auth user.

## RLS-05 — Credential-table isolation

Ordinary authenticated/anonymous clients cannot directly read Invitation credential rows.

## RLS-06 — Anonymous private-table access

Anonymous client cannot broadly select private Event/Invitation/RSVP rows.

Service-role tests are separate and must prove privileged access is confined to server-only code.

---

# 13. Server Integration / Server Action Tests

These tests call server/domain operations with real validation and persistence.

## 13.1 Authentication / ownership

Test:

- no session -> `AUTH_REQUIRED`;
- wrong Owner -> safe forbidden/not-found behavior;
- correct Owner -> permitted subject to state rules.

## 13.2 Event mutations

Test:

- create incomplete Draft;
- update Draft valid data;
- publish missing field -> `EVENT_NOT_PUBLISHABLE`;
- publish valid Event;
- Published edit remains publication-valid;
- Ended Event ordinary mutation -> `EVENT_NOT_MUTABLE`.

## 13.3 Event deletion

Test:

- Owner deletes Draft Event successfully;
- Owner deletes Ended Event successfully;
- active Published Event -> `EVENT_NOT_DELETABLE`;
- wrong Owner cannot delete;
- dependent DB rows disappear;
- former Guest Token cannot resolve private data;
- Hero Image reference is removed from application state;
- storage cleanup failure leaves no public/authorized Guest path and is surfaced to operational cleanup without restoring deleted business data.

## 13.4 Invitation mutations

Test:

- create Invitation transaction creates Invitation + credential + Awaiting RSVP;
- invalid Maximum Party Size rejected;
- lower Maximum Party Size below Attendee Count -> `MAX_PARTY_SIZE_CONFLICT`;
- Ended Event creation/edit rejected.

## 13.5 Token regeneration/revocation

Test:

- regeneration returns new current URL;
- old Token becomes unusable;
- RSVP unchanged;
- revocation blocks Guest access;
- no restore action exists;
- Ended Event regeneration/revocation rejected.

## 13.6 Organizer RSVP

Test:

- valid Attending edit;
- Declined cleanup;
- Guest Message unchanged;
- injected Guest Message field is rejected/ignored according to schema contract;
- edit after RSVP Deadline succeeds while Event active;
- edit after Ended rejected.

## 13.7 Guest RSVP

Test:

- valid current Token;
- invalid/old/revoked Token unavailable;
- current party limit re-read at mutation time;
- deadline re-read at mutation time;
- declined normalization;
- Guest Message persistence;
- no cross-Invitation mutation.

---

# 14. Organizer OTP Authentication Tests

D-28 requires administratively provisioned accounts and passwordless email OTP.

Automated Auth tests should run against non-production Supabase Auth/local Auth facilities.

## AUTH-01 — Provisioned account receives OTP flow

Given an already provisioned Organizer email, starting sign-in initiates the configured OTP flow.

## AUTH-02 — Correct OTP establishes session

Use a local email capture/test Auth facility to retrieve or verify the generated OTP without using a production inbox.

After verification, the browser/server sees an authenticated Supabase session.

## AUTH-03 — Invalid/expired OTP

Invalid or expired OTP does not establish an Organizer session.

## AUTH-04 — Unknown email does not create account

Attempting OTP sign-in with an unknown email must not auto-create an Auth user.

Verify both:

- no authenticated session;
- no new Organizer/Auth identity was created by the public sign-in flow.

## AUTH-05 — No public sign-up path

The application exposes no public registration workflow.

## AUTH-06 — Organizer route protection

Unauthenticated browser access to Organizer-only Event data does not reveal private records.

Tests must not introduce a production-only OTP bypass.

---

# 15. Guest Browser E2E Suite

Use real browser tests against the running application and test Supabase environment.

Core Guest E2E scenarios:

## E2E-G-01 — Valid personalized Invitation

Open current Token for active Published Event.

Verify:

- personalized Invitee context;
- Host Display Names;
- Event Date/Time/Venue;
- no account requirement;
- RSVP entry available.

## E2E-G-02 — Attending within limit

Submit valid Attending RSVP with Attendee Count within Maximum Party Size.

Verify saved summary and persisted state.

## E2E-G-03 — Optional/partial names

For count `3`, verify 0, 1, and 3 names can be submitted in representative cases.

## E2E-G-04 — Too many names

Verify client validation and server rejection path cannot persist invalid names cardinality.

## E2E-G-05 — Decline after Attending

Verify UI warning/transition and persisted cleanup while Guest Message remains.

## E2E-G-06 — Returning responded Guest

Reopen current link and verify saved summary first, with `Update RSVP` while permitted.

## E2E-G-07 — Deadline read-only

Advance controlled clock to deadline.

Verify Invitation details remain visible and RSVP editing controls are unavailable.

## E2E-G-08 — Reopened deadline

Move/remove deadline through Admin fixture/action before expiration.

Verify Guest edit access becomes available again.

## E2E-G-09 — Regenerated old Token

Verify old link shows privacy-safe unavailable state with no private content.

## E2E-G-10 — Revoked Invitation

Verify privacy-safe unavailable state.

## E2E-G-11 — Draft Event

Verify private Invitation content is unavailable.

## E2E-G-12 — Ended Event

Verify private Invitation content is unavailable.

## E2E-G-13 — Deleted Event

After deleting a Draft/Ended Event, former personalized link exposes no private data.

## E2E-G-14 — Hero Image absent/failure

Verify Invitation remains complete and RSVP usable without Hero Image.

---

# 16. Admin Browser E2E Suite

## E2E-A-01 — OTP sign-in

Complete provisioned Organizer OTP flow in test environment and enter Events area.

## E2E-A-02 — Create incomplete Draft

Save incomplete Event as Draft without publication errors being treated as save blockers.

## E2E-A-03 — Publish blocked

Attempt publication with missing required field and verify field/form errors.

## E2E-A-04 — Publish success

Complete required data, publish, and verify Published state.

## E2E-A-05 — Create Invitation

Create valid Invitation and verify current link/details.

## E2E-A-06 — Maximum Party Size conflict

Given current Attendee Count `3`, try to reduce max to `2`; verify rejection and unchanged committed RSVP.

## E2E-A-07 — Dashboard totals

Verify five approved dashboard metrics against known fixture data.

## E2E-A-08 — Search/filter

Verify Invitee Name substring search combined with RSVP Status filter.

## E2E-A-09 — Edit RSVP

Verify allowed fields, Declined cleanup, and Guest Message read-only behavior.

## E2E-A-10 — Regenerate link

Confirm warning, rotate Token, verify new link available.

## E2E-A-11 — Revoke

Confirm destructive action and verify preserved Admin RSVP data.

## E2E-A-12 — Reopen RSVP

Change/remove deadline before expiration and verify derived open state.

## E2E-A-13 — CSV export

Download Event CSV and verify all Invitations and approved columns.

## E2E-A-14 — Ended Event read-only

Verify records/search/export remain available while ordinary mutation controls are unavailable.

## E2E-A-15 — Delete Draft Event

Confirm permanent deletion and return to Event index.

## E2E-A-16 — Delete Ended Event

Verify D-27 exception is available despite ordinary Ended read-only behavior.

## E2E-A-17 — Active Published Event cannot be deleted

Verify self-service deletion is absent/unavailable and server rejects crafted direct attempt.

---

# 17. Concurrency and Race-Condition Tests

Concurrency tests must run against real transactional persistence.

## CONC-01 — RSVP versus Maximum Party Size

Initial state:

```text
Maximum Party Size = 3
Attendee Count <= 3
```

Race:

- transaction A attempts Attendee Count `3`;
- transaction B attempts Maximum Party Size `2`.

Expected:

- at most one conflicting mutation commits;
- final persisted state always satisfies `attendee_count <= maximum_party_size`.

## CONC-02 — Two simultaneous Token regenerations

Expected:

- each successful regeneration is atomic;
- database ends with exactly one current credential;
- only final committed current Token resolves;
- RSVP remains unchanged.

## CONC-03 — Deadline boundary during Guest submission

Guest form rendered before deadline; controlled clock/state advances to deadline before mutation.

Expected:

```text
RSVP_READ_ONLY
```

and no RSVP update.

## CONC-04 — Event expiration during Organizer mutation

Organizer form rendered while Published; Event becomes Ended before mutation commits.

Expected:

```text
EVENT_NOT_MUTABLE
```

except dedicated D-27 deletion when Ended is allowed.

## CONC-05 — Delete versus Guest read/write

When Event deletion commits, no later Guest request may retrieve private data from former Tokens.

In-flight operations must not recreate deleted dependent rows.

---

# 18. CSV Export Tests

## CSV-01 — Required header order

Verify exact approved header order.

## CSV-02 — Includes all Invitations

Awaiting, Attending, and Declined Invitations all appear.

## CSV-03 — Count rules

Verify:

- Attending -> stored current Attendee Count;
- Awaiting -> `0`;
- Declined -> `0`.

## CSV-04 — Attendee Names serialization

Multiple names serialize in one cell with approved semicolon separator.

## CSV-05 — RFC-4180 escaping

Test:

- commas;
- quotes;
- line breaks;
- Unicode.

## CSV-06 — Formula injection

For every user-controlled exported field, test dangerous first meaningful characters:

```text
=
+
-
@
```

including values with leading whitespace.

Verify exported cell is neutralized before CSV escaping.

## CSV-07 — Credential exclusion

Verify output contains no:

- raw Token;
- personalized URL;
- Token hash;
- Token ciphertext;
- internal IDs.

## CSV-08 — Ended Event export

Owner can export Ended Event.

## CSV-09 — Unauthorized export

Wrong/unauthenticated Organizer cannot obtain CSV.

---

# 19. Hero Image Upload Security Tests

## UPLOAD-01 — Allowed raster formats

Valid JPEG, PNG, and WebP test files are accepted when within configured size.

## UPLOAD-02 — SVG rejected

SVG is rejected.

## UPLOAD-03 — MIME/extension mismatch

File claiming image MIME but with invalid/disallowed magic bytes is rejected.

## UPLOAD-04 — Size limit

A file over 10 MiB is rejected.

Boundary case at allowed limit should be tested according to exact byte implementation.

## UPLOAD-05 — Ownership

Organizer cannot upload/replace/remove Hero Image for another Owner's Event.

## UPLOAD-06 — Ended Event

Hero Image mutation for Ended Event is rejected.

## UPLOAD-07 — Private read

Storage object is not publicly readable; valid Guest access receives authorized/signed read URL.

## UPLOAD-08 — Deleted Event

After Event deletion, former application references cannot authorize Hero Image access. Orphan cleanup behavior is verified according to the operations implementation.

---

# 20. Security Regression Mapping

Every approved security regression from `10-security-and-privacy.md` is mandatory.

| Security requirement | Required automated coverage |
|---|---|
| SEC-TEST-01 Token isolation | INT guest resolution + E2E negative token isolation |
| SEC-TEST-02 Token invalidation | INT regeneration + E2E old link |
| SEC-TEST-03 Revocation | INT + E2E unavailable |
| SEC-TEST-04 Draft / Ended Guest denial | INT + E2E |
| SEC-TEST-05 Organizer ownership | RLS + INT + selected E2E |
| SEC-TEST-06 Service-role boundary | static/build/config test + server module test |
| SEC-TEST-07 Server validation bypass | INT crafted-input suite |
| SEC-TEST-08 XSS | component/E2E inert-text assertions |
| SEC-TEST-09 Malicious upload | UPLOAD suite |
| SEC-TEST-10 CSV formula injection | CSV unit + integration download |
| SEC-TEST-11 Log redaction | log-capture integration tests |
| SEC-TEST-12 Rate limiting | integration/HTTP abuse-limit tests once concrete deployment thresholds are defined |

SEC-TEST-12 can use configuration-driven thresholds in tests. The concrete production numeric limits remain owned by `14-deployment-and-operations.md`.

---

# 21. Log Redaction Tests

Capture application logs in test environment for representative requests/errors.

Assert logs do not contain:

- raw Invitation Token;
- full personalized Invitation URL;
- decrypted Token;
- service-role key;
- HMAC/encryption keys;
- Supabase session tokens;
- Guest Message;
- Dietary Requirements;
- Attendee Names;
- Organizer Contact Information.

Use unique synthetic sentinel strings in test input so accidental leakage is easy to detect.

---

# 22. XSS / Content-Safety Tests

Use synthetic payloads such as:

```text
<script>alert(1)</script>
<img src=x onerror=alert(1)>
javascript:alert(1)
```

Verify:

- free-text fields render as inert text;
- no arbitrary HTML execution;
- `venue_map_url` rejects unsafe schemes;
- external navigation cannot use `javascript:` or `data:` URLs.

Do not rely only on snapshot output; assert DOM behavior and attribute safety.

---

# 23. Accessibility Testing

Automated accessibility checks are necessary but not sufficient.

## 23.1 Automated

Run axe-equivalent checks on representative pages/states:

Guest:

- valid Awaiting RSVP;
- Attending form;
- saved response;
- deadline read-only;
- unavailable Invitation.

Admin:

- Events index;
- Event Settings;
- Overview;
- Invitations list;
- Invitation detail;
- destructive confirmation dialogs.

## 23.2 Keyboard

Manually or through browser automation verify:

- logical Tab order;
- visible focus;
- RSVP radio keyboard behavior;
- add/remove Attendee Name controls;
- dialogs trap/return focus;
- search/filter controls;
- no pointer-only required action.

## 23.3 Screen-reader semantics

At minimum inspect:

- heading hierarchy;
- field labels/descriptions/errors;
- status text;
- live-region save/validation announcements;
- table semantics;
- read-only states.

Exact screen-reader/browser matrix may be finalized in Development/Operations, but accessibility requirements themselves are not optional.

---

# 24. Responsive Regression Testing

V1 must protect the mobile-first Guest experience and responsive Admin behavior.

Required browser viewport classes:

```text
phone-sized
tablet-sized
desktop-sized
```

Representative assertions:

- no Guest horizontal scrolling;
- RSVP controls remain usable on phone;
- Guest text/actions do not overlap;
- Admin mobile Invitation cards expose required data/actions;
- desktop Invitation table remains readable;
- dialogs/forms fit narrow viewports;
- 44px primary interactive targets remain practical.

Exact pixel viewport values may be defined in Playwright configuration.

---

# 25. PRD Functional Requirement Coverage

Each PRD requirement must have automated coverage at one or more layers.

| PRD requirement | Primary test layer |
|---|---|
| FR-EVT-001 Draft save | INT + E2E-A |
| FR-EVT-002 Publication required fields | Unit/INT + E2E-A |
| FR-EVT-003 Optional Event fields | INT + selected E2E |
| FR-EVT-004 Lifecycle | Unit + INT + E2E |
| FR-EVT-005 Timing | Unit + INT |
| FR-EVT-006 Ended read-only | INT + E2E-A |
| FR-EVT-007 Retention/permanent deletion | DB + INT + E2E-A/G |
| FR-INV-001 Create Invitation | DB + INT + E2E-A |
| FR-INV-002 Personalized Guest link | INT + E2E-G |
| FR-INV-003 Maximum Party Size bounds | Unit + DB + INT |
| FR-INV-004 Maximum Party Size reduction | INT + CONC |
| FR-INV-005 Regeneration | INT + E2E |
| FR-INV-006 Revocation | INT + E2E |
| FR-INV-007 Search/filter | INT + E2E-A |
| FR-RSVP-001 Status values | DB + INT |
| FR-RSVP-002 Guest status changes | INT + E2E-G |
| FR-RSVP-003 Attendee Count | Unit + DB + INT |
| FR-RSVP-004 Attendee Names | Unit + DB + E2E-G |
| FR-RSVP-005 Dietary/Guest Message | INT + E2E |
| FR-RSVP-006 Declined cleanup | Unit + DB + INT + E2E |
| FR-RSVP-007 Deadline | Unit + INT + E2E-G + CONC |
| FR-RSVP-008 Reopen | INT + E2E-A/G |
| FR-RSVP-009 Organizer RSVP editing | INT + E2E-A |
| FR-DASH-001 Dashboard totals | Integration query + E2E-A |
| FR-DASH-002 Expected attendee total | Unit/query + E2E-A |
| FR-CSV-001 Event-scoped export | INT/CSV |
| FR-CSV-002 Required fields | CSV |
| FR-CSV-003 Exclusions | CSV + SEC |
| FR-CSV-004 Count rules | CSV |
| FR-PRES-001 Wedding-focused experience | Component + E2E-G + visual/manual review |
| FR-PRES-002 Mobile-first | RESP + E2E-G |
| FR-SEC-001 Token access | INT + SEC + E2E-G |
| FR-SEC-002 Server validation | INT crafted-input suite |
| FR-SEC-003 Organizer authorization | RLS + INT |
| FR-SEC-004 Provisioning/OTP | AUTH + E2E-A |

---

# 26. End-to-End Acceptance Scenario Coverage

The PRD end-to-end acceptance scenarios must remain uniquely identified.

| PRD scenario | Required coverage |
|---|---|
| AS-001 Publish and share | E2E-A + E2E-G |
| AS-002 Guest accepts within limit | E2E-G-02 |
| AS-003 Guest cannot exceed limit | INT + E2E-G negative |
| AS-004 Guest declines after attending | E2E-G-05 |
| AS-005 Deadline read-only | E2E-G-07 |
| AS-006 Organizer reopens RSVP | E2E-A-12 + E2E-G-08 |
| AS-007 Revoked Invitation | E2E-A-11 + E2E-G-10 |
| AS-008 Token regeneration | E2E-A-10 + E2E-G-09 |
| AS-009 CSV excludes credentials | CSV-07 |
| AS-010 Owner deletes Draft/Ended Event | E2E-A-15/16 + E2E-G-13 |
| AS-011 Active Published Event cannot be deleted | E2E-A-17 + INT |
| AS-012 Provisioned Organizer OTP | AUTH + E2E-A-01 |

The duplicate acceptance-scenario numbering introduced during earlier D-27/D-28 propagation is corrected editorially in the accompanying `02-prd.md`; behavior is unchanged.

---

# 27. API Contract Acceptance Coverage

At minimum automate:

| API scenario | Coverage |
|---|---|
| API-AS-01 Ended mutation rejected | INT |
| API-AS-02 Ended export allowed | CSV/INT |
| API-AS-03 RSVP race safety | CONC-01 |
| API-AS-04 Deadline race | CONC-03 |
| API-AS-05 Token rotation | INT + E2E |
| API-AS-06 Guest Message immutable by Organizer | INT |
| API-AS-07 Unauthorized Organizer | RLS + INT |
| API-AS-08 CSV credential exclusion | CSV-07 |
| API-AS-09 Draft/Ended Event deletion | INT + DB + E2E |
| API-AS-10 Active Published deletion rejected | INT + E2E |
| API-AS-11 CSV formula neutralization | CSV-06 |

---

# 28. Visual Regression Scope

Pixel-perfect screenshot testing is not the primary V1 correctness strategy.

Use targeted visual regression only for stable, high-value surfaces such as:

- Guest personalized Hero/summary layout;
- RSVP form core state;
- Admin dashboard metric layout;
- Invitations desktop table;
- mobile Invitation card;
- destructive confirmation dialogs.

Do not allow large snapshot suites to replace semantic/accessibility assertions.

Visual updates require intentional review rather than blind snapshot regeneration.

---

# 29. Test Isolation and Cleanup

Each test must own its data.

Requirements:

- generate unique synthetic identifiers;
- do not depend on suite execution order;
- clean/reset isolated database state between tests/suites;
- isolate Storage objects by test namespace;
- remove test upload objects after suite completion when possible;
- never depend on a previous test's Token;
- do not reuse production secrets.

Parallel test execution must not create cross-test Event/Invitation collisions.

---

# 30. Flaky Test Policy

A flaky critical test is a defect in the test or implementation.

Rules:

- do not merge by repeatedly re-running until green without investigation;
- avoid arbitrary sleeps;
- wait on explicit UI/network/application states;
- control time rather than waiting for real deadlines;
- use deterministic fixtures;
- record and fix root cause.

A quarantined non-critical test must have a tracked owner/reason and must not silently reduce security/acceptance coverage.

---

# 31. CI Quality Gates

A change should not be merged when any required changed-scope test fails.

Minimum pull-request gates should include:

1. TypeScript/type checking;
2. lint/static checks defined later in Development Architecture;
3. unit tests;
4. component tests for changed UI behavior;
5. database migration/constraint/RLS tests;
6. server integration tests;
7. critical Guest/Admin E2E smoke;
8. security regressions relevant to changed code.

A fuller E2E/security matrix may run on main/nightly/pre-release depending on CI duration.

Exact CI provider and job topology are deferred to `12-development-architecture.md` and `14-deployment-and-operations.md`.

---

# 32. Coverage Policy

V1 does not define a numeric line/branch coverage percentage as a product quality target.

Required coverage is behavior-based:

- every PRD functional requirement mapped;
- every PRD end-to-end acceptance scenario mapped;
- every Security Section 32 regression mapped;
- every approved destructive/high-impact path mapped;
- every RLS ownership relationship tested;
- every cross-table concurrency invariant tested.

Coverage reports may still be generated to identify untested code, but passing a percentage must not substitute for required scenario coverage.

---

# 33. Manual Release Verification

Before production release, perform a short manual verification on a production-like non-production environment.

At minimum verify:

- OTP email flow using test/staging mail infrastructure;
- Guest Invitation on a real phone-sized browser/device;
- Admin responsive usability;
- external map link behavior;
- Hero Image upload/display;
- CSV download/open in a spreadsheet application;
- keyboard navigation through Guest RSVP and one Admin destructive dialog;
- reduced-motion behavior;
- no private data appears in page metadata/share preview;
- security headers are present;
- personalized Token is not sent as referrer when following external map link.

Do not use real Invitee private data for release verification.

---

# 34. Test Data Privacy

Test fixtures must not copy production Invitee or RSVP data into local/CI environments.

Use synthetic data for:

- names;
- messages;
- dietary text;
- contact information;
- email addresses.

If a production incident requires reproducing a data-shape issue, sanitize/minimize the reproduction fixture before using it outside production.

---

# 35. Failure Evidence

When CI/E2E fails, retain enough safe evidence to diagnose the failure:

- test ID/name;
- browser screenshot/video where configured;
- sanitized DOM/network trace;
- correlation ID;
- safe internal Event/Invitation IDs where useful.

Failure artifacts must redact:

- raw Invitation Tokens;
- personalized URLs containing Tokens;
- OTP codes;
- Supabase session tokens;
- service-role/cryptographic secrets;
- protected RSVP free text where not necessary.

---

# 36. Testing Decisions Proposed by This Document

These are engineering/test decisions, not product/business rules.

### TEST-D01 — Vitest for TypeScript unit/integration tests

Use Vitest as the preferred V1 unit/service test runner.

### TEST-D02 — Playwright for browser E2E

Use Playwright for Guest/Admin browser automation.

### TEST-D03 — Real migrated Supabase/PostgreSQL for DB/RLS tests

Do not mock away database constraints or RLS in the tests intended to prove them.

### TEST-D04 — Controlled clock for time-dependent behavior

Do not use real waiting to test deadline/Event expiration boundaries.

### TEST-D05 — Scenario coverage over arbitrary code-coverage percentage

Approved requirements/security scenarios are the release-quality baseline.

### TEST-D06 — Synthetic test data only

Production personal data is not copied into routine test environments.

---

# 37. Explicit Technical Deferrals

This Testing Strategy does not finalize:

- exact test-package versions;
- exact test folder layout;
- exact CI provider;
- exact parallel-worker counts;
- exact browser-version matrix;
- exact screenshot baseline storage;
- exact test database reset command;
- exact local email-capture implementation;
- exact production rate-limit numbers;
- exact monitoring vendor.

Those are implementation/operations details for later specifications.

None of these deferrals change approved product behavior.

---

# 38. Review Checklist

Before marking this document Approved, confirm:

- testing layers are sufficient;
- real database/RLS behavior is tested rather than mocked;
- time-dependent behavior uses a deterministic clock;
- D-28 OTP/no-signup behavior has automated coverage;
- D-27 Draft/Ended deletion and active-Published rejection are covered;
- all 12 Security regressions are mapped;
- CSV formula neutralization is tested;
- Token regeneration/revocation are covered at integration and E2E layers;
- Organizer cross-tenant authorization has RLS and server coverage;
- concurrency tests protect party-size and deadline invariants;
- Guest and Admin critical journeys have browser coverage;
- accessibility and responsive behavior have explicit coverage;
- production personal data are excluded from tests;
- no missing business rule was invented by the test strategy.

---

# 39. Next Document

After this Testing Strategy is reviewed and approved, create:

**`12-development-architecture.md`**

The Development Architecture should define the Codex-facing repository structure, modules, naming, TypeScript conventions, dependency rules, validation/schema organization, state-management rules, component boundaries, test file organization, coding standards, and implementation workflow needed to realize the approved specifications without changing product behavior.
