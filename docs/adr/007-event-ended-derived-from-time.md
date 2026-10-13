# ADR 007 — Event Ended State Is Derived from Time

> **Status:** Approved  
> **Project:** Digital Invitation & RSVP Platform  
> **Decision scope:** V1 architecture  
> **Relationship to source of truth:** This ADR records an architectural decision already established by approved project specifications. It does not introduce or override product/business behavior.

---

## Context

The approved Event lifecycle is Draft -> Published -> Ended. Ended is determined by Event expiration rather than by an Organizer action.

A persisted Ended transition would require scheduled jobs, retry semantics, and synchronization between stored state and Event-local time even though the business rule is fundamentally temporal.

---

## Decision

Persist only the publication state needed for Organizer-controlled lifecycle:

```text
draft
published
```

Derive **Ended** at runtime from the Event's approved expiration rule and current time.

Expiration:

- when End Time exists, use the Event-local End Time on the Event Date;
- otherwise expire after the Event calendar date ends in the Event Timezone.

Server reads and mutations compute runtime state using the authoritative Event Timezone and server clock.

No cron/scheduled state-change job is required for correctness.

---

## Alternatives Considered

### Persist `ended` and update it with a scheduled job

Rejected because time itself defines the state; scheduled transitions introduce eventual-consistency/failure concerns.

### Organizer manually ends Event

Rejected because D-18 defines Ended as lifecycle behavior derived from expiration, not a manual action.

### Browser-local Ended calculation

Rejected because browser clocks/timezones are not authoritative for access/mutation rules.

---

## Consequences

Benefits:

- no scheduled job needed for correctness;
- lifecycle transitions are deterministic;
- Guest access and D-26 mutability use one calculation;
- easier testing through the approved injectable Clock.

Costs:

- every relevant server operation must calculate runtime state;
- timezone handling must be centralized and correct;
- queries that need runtime state may require application-side projection/calculation rather than a simple persisted enum.

---

## Implementation Constraints

- Event Timezone is authoritative.
- Domain/server code uses a centralized clock/time helper.
- Guest access is unavailable at/after Event expiration.
- D-26 ordinary Organizer mutations are rejected after expiration.
- D-27 permanent deletion remains allowed for Ended Events through a separate deletability rule.
- Tests cover before/at/after expiration deterministically.

---

## Source Alignment

Primary alignment:

- D-09, D-18, D-26, D-27.
- `04-technical-architecture.md`: TA-08.
- `05-data-model.md`: persisted publication state / derived Ended.
- `09-api-and-server-contracts.md`: runtime-state helpers and mutation guards.
- `11-testing-strategy.md`: deterministic time tests.

---

## Change Rule

Changing this decision requires review against the current specification precedence. If the change affects product behavior, security boundaries, persistence contracts, or another costly-to-reverse architectural choice, update the owning specification(s) before approving a replacement/superseding ADR.
