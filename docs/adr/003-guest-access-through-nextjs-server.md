# ADR 003 — Guest Access Through the Next.js Server

> **Status:** Approved  
> **Project:** Digital Invitation & RSVP Platform  
> **Decision scope:** V1 architecture  
> **Relationship to source of truth:** This ADR records an architectural decision already established by approved project specifications. It does not introduce or override product/business behavior.

---

## Context

Guests do not create accounts. A personalized Invitation Token is a bearer credential that authorizes access to one Invitation subject to Event state, revocation, expiration, and RSVP Deadline rules.

Direct anonymous browser queries to application tables would broaden the exposed data surface and make it harder to guarantee that Token resolution, state checks, and privacy-safe unavailable behavior are applied consistently.

---

## Decision

Broker Guest Invitation reads and RSVP writes through **trusted Next.js server-side application services**.

The browser supplies the raw Invitation Token only to the personalized Guest route/mutation boundary.

The server:

1. validates Token shape;
2. computes the keyed lookup value;
3. resolves the current credential;
4. loads the associated Invitation/Event/current RSVP;
5. evaluates publication, expiration, revocation, and deadline rules;
6. returns only the Guest-safe projection.

Do not grant broad anonymous table access for Guest Invitation data.

---

## Alternatives Considered

### Direct anonymous Supabase table access with RLS

Rejected for V1 because it would require exposing more database shape/policy behavior to unauthenticated clients and complicate bearer-token authorization.

### Guest accounts

Rejected because Guest account creation is explicitly outside the V1 experience.

### Public Event pages

Rejected because personalized Invitations are private-by-link and public discovery is out of scope.

---

## Consequences

Benefits:

- one auditable Guest authorization boundary;
- privacy-safe unavailable responses;
- server-only Token lookup/cryptography;
- easier business-rule revalidation on writes;
- no browser authority based on Invitation UUIDs.

Costs:

- Next.js server is on the critical Guest access path;
- server services must remain performant and available;
- privileged Guest persistence paths require explicit validation.

---

## Implementation Constraints

- Guest browser must not use Invitation UUID as authority.
- Raw Token must not be logged.
- Personalized responses use private/no-store behavior.
- Invalid, obsolete, Draft, revoked, and Ended access do not expose private Event/Invitee data.
- Guest writes re-evaluate current deadline, Event state, revocation, Token, and Maximum Party Size.

---

## Source Alignment

Primary alignment:

- `04-technical-architecture.md`: TA-03 Guest access through Next.js server.
- `07-guest-experience-spec.md`: unavailable/read-only Guest states.
- `09-api-and-server-contracts.md`: Guest read/write contracts.
- `10-security-and-privacy.md`: Token threat model and anti-enumeration requirements.

---

## Change Rule

Changing this decision requires review against the current specification precedence. If the change affects product behavior, security boundaries, persistence contracts, or another costly-to-reverse architectural choice, update the owning specification(s) before approving a replacement/superseding ADR.
