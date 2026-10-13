# 12 — Development Architecture

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document defines the V1 Codex-facing implementation structure for the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, `03-user-flows.md`, `04-technical-architecture.md`, `05-data-model.md`, `06-design-system-and-ui-foundation.md`, `07-guest-experience-spec.md`, `08-admin-dashboard-spec.md`, `09-api-and-server-contracts.md`, `10-security-and-privacy.md`, and `11-testing-strategy.md`. It is lower precedence than those specifications and must not change their business behavior.

---

## 1. Purpose

This document turns the approved architecture and contracts into concrete repository and coding conventions for implementation with Codex.

It defines:

- repository shape;
- package-manager convention;
- Next.js route organization;
- Server Component / Client Component boundaries;
- module boundaries;
- dependency direction;
- Supabase client boundaries;
- persistence organization;
- Server Action and Route Handler adapters;
- TypeScript rules;
- validation/schema organization;
- domain error handling;
- Event time handling;
- Token/security module placement;
- Hero Image upload/finalization structure;
- CSV implementation placement;
- UI/component organization;
- form and state-management conventions;
- Tailwind/design-token organization;
- environment-variable access;
- logging/redaction wrappers;
- test-file organization;
- migrations/generated database types;
- implementation workflow for Codex;
- quality gates and review rules.

This document does not alter V1 scope, permissions, lifecycle, privacy, security, or acceptance criteria.

---

# 2. Development Architecture Principles

### DEV-P01 — One implementation path per business rule

Business rules belong in server/domain modules and are called by thin route/action adapters.

Do not independently reimplement the same rule in:

- page components;
- Server Actions;
- database query helpers;
- client form handlers.

Client validation may mirror safe validation for UX but is never authoritative.

### DEV-P02 — Server-first by default

Use Server Components and server-only modules by default.

Client Components are introduced only when browser state or browser APIs are required.

### DEV-P03 — Feature cohesion without framework leakage

Event, Invitation, RSVP, Guest Access, export, and authentication behavior should be discoverable by domain capability rather than scattered through pages.

Framework adapters call domain/application modules; domain modules do not depend on React or Next.js request objects.

### DEV-P04 — Privileged code is visibly isolated

Service-role access, Token cryptography, secret access, and private Storage operations live in clearly server-only modules.

### DEV-P05 — No speculative platform architecture

V1 is one Next.js application, not a microservice system or monorepo of speculative services.

### DEV-P06 — Tests mirror the architecture

Pure rules are unit-tested; persistence/RLS uses real database integration tests; browser behavior uses Playwright.

---

# 3. Repository Model

V1 uses a **single application repository**.

Do not introduce:

- Turborepo;
- Nx;
- multiple deployable services;
- separate frontend/backend repositories;
- a shared-package workspace

unless a later approved architecture change actually requires them.

The application deploys as one Next.js application on Vercel with Supabase as the external Auth/PostgreSQL/Storage platform.

---

# 4. Package Manager and Dependency Freshness

V1 uses:

```text
pnpm
```

Repository requirements:

- commit `pnpm-lock.yaml`;
- set the exact selected pnpm version in the `packageManager` field;
- CI uses the locked dependency graph / frozen lockfile;
- do not commit lockfiles for other package managers.

## 4.1 Implementation-time version rule

At repository bootstrap and whenever a dependency is added or upgraded, Codex must **actively check current authoritative sources** and select the **latest stable, production-supported, mutually compatible release available at that time**.

Do not rely on package versions remembered from model training.

Authoritative sources include:

- official npm package metadata/registry;
- official framework/library documentation and release notes;
- official Vercel compatibility/runtime documentation;
- official Supabase documentation;
- official Node.js and pnpm release/support information.

Do not use prerelease channels or versions such as:

```text
alpha
beta
rc
canary
next
nightly
experimental
preview
```

unless an approved specification/ADR later explicitly requires one.

If the newest stable release is incompatible with another approved dependency/platform, use the newest **stable compatible** release and document the compatibility reason.

If current version information cannot be verified, do not guess from model memory; stop the dependency/bootstrap step until it can be verified.

## 4.2 Runtime/toolchain selection

At M1 bootstrap, verify current compatibility across at least:

- Node.js;
- pnpm;
- Next.js;
- React / React DOM;
- TypeScript;
- Tailwind CSS;
- Supabase client/SSR packages used by Auth;
- Zod;
- Motion;
- Vitest;
- React Testing Library;
- Playwright;
- ESLint;
- Prettier.

For Node.js, prefer the latest production-supported **Active LTS** line compatible with the current stable Next.js/Vercel stack unless official platform guidance requires another supported stable line.

Exact numeric versions are recorded in repository configuration (`package.json`, runtime configuration, lockfile) at implementation time rather than frozen into this long-lived architecture specification.

Changing package manager later is an engineering change, not a product change, but should not be done casually during implementation.

---

# 5. Top-Level Repository Structure

Use this conceptual structure:

