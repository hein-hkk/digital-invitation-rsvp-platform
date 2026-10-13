# ADR 002 — Supabase Auth, PostgreSQL, and Private Storage

> **Status:** Approved  
> **Project:** Digital Invitation & RSVP Platform  
> **Decision scope:** V1 architecture  
> **Relationship to source of truth:** This ADR records an architectural decision already established by approved project specifications. It does not introduce or override product/business behavior.

---

## Context

The approved product needs Organizer authentication, relational Event/Invitation/RSVP persistence, Row Level Security, and one optional private Hero Image per Event. The project is intentionally a focused V1 and should not introduce separate infrastructure products without a concrete need.

---

## Decision

Use **Supabase** as the managed backend platform for:

- Supabase Auth for provisioned Organizer identities and passwordless email OTP;
- PostgreSQL for Event, Invitation, access-credential, and RSVP data;
- Row Level Security as defense in depth for Organizer-owned data;
- private Supabase Storage for Hero Images.

Use Next.js server-side capabilities as the application/business boundary in front of these services.

---

## Alternatives Considered

### Separate Auth provider + standalone PostgreSQL + object-storage vendor

Rejected for V1 because it increases operational and integration complexity without an approved requirement.

### Firebase document database

Rejected because the approved data model and transactional invariants are relational and PostgreSQL-oriented.

### Public object storage for Hero Images

Rejected because Event media is private-by-invitation and must not become permanently public.

---

## Consequences

Benefits:

- one managed platform for Auth, relational DB, RLS, and Storage;
- straightforward ownership policies;
- relational constraints/transactions support V1 invariants;
- reduced V1 operational surface.

Costs:

- project relies on Supabase operational availability;
- privileged service-role access must be tightly isolated;
- migrations and RLS policies require disciplined version control.

---

## Implementation Constraints

- Production/non-production Supabase projects are separate.
- Schema/RLS/functions are versioned through repository migrations.
- Service-role key is server-only.
- Public/anonymous clients do not receive broad private-table access.
- Hero Image bucket remains private.
- D-28 Organizer accounts are provisioned administratively; public self-sign-up is disabled.

---

## Source Alignment

Primary alignment:

- `04-technical-architecture.md`: Supabase responsibilities and TA-04/TA-06 boundaries.
- `05-data-model.md`: PostgreSQL entities, constraints, RLS ownership.
- `10-security-and-privacy.md`: service-role isolation and private Storage.
- `14-deployment-and-operations.md`: environment/project separation.

---

## Change Rule

Changing this decision requires review against the current specification precedence. If the change affects product behavior, security boundaries, persistence contracts, or another costly-to-reverse architectural choice, update the owning specification(s) before approving a replacement/superseding ADR.
