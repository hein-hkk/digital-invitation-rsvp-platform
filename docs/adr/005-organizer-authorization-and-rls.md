# ADR 005 — Organizer Authorization with Application Checks and RLS

> **Status:** Approved  
> **Project:** Digital Invitation & RSVP Platform  
> **Decision scope:** V1 architecture  
> **Relationship to source of truth:** This ADR records an architectural decision already established by approved project specifications. It does not introduce or override product/business behavior.

---

## Context

Each Event has exactly one Owner in V1. Organizer routes and operations must prevent horizontal privilege escalation even if a user changes Event or Invitation identifiers in a request.

Relying only on UI filtering is insufficient. Relying only on one application-layer check also leaves fewer defense-in-depth controls for authenticated database access.

---

## Decision

Use **defense-in-depth Organizer authorization**:

1. resolve the authenticated Supabase Organizer session server-side;
2. verify Event ownership in the application/domain service for every Event-scoped read/write;
3. enable PostgreSQL **Row Level Security** policies that enforce the same ownership relationship for authenticated Organizer data access;
4. for ordinary Event-scoped mutations, also evaluate D-26 Event mutability;
5. use a separate D-27 deletability guard for permanent Draft/Ended Event deletion.

Internal UUID possession is never treated as authorization.

---

## Alternatives Considered

### UI-only authorization

Rejected as insecure.

### Application authorization without RLS

Rejected because RLS provides an approved second boundary against mistakes in authenticated queries.

### RLS-only authorization

Rejected because business/domain services still need explicit ownership checks, clear errors, and state guards.

### Multi-role team authorization

Rejected because D-17 defines one Owner and no collaborators in V1.

---

## Consequences

Benefits:

- protects against identifier tampering;
- multiple enforcement layers;
- authorization is explicit in server contracts/tests;
- future accidental query broadening is less likely to expose cross-Owner data.

Costs:

- policies and server checks must remain aligned;
- RLS tests are mandatory;
- service-role operations must re-create authorization explicitly because they bypass RLS.

---

## Implementation Constraints

- Every Event-scoped Organizer operation resolves the current session server-side.
- Child Invitation/RSVP access is derived through the owned Event.
- Service-role usage is narrow and server-only.
- Ended ordinary mutations are rejected; Draft/Ended deletion uses its own approved guard.
- At least two Organizer identities are used in RLS/integration isolation tests.

---

## Source Alignment

Primary alignment:

- D-17, D-26, D-27.
- `04-technical-architecture.md`: TA-04.
- `05-data-model.md`: ownership/RLS model.
- `09-api-and-server-contracts.md`: Organizer preconditions/authorization matrix.
- `10-security-and-privacy.md`: authorization defense in depth.

---

## Change Rule

Changing this decision requires review against the current specification precedence. If the change affects product behavior, security boundaries, persistence contracts, or another costly-to-reverse architectural choice, update the owning specification(s) before approving a replacement/superseding ADR.