```text
/
├── src/
│   ├── app/
│   ├── components/
│   ├── modules/
│   ├── server/
│   ├── lib/
│   ├── styles/
│   └── types/
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
│
├── tests/
│   ├── integration/
│   ├── rls/
│   ├── e2e/
│   ├── security/
│   ├── fixtures/
│   └── helpers/
│
├── public/
├── scripts/
├── docs/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.*
├── eslint.config.*
└── README.md
```

The final extension of configuration files follows the versions installed during bootstrap.

The `docs/` directory contains the approved project source-of-truth Markdown specifications.

---

# 6. `src/app` — Next.js Route Layer

`src/app` owns:

- route composition;
- layouts;
- pages;
- loading/error boundaries;
- route handlers;
- thin Server Action adapters where route-local placement is useful.

It must not own core domain logic.

## 6.1 Required V1 route structure

Use these application paths:

```text
/i/[token]

/admin/sign-in
/admin/events
/admin/events/new
/admin/events/[eventId]
/admin/events/[eventId]/invitations
/admin/events/[eventId]/invitations/new
/admin/events/[eventId]/invitations/[invitationId]
/admin/events/[eventId]/settings

/admin/events/[eventId]/export.csv
```

Meanings:

```text
/i/[token]
    Personalized Guest Invitation

/admin/sign-in
    Provisioned Organizer passwordless OTP entry

/admin/events
    Events index

/admin/events/new
    Create Event Draft

/admin/events/[eventId]
    Event Overview

/admin/events/[eventId]/invitations
    Invitation list/search/filter

/admin/events/[eventId]/invitations/new
    Create Invitation

/admin/events/[eventId]/invitations/[invitationId]
    Invitation detail / RSVP administration

/admin/events/[eventId]/settings
    Event Settings / publication / Event deletion where allowed

/admin/events/[eventId]/export.csv
    CSV Route Handler
```

The application root `/` is not assigned a new V1 product workflow by this document.

## 6.2 Route groups

Route groups may organize presentation without changing URLs:

```text
src/app/
├── (guest)/
│   └── i/[token]/
└── (admin)/
    └── admin/
```

Use route groups only for layouts/error boundaries, not as domain modules.

---

# 7. Server Component and Client Component Rules

## 7.1 Server Components

Use Server Components for:

- Organizer page data reads;
- Guest Invitation resolution;
- dashboard metrics;
- Invitation list/detail reads;
- current RSVP display;
- Event Settings initial data;
- authorized Hero Image signed-read URL acquisition.

Server Components may call approved server query/application functions.

They must not import service-role or cryptographic modules directly when a narrower application service exists.

## 7.2 Client Components

Use Client Components only for interactions such as:

- RSVP form state;
- dynamic Attendee Name inputs;
- copy-to-clipboard;
- confirmation dialogs;
- search/filter controls when client interaction is useful;
- OTP code entry;
- local optimistic/pending UI;
- approved Motion effects.

A Client Component never becomes the authorization or validation boundary.

## 7.3 `"use client"` containment

Keep `"use client"` as low in the component tree as practical.

Do not mark an entire Guest or Admin page as a Client Component merely because one child needs browser state.

---

# 8. `src/modules` — Domain/Application Modules

Use feature modules:

```text
src/modules/
├── events/
├── invitations/
├── rsvps/
├── guest-access/
├── auth/
├── dashboard/
└── exports/
```

Each module may contain:

```text
types.ts
schemas.ts
domain.ts
service.ts
queries.ts
mappers.ts
```

Not every module needs every file. Avoid empty architectural ceremony.

## 8.1 Responsibilities

`types.ts`
: Domain/application TypeScript types not generated from the database.

`schemas.ts`
: Zod input schemas for that feature.

`domain.ts`
: Pure rules/calculations/normalization.

`service.ts`
: Server-only use cases coordinating authorization, domain logic, and persistence.

`queries.ts`
: Read-oriented application queries/projections.

`mappers.ts`
: Explicit database-to-domain/view conversions when needed.

## 8.2 Dependency rule

Allowed:

```text
route/page/action
    -> module service/query
        -> domain + server persistence/security adapters
```

Not allowed:

```text
domain
    -> React
domain
    -> Next.js routing
domain
    -> browser APIs
persistence
    -> UI components
```

---

# 9. `src/server` — Infrastructure and Privileged Code

Use:

```text
src/server/
├── db/
├── supabase/
├── security/
├── storage/
├── observability/
└── rate-limit/
```

Every file that must never enter a client bundle should use an explicit server-only boundary such as:

```ts
import "server-only";
```

where supported.

---

# 10. Supabase Client Organization

Use separate constructors/adapters for distinct privilege levels.

Conceptually:

```text
src/server/supabase/
├── authenticated.ts
├── service-role.ts
└── types.ts
```

Client/browser Supabase usage, where required for the supported Auth flow, lives separately from privileged server modules.

## 10.1 Authenticated server client

Used for Organizer session-aware access where RLS should remain active.

It must derive identity from the server-resolved Supabase session, not a browser-provided user ID.

