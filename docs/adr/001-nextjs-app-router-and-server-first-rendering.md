# ADR 001 — Next.js App Router and Server-First Rendering

> **Status:** Approved  
> **Project:** Digital Invitation & RSVP Platform  
> **Decision scope:** V1 architecture  
> **Relationship to source of truth:** This ADR records an architectural decision already established by approved project specifications. It does not introduce or override product/business behavior.

---

## Context

The approved stack uses Next.js with TypeScript and Tailwind CSS. Personalized Guest pages and authenticated Admin pages handle private Event, Invitation, and RSVP data, so the application needs clear server/client boundaries and must avoid making browser state authoritative.

The Technical and Development Architecture already establish Next.js App Router, Server Components by default, Server Actions for first-party mutations, and Client Components only at browser-interaction boundaries.

---

## Decision

Use a single **Next.js App Router** application.

Use **Server Components by default** for private reads and page composition.

Use **Client Components only where browser interaction is required**, including RSVP form interaction, dynamic Attendee Name inputs, copy-to-clipboard, confirmation dialogs, OTP entry, and approved motion.

Use **Server Actions** as the preferred first-party form mutation adapter. Use Route Handlers where an HTTP response is the natural boundary, such as CSV download.

---

## Alternatives Considered

### Pages Router

Rejected for V1 because the approved architecture is already App Router/server-first and changing would add no product value.

### Client-rendered SPA architecture

Rejected because it would expand browser-side data/state responsibility and weaken the intended server-first privacy/authorization boundary.

### Separate frontend and backend services

Rejected as unnecessary V1 complexity for a first-party application.

---

## Consequences

Benefits:

- private data reads remain naturally server-side;
- smaller client-side state surface;
- direct alignment with Server Actions and server authorization;
- easier no-store/private Guest rendering;
- fewer duplicated API abstractions.

Costs:

- careful Server/Client Component boundaries are required;
- browser-only interactions need explicit Client Components;
- developers must avoid importing privileged modules across client boundaries.

---

## Implementation Constraints

- Business/domain modules must not depend on React or Next.js request objects.
- `"use client"` should remain as low in the tree as practical.
- Client validation is UX only; server validation remains authoritative.
- Personalized Guest pages are dynamic/private and not statically generated per Token.
- No parallel public REST API is introduced for ordinary first-party forms.

---

## Source Alignment

Primary alignment:

- `04-technical-architecture.md`: TA-01, TA-02, server-first rendering.
- `09-api-and-server-contracts.md`: Server Actions and Route Handler boundaries.
- `12-development-architecture.md`: Server Component/Client Component and route-layer rules.

---

## Change Rule

Changing this decision requires review against the current specification precedence. If the change affects product behavior, security boundaries, persistence contracts, or another costly-to-reverse architectural choice, update the owning specification(s) before approving a replacement/superseding ADR.