## 10.2 Service-role client

Used only for narrow approved operations that require bypassing RLS.

Examples may include:

- Token credential lookup;
- Token credential rotation;
- controlled Guest RSVP persistence;
- narrowly scoped Storage administration.

The service-role client must not be exported from a generic `lib` barrel.

## 10.3 Browser client

If the Supabase OTP integration needs a browser client, it exposes only publishable/anon configuration.

It must never receive service-role or Token cryptographic secrets.

---

# 11. Database Access Layer

Use:

```text
src/server/db/
├── events.ts
├── invitations.ts
├── rsvps.ts
├── credentials.ts
├── dashboard.ts
└── transactions.ts
```

These modules translate between application requests and PostgreSQL/Supabase operations.

Rules:

- no React imports;
- no UI copy;
- no direct access from Client Components;
- no business authorization based solely on input IDs;
- database errors are converted to safe internal/application errors before reaching UI adapters.

---

# 12. Transactional Operations

Cross-table invariants must use the approved transactional persistence strategy.

Critical operations include:

- Invitation creation with current credential + Awaiting Response RSVP;
- Guest RSVP changes relative to Maximum Party Size;
- Organizer RSVP changes;
- Maximum Party Size changes relative to current Attendee Count;
- Token regeneration;
- publication transitions where atomic validation/state change is needed;
- Event database deletion.

Supabase client calls that cannot guarantee the necessary multi-row atomicity must not be chained as if they were one transaction.

Use PostgreSQL functions/RPCs or equivalent controlled database transactions defined through migrations for those operations.

Exact SQL function names follow repository naming conventions and are implementation details, but each function must correspond to one approved domain operation rather than becoming a generic privileged mutation endpoint.

---

# 13. Migration Ownership

All schema, RLS, function, trigger, and index changes live in:

```text
supabase/migrations/
```

Rules:

- migrations are append-only after they have been shared/applied;
- do not manually edit a production-applied migration to change history;
- create a new migration for later changes;
- migrations must be runnable from a fresh database in order;
- RLS policy changes are versioned through migrations;
- transaction functions used by the application are versioned through migrations.

`supabase/seed.sql` contains only safe synthetic local-development/test seed data.

---

# 14. Generated Database Types

Generate TypeScript database types from the migrated Supabase/PostgreSQL schema.

Store generated types under a clearly generated path such as:

```text
src/types/database.generated.ts
```

Rules:

- generated database types are not hand-edited;
- application/domain types do not need to mirror database row types one-to-one;
- map snake_case database fields into camelCase application/view types at module boundaries;
- regenerate types after schema migrations that affect the application.

---

# 15. TypeScript Rules

Use TypeScript with strict checking.

Required compiler intent:

```text
strict = true
noImplicitAny = true
strictNullChecks = true
noUncheckedIndexedAccess = true
```

The exact `tsconfig` may add framework-required options.

## 15.1 `any`

Avoid `any`.

For untrusted/external values use:

```ts
unknown
```

then parse/refine.

An unavoidable `any` requires a narrow local comment explaining why.

## 15.2 Nullability

Preserve the approved distinction between:

- absent/optional Event data;
- null optional database fields;
- required published data.

Do not use non-null assertions merely to silence type errors around Draft Event fields.

## 15.3 Domain enums

Use string literal unions matching approved values.

Example:

```ts
type RsvpStatus =
  | "awaiting_response"
  | "attending"
  | "declined";
```

Do not invent alternate states.

## 15.4 Exhaustiveness

Use exhaustive `switch` handling for closed domain unions where practical.

A newly introduced state should fail type checking/test review until explicitly handled.

---

# 16. Naming Conventions

Use:

```text
React component               PascalCase
Type / interface              PascalCase
function / variable           camelCase
constant                      camelCase or UPPER_SNAKE_CASE for true config constants
database table/column         snake_case
route segment                 kebab-case where words are needed
ordinary source file          kebab-case.ts / kebab-case.tsx
Next.js reserved file         framework-required name
test file                     *.test.ts / *.test.tsx
Playwright spec               *.spec.ts
```

Canonical product terms remain:

- Organizer;
- Event;
- Invitation;
- Invitee;
- Invitation Token;
- Maximum Party Size;
- RSVP;
- Attendee;
- Attendee Count;
- RSVP Deadline.

Do not rename these concepts in code to generic alternatives such as `participant`, `booking`, or `partyRecord`.

---

# 17. Validation Architecture

Zod is the V1 runtime validation library.

Use two complementary levels.

## 17.1 Structural/input schemas

Feature `schemas.ts` files validate:

- primitive type;
- enum value;
- blank/nonblank requirement;
- fixed bounds such as Maximum Party Size `1..20`;
- array shape;
- safe URL scheme;
- upload metadata shape;
- search/filter enum.

## 17.2 Domain validation

Rules depending on current persisted state or multiple entities belong in domain/application logic.

Examples:

- Maximum Party Size cannot fall below current Attendee Count;
- RSVP count cannot exceed current Invitation maximum;
- Event is not Ended for ordinary mutations;
- deadline before Event Start;
- Event publication completeness;
- Token current/revoked state.

Do not attempt to place all stateful rules into one client-shareable Zod schema.

## 17.3 Client reuse

Client-side code may reuse safe structural schemas when useful.

Server code must always parse again.

---

# 18. Server Action Architecture

Server Actions are thin adapters.

A Server Action should conceptually do:

```text
receive FormData / typed input
    ↓
parse structural input
    ↓
resolve authenticated session when required
    ↓
call one application service
    ↓
map expected domain error to ActionFailure
    ↓
revalidate/redirect as appropriate
```

It should not contain:

- SQL;
- service-role client construction;
- Token cryptography;
- duplicated authorization;
- complex business branching that belongs to a module service.

## 18.1 Result envelope

Use the approved API result envelope.

Expected failures are returned as typed action results.

Unexpected errors are logged through the redacting server logger and converted to `INTERNAL_ERROR`.

---

# 19. Route Handler Architecture

Route Handlers are used only where an HTTP response is the natural boundary.

Primary V1 example:

```text
GET /admin/events/[eventId]/export.csv
```

The handler:

1. resolves authenticated Organizer;
2. calls the export service;
3. receives already-safe CSV bytes/text;
4. sets approved headers;
5. returns the file response.

CSV serialization, credential exclusion, and formula neutralization belong to the export module, not the route handler.

Do not add a parallel REST layer for ordinary first-party forms.

---

# 20. Authentication Module

Use:

```text
src/modules/auth/
```

for application-level Organizer sign-in adapters and guards.

V1 behavior follows D-28.

## 20.1 Request OTP

The OTP request path must configure Supabase so an unknown email does not auto-create an account.

Where supported by the Supabase API, explicitly set the equivalent of:

```text
shouldCreateUser = false
```

Do not rely on project defaults alone.

## 20.2 Verify OTP

OTP verification establishes the supported Supabase authenticated session.

Do not introduce:

- password login;
- password reset;
- public registration;
- MFA enrollment

in V1.

## 20.3 Route protection

Admin pages must resolve the server session before private Event data is returned.

A route redirect is UX; ownership checks remain in server queries/services.

---

# 21. Authorization Helpers

Centralize reusable authorization helpers in server-only code.

Examples:

```text
requireOrganizerSession()
requireOwnedEvent(eventId)
assertEventMutable(event, now)
assertEventDeletable(event, now)
```

These helpers must not return more data than the caller needs.

`assertEventDeletable` reflects D-27:

```text
Draft -> deletable
Published active -> not deletable
Ended -> deletable
```

Do not encode Event deletion as an exception hidden inside generic `assertEventMutable`; it is a separate approved operation.

---

# 22. Event Time and Clock Boundary

Centralize Event-local time calculations.

Use one server-side clock abstraction for domain operations so tests can inject a fixed instant.

Conceptually:

```ts
interface Clock {
  now(): Date;
}
```

Production uses the real clock.

Tests use a fixed clock.

Centralize helpers for:

- Event Start instant;
- Event expiration instant;
- RSVP Deadline instant;
- runtime Event state;
- deadline editability.

Do not compare browser-local dates to enforce business rules.

Use Event Timezone as the authoritative timezone input.

---

# 23. Guest Access Module

Use a server-only Guest Access service such as:

```text
src/modules/guest-access/
```

Primary operation:

```text
resolveGuestInvitation(rawToken)
```

Responsibilities follow the approved Technical Architecture/API contract:

- validate Token shape;
- compute HMAC lookup;
- resolve one credential/Invitation;
- evaluate current Token;
- evaluate revocation;
- evaluate Event publication/expiration;
- evaluate deadline write permission;
- return only Guest-safe data.

Guest pages do not query Invitations directly by browser-visible UUID.

---

# 24. Invitation Token Security Module

Use:

```text
src/server/security/invitation-token.ts
```

or an equivalently isolated server-only module.

It owns wrappers for:

- CSPRNG Token generation;
- URL-safe encoding;
- HMAC-SHA-256 lookup;
- AES-256-GCM encryption/decryption;
- key-version selection;
- envelope parsing.

Rules:

- use platform/library cryptography;
- do not implement cryptographic primitives;
- keys come only from validated server environment configuration;
- no raw Token logging;
- no Client Component imports;
- return opaque credential values only to authorized application services.

---

# 25. Environment Configuration

Create one validated environment module.

Conceptually:

```text
src/server/env.ts
```

Server code should not read arbitrary `process.env.*` throughout the codebase.

The module validates required server secrets at startup/build/runtime as appropriate.

Server-only values include:

```text
SUPABASE_SERVICE_ROLE_KEY
INVITATION_TOKEN_HASH_KEY
versioned Invitation Token encryption keys
```

Browser-exposed configuration is separately allow-listed.

Never create a helper that serializes the entire environment into the browser.

Production/non-production secret separation follows `10-security-and-privacy.md`.

---

# 26. Hero Image Development Flow

Hero Image uses the approved private Supabase Storage model.

Implement as a prepare/upload/finalize flow.

Conceptually:

```text
Organizer requests upload authorization
    ↓
server verifies Owner + mutable Event + declared metadata
    ↓
server issues short-lived private upload authorization
    ↓
browser uploads to Event-scoped private object path
    ↓
server finalize action verifies object
    ↓
server records hero_image_storage_path
```

## 26.1 Finalization validation

Before persisting the Hero Image reference, trusted server code verifies:

- object belongs to the expected Event namespace;
- object exists;
- size <= 10 MiB;
- declared type is JPEG/PNG/WebP;
- actual file signature/magic bytes match an allowed raster image type.

Invalid objects are not attached to the Event and should be removed.

SVG is never accepted in V1.

## 26.2 Guest rendering

Guest image access is resolved server-side only after valid Invitation authorization.

Use a short-lived signed/private read URL.

Do not expose a permanent public Storage URL.

---

# 27. Event Deletion Implementation

`deleteEvent` is a dedicated application service.

Flow:

```text
authenticate Organizer
    ↓
load owned Event
    ↓
calculate runtime state
    ↓
Draft or Ended?
    ├── no -> EVENT_NOT_DELETABLE
    └── yes
          ↓
      capture private Hero Image path if present
          ↓
      delete Event in PostgreSQL
          ↓
      FK cascades remove Invitations / RSVP / credentials
          ↓
      attempt private Storage object cleanup
          ↓
      return safe success
```

The database delete is authoritative.

Because Supabase Storage is outside the PostgreSQL transaction:

- a failed Storage cleanup must not recreate deleted database records;
- the unreferenced object remains private;
- log a redacted cleanup failure;
- operations must provide an orphan-cleanup procedure in `14-deployment-and-operations.md`.

No soft-delete model or restore workflow is introduced.

---

# 28. CSV Export Module

Use:

```text
src/modules/exports/
```

Responsibilities:

- query only the authorized Event projection;
- include every Invitation;
- map exact approved column order;
- serialize Attendee Names with `; `;
- apply spreadsheet-formula neutralization;
- perform RFC-4180 escaping;
- build safe filename component;
- return UTF-8 output.

Formula neutralization must occur before CSV escaping.

Do not place CSV formatting logic inside the Route Handler or React code.

---

# 29. Search and Filter State

Invitation search/filter uses URL search parameters so state is:

- shareable within the authenticated Admin context;
- compatible with Server Component data loading;
- refresh-stable without a global state store.

Conceptually:

```text
?search=john&status=attending
```

The exact parameter names may follow this convention.

Server-side parsing validates:

- trimmed search string;
- approved RSVP Status enum.

No additional V1 filter parameters are introduced.

---

# 30. Client State Management

V1 does not require a global client-state library.

Do not add Redux, Zustand, MobX, or an equivalent global store unless a later implementation need is demonstrated and reviewed.

Use:

- Server Component data for persisted server state;
- URL search parameters for Admin search/filter;
- local React state for transient interaction;
- Server Action pending/result state for forms;
- browser Clipboard API only for copy interaction.

Do not duplicate authoritative RSVP/Event state into a long-lived client cache.

A data-fetching cache library such as TanStack Query is not required for V1.

---

# 31. Form Architecture

Prefer native semantic forms integrated with Server Actions.

Use Client Components where necessary for:

- conditional RSVP fields;
- Attendee Name rows;
- immediate field interaction;
- confirmation dialogs;
- OTP code entry.

Rules:

- preserve valid input after expected validation failure;
- map `fieldErrors` to controls;
- do not use placeholder text as labels;
- do not clear user input before successful persistence;
- server remains authoritative.

A general-purpose form library is not required for V1. If added later, it must not duplicate or replace server validation.

---

# 32. UI Component Organization

Use three component scopes.

```text
src/components/
├── ui/
├── guest/
└── admin/
```

## 32.1 `ui/`

Shared accessible primitives:

- Button;
- Input;
- Textarea;
- Select;
- Radio;
- Field;
- Badge;
- Alert;
- Dialog;
- Toast;
- Skeleton;
- EmptyState.

They contain no Event/Invitation business logic.

## 32.2 `guest/`

Guest-specific composition:

- InvitationHero;
- EventSummary;
- RsvpSection;
- SavedRsvpSummary;
- VenueSection;
- GuestUnavailable.

Names are examples; implementation may combine/split components based on reasonable cohesion.

## 32.3 `admin/`

Admin-specific composition:

- AdminShell;
- EventStatusBadge;
- MetricCard;
- InvitationTable;
- InvitationCard;
- EventFormSections;
- RsvpEditor;
- destructive confirmation content.

Do not build a speculative generic component framework beyond approved needs.

---

# 33. Design Tokens and Tailwind

Store canonical CSS design tokens in a dedicated stylesheet such as:

```text
src/styles/tokens.css
```

Global application CSS imports the tokens once.

Tailwind utilities should reference the semantic tokens where practical.

Do not scatter alternative hard-coded brand colors, radii, spacing scales, or typography definitions through feature components.

Guest display typography and Admin/body typography follow `06-design-system-and-ui-foundation.md`.

Use `next/font` for the approved font families rather than runtime third-party font requests.

---

# 34. Motion

Motion/Framer Motion may be imported only by components that actually animate.

Requirements:

- respect `prefers-reduced-motion`;
- no animation is required to understand state;
- no animation blocks RSVP completion;
- avoid making large server-rendered page trees Client Components solely for animation.

---

# 35. Error Architecture

Define one internal application error type/discriminated family that maps to the approved `AppErrorCode`.

Expected domain failures are not exceptional crashes.

Examples:

```text
VALIDATION_ERROR
EVENT_NOT_MUTABLE
EVENT_NOT_DELETABLE
EVENT_NOT_PUBLISHABLE
RSVP_READ_ONLY
MAX_PARTY_SIZE_CONFLICT
INVITATION_UNAVAILABLE
```

Unexpected errors:

1. are captured by the server logger;
2. are redacted;
3. become `INTERNAL_ERROR`;
4. never expose SQL/stack/secret details to the browser.

Guest unavailable behavior remains privacy-safe and does not expose internal reason distinctions.

---

# 36. Logging and Observability Wrapper

Application code logs through one server-only wrapper rather than scattered direct structured logging.

Conceptually:

```text
src/server/observability/logger.ts
```

The wrapper supports:

- correlation/request identifier;
- operation name;
- safe internal IDs;
- safe error code;
- latency/status.

It must redact/exclude values prohibited by `10-security-and-privacy.md`.

Do not intentionally log:

- raw Token;
- personalized Token URL;
- OTP code;
- session token/cookie;
- Guest Message;
- Dietary Requirements;
- Attendee Names;
- Organizer Contact Information;
- cryptographic/service-role secrets.

The external logging/monitoring vendor remains deferred to Deployment/Operations.

---

# 37. Rate-Limit Adapter Boundary

Use a server-only rate-limit abstraction:

```text
src/server/rate-limit/
```

Application services identify the protection category, for example:

```text
guest-invitation-read
guest-rsvp-write
organizer-token-regeneration
organizer-revocation
hero-image-upload
auth-otp
```

The concrete storage/provider and numeric production thresholds are defined in `14-deployment-and-operations.md`.

Do not hard-code final production limits throughout feature modules.

Tests may inject deterministic in-memory/test implementations.

---

# 38. Cache and Revalidation Rules

Private application data is server-rendered without public caching.

## 38.1 Guest Invitation

Use dynamic/private rendering consistent with:

```text
Cache-Control: private, no-store
```

Do not statically pre-render per Token.

## 38.2 Admin

Authenticated Event/Invitation/RSVP pages must not be publicly cached.

## 38.3 Mutation refresh

After successful mutations, refresh/revalidate only the affected first-party views.

Examples:

- RSVP change -> Invitation detail + dashboard/list data;
- Invitation change -> Invitation detail/list;
- Event change -> Event workspace/settings;
- Token regeneration -> Invitation detail;
- Event deletion -> Events index.

Do not introduce cross-user shared caches of private projections.

---

# 39. Accessibility as a Component Contract

Accessibility rules are enforced at primitive/component boundaries.

Examples:

- `Field` requires label association;
- `Dialog` owns focus trap/return;
- icon-only actions require accessible names;
- statuses contain text;
- responsive Invitation representations preserve equivalent information;
- Guest RSVP uses native radio semantics;
- minimum target sizing follows the Design System.

Accessibility is not postponed to a final QA pass.

---

# 40. Testing File Organization

Use the approved Testing Strategy with this repository mapping.

## 40.1 Unit tests

Colocate pure tests next to source when useful:

```text
src/modules/events/domain.test.ts
src/modules/rsvps/domain.test.ts
src/server/security/invitation-token.test.ts
```

## 40.2 Component tests

Colocate or place next to component groups:

```text
src/components/guest/rsvp-section.test.tsx
src/components/admin/rsvp-editor.test.tsx
```

## 40.3 Database / RLS / server integration

Use:

```text
tests/integration/
tests/rls/
tests/security/
```

These may use real local/isolated Supabase.

## 40.4 Browser E2E

Use:

```text
tests/e2e/
├── guest/
├── admin/
└── auth/
```

Playwright configuration lives at the repository root or a conventional test config path.

---

# 41. Test Helpers and Fixtures

Put reusable test builders under:

```text
tests/fixtures/
tests/helpers/
```

Factories should create valid defaults for:

- Organizer;
- Draft/Published/Ended Event;
- Invitation;
- current credential;
- RSVP states.

Test-only helpers may:

- inject fixed Clock;
- provision Auth test users;
- resolve local OTP through test mail/Auth infrastructure;
- seed private Storage fixtures.

They must not become production backdoors.

---

# 42. Quality Scripts

Expose predictable package scripts.

Recommended names:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm test:security
pnpm db:reset
pnpm db:types
```

Exact command internals are finalized during bootstrap.

Codex should prefer these repository scripts rather than invent one-off commands in each implementation task.

---

# 43. Linting and Formatting

Use:

- ESLint for TypeScript/React/Next.js correctness;
- Prettier for deterministic formatting.

Configuration should be repository-owned and run in CI.

Do not debate formatting during feature implementation.

Generated files may be excluded from style rules where appropriate.

---

# 44. Import Rules

Use the TypeScript path alias:

```text
@/*
```

for imports rooted at `src/`.

Prefer:

```ts
import { ... } from "@/modules/events/...";
```

over long relative traversals.

Avoid generic barrel files that accidentally make server-only modules importable by Client Components.

A feature may expose a small deliberate public module surface, but privileged infrastructure should be imported explicitly.

---

# 45. Dependency Rules

Before adding or upgrading a production dependency, verify:

1. it solves an approved V1 need;
2. the platform/framework does not already solve the problem adequately;
3. its **current latest stable release** has been checked from authoritative sources at implementation time;
4. the selected release is mutually compatible with the current stable runtime/framework/toolchain;
5. it is production-supported and maintained;
6. it is compatible with server/client boundaries;
7. it does not require exposing secrets;
8. it does not materially increase V1 complexity without benefit.

Do not select dependency versions from model-training memory.

Do not use alpha/beta/RC/canary/nightly/experimental/prerelease releases unless explicitly approved by a later source-of-truth change.

If the newest stable release is incompatible, use the newest stable compatible release and document why.

For major upgrades, read the official migration/upgrade guide and run the required test gates before merging.

Avoid dependencies for:

- trivial utilities;
- speculative future features;
- global state that V1 does not need;
- a separate API client for the same first-party Next.js app;
- custom cryptography.

Repository configuration and `pnpm-lock.yaml` are the executable record of selected implementation-time versions.

Dependency changes that materially alter architecture should be recorded in an ADR.

---

# 46. Code Review Rules

Every implementation change should be reviewable against approved specifications.

Review should ask:

- Which requirement/flow is being implemented?
- Which server contract applies?
- Where is authorization enforced?
- Where is validation enforced?
- Does this touch a security-sensitive field?
- Does it affect Event/Invitation/RSVP lifecycle?
- Which tests prove the behavior?
- Is any new behavior being invented?

If code requires behavior absent from specifications, stop and update the specification before merging implementation.

---

# 47. Codex Implementation Workflow

For each coherent vertical slice, Codex should follow this order:

```text
1. Read relevant approved specs / ADRs.
2. Identify exact acceptance criteria.
3. Identify affected domain module(s).
4. Add/adjust migration first when persistence changes.
5. Regenerate database types when schema changes.
6. Implement pure domain validation/calculation.
7. Implement persistence/transaction operation.
8. Implement application service and authorization.
9. Implement thin Server Action / Route Handler.
10. Implement UI.
11. Add unit/integration/RLS/E2E tests required by 11-testing-strategy.md.
12. Run repository quality scripts.
13. Review for security/logging/client-boundary violations.
14. Update documentation only when an approved requirement actually changes.
```

Do not begin from visual page code and then infer business rules backward from it.

---

# 48. Vertical Slice Boundaries

Prefer complete behavior slices rather than building every database feature before any usable workflow.

Examples of coherent slices for the later roadmap:

```text
Organizer Auth
Event Draft + Settings
Event Publication
Invitation Creation + Token
Guest Invitation Read
Guest RSVP
Admin Invitation Management
Token Regeneration / Revocation
Dashboard / Search
CSV Export
Hero Image
Event Deletion
Security / hardening / operations
```

The exact implementation order belongs to `13-development-roadmap.md`.

---

# 49. Generated and Hand-Written Code Boundary

Generated code:

- Supabase database TypeScript types;
- framework/package lock metadata as appropriate.

Generated files should be clearly marked and not manually edited.

Hand-written application code owns:

- domain types;
- schemas;
- services;
- UI;
- security wrappers;
- test factories;
- mappings.

Do not generate duplicate domain models from multiple schemas unless a concrete need exists.

---

# 50. No Direct Production Data Manipulation

Normal V1 operations must flow through approved application/admin functionality.

Development scripts must not become an undocumented substitute for product behavior.

Operational scripts used for:

- Organizer provisioning;
- privacy/erasure;
- HMAC key rotation;
- orphaned private Hero Image cleanup

must be:

- server/operations-only;
- access-controlled;
- documented in `14-deployment-and-operations.md`;
- excluded from client bundles;
- safe against accidental production execution where practical.

---

# 51. Development Decisions Proposed by This Document

These are implementation-architecture choices, not new business rules.

### DEV-D01 — Single Next.js application repository

No monorepo/microservices for V1.

### DEV-D02 — pnpm package manager

Commit one pnpm lockfile and use repository scripts consistently.

### DEV-D03 — Feature-oriented application modules

Use `src/modules/*` for Event, Invitation, RSVP, Guest Access, Auth, Dashboard, and Export application/domain code.

### DEV-D04 — Explicit privileged server infrastructure

Use `src/server/*` for database, Supabase, security, Storage, rate-limit, and observability adapters.

### DEV-D05 — Server Components by default

Use Client Components only at browser-interaction boundaries.

### DEV-D06 — No global client-state library in V1

Persisted state remains server-owned; URL/local state handles V1 interaction needs.

### DEV-D07 — Zod structural schemas + domain validation

Do not collapse stateful business validation into client schemas.

### DEV-D08 — PostgreSQL transaction/RPC boundary for cross-row invariants

Do not simulate transactions with independent Supabase calls.

### DEV-D09 — Dedicated test clock

Time-dependent domain behavior is injectable/deterministic.

### DEV-D10 — ESLint + Prettier

Repository-owned automated lint/format configuration.

---

# 52. ADR Guidance

An ADR should be created before changing an architectural choice that is expensive or security-sensitive, including:

- replacing Supabase Auth/PostgreSQL/Storage;
- replacing the Next.js App Router architecture;
- changing Invitation Token storage/cryptography model;
- introducing public object storage for private Event media;
- introducing a public API consumed outside the first-party application;
- introducing multiple deployable services/monorepo architecture;
- changing transaction strategy for cross-row invariants;
- introducing additional Event ownership/tenant models.

An ADR is not required for ordinary component refactors or low-cost implementation-library substitutions that preserve the architecture.

---

# 53. Traceability

| Development rule | Source |
|---|---|
| Next.js App Router / Server Components | `04-technical-architecture.md` |
| Supabase Auth/PostgreSQL/Storage | `04-technical-architecture.md` |
| Passwordless provisioned Organizer OTP | D-28, FR-SEC-004 |
| One Owner / ownership checks | D-17, FR-SEC-003 |
| Server Actions for form mutations | `09-api-and-server-contracts.md` |
| CSV Route Handler | `09-api-and-server-contracts.md` |
| Event deletion | D-27, FR-EVT-007, `09-api-and-server-contracts.md` |
| Ended ordinary read-only behavior | D-26 |
| Token HMAC/encryption | `10-security-and-privacy.md` |
| Private Hero Image | `10-security-and-privacy.md` |
| CSV formula neutralization | SEC-D08 |
| No sensitive logging | SEC-D09 |
| RLS / real DB testing | `11-testing-strategy.md` |
| Deterministic clock | `11-testing-strategy.md` |
| UI tokens/accessibility | `06-design-system-and-ui-foundation.md` |
| Guest UI behavior | `07-guest-experience-spec.md` |
| Admin UI behavior | `08-admin-dashboard-spec.md` |
| Dependency freshness / stable-version rule | `AGENTS.md`, this document Section 4/45, `14-deployment-and-operations.md` |

---

# 54. Explicitly Deferred Development Details

This document intentionally leaves these to implementation bootstrap or later operations where they do not alter architecture:

- exact numeric Node version;
- exact numeric pnpm version;
- exact dependency versions;
- exact current Next.js/Supabase SSR adapter filename;
- exact CI provider/job topology;
- exact production rate-limit provider/thresholds;
- exact monitoring/error-reporting vendor;
- exact Vercel plan/runtime sizing;
- exact backup implementation;
- exact production domain name;
- exact OTP email template content;
- exact operational Organizer-provisioning command/tool;
- exact operational privacy-erasure command/tool.

These deferrals must not be used to invent product behavior.

---

# 55. Review Checklist

Before marking this document Approved, confirm:

- dependency bootstrap uses current authoritative version checks and latest stable compatible releases;
- no prerelease dependency channel is used without explicit approval;
- single-repository architecture is acceptable;
- pnpm is acceptable;
- required V1 route paths are acceptable;
- `src/modules` / `src/server` boundaries are clear;
- Server Components remain the default;
- no global client-state library is required;
- Server Actions remain thin adapters;
- database transaction boundaries preserve approved invariants;
- Supabase service-role access is narrowly isolated;
- OTP uses provisioned users without public sign-up;
- deterministic Event-time handling is centralized;
- Token cryptography remains server-only;
- private Hero Image finalize validation is acceptable;
- Event deletion database/storage boundary matches approved API behavior;
- CSV formula neutralization remains in the export module;
- environment access is centralized/validated;
- logging remains redacted;
- test organization matches `11-testing-strategy.md`;
- Codex workflow prevents implementation from inventing requirements;
- no new product/business rule was introduced.

---

# 56. Next Document

After this Development Architecture is reviewed and approved, create:

**`13-development-roadmap.md`**

The Development Roadmap should sequence implementation into dependency-aware vertical slices, define milestones and completion criteria, identify which specifications/tests govern each slice, and provide a practical Codex execution order without changing approved product behavior.
