# ADR 004 — Invitation Token Storage: HMAC Lookup + Recoverable Encryption

> **Status:** Approved  
> **Project:** Digital Invitation & RSVP Platform  
> **Decision scope:** V1 architecture  
> **Relationship to source of truth:** This ADR records an architectural decision already established by approved project specifications. It does not introduce or override product/business behavior.

---

## Context

The Invitation Token is a bearer credential. It must be unguessable and must not be stored as a plaintext-only database credential.

At the same time, the Organizer experience requires the application to re-display/copy the current personalized Invitation URL. A one-way hash alone would prevent reconstruction of the current raw Token after creation.

---

## Decision

Generate each Invitation Token from at least **256 bits of CSPRNG entropy**.

Persist two protected representations of the current raw Token:

1. `token_lookup_hash` = **HMAC-SHA-256(server lookup key, raw Token)** for deterministic indexed lookup;
2. an authenticated encrypted recoverable Token value using **AES-256-GCM**, with key version metadata.

Use separate server-only secrets for HMAC lookup and encryption.

Token regeneration atomically replaces the current credential and immediately invalidates the old Token.

---

## Alternatives Considered

### Plaintext Token in database

Rejected because database read exposure would directly reveal active bearer credentials.

### Ordinary unsalted hash

Rejected because a keyed lookup is preferred for a credential that must be deterministically resolved and protected against offline guessing.

### One-way hash only

Rejected because the approved Admin UX requires reconstructing/copying the current personalized URL.

### Store every historical Token

Rejected because V1 needs only the current credential and old regenerated Tokens must stop resolving.

---

## Consequences

Benefits:

- raw Token is not persisted plaintext-only;
- deterministic indexed lookup remains possible;
- current URL can be reconstructed for authorized Organizer copying;
- encryption keys can be versioned/rotated;
- regeneration preserves Invitation/RSVP identity.

Costs:

- two cryptographic secrets must be managed;
- encryption/HMAC rotation requires operational runbooks;
- service-role/server-only credential handling becomes security-critical.

---

## Implementation Constraints

- CSPRNG token entropy >= 256 bits.
- Use platform/library cryptography; no custom primitives.
- HMAC and encryption secrets are separate.
- Raw Token and personalized URL are excluded from logs/analytics/CSV.
- Encryption uses versioned keys.
- HMAC rotation follows the controlled maintenance process unless the data model is later changed through specification/ADR.
- Credential replacement is atomic.

---

## Source Alignment

Primary alignment:

- `04-technical-architecture.md`: TA-05.
- `05-data-model.md`: `invitation_access_credentials`.
- `10-security-and-privacy.md`: SEC-D01 through SEC-D04 and rotation requirements.
- `14-deployment-and-operations.md`: key-rotation runbooks.

---

## Change Rule

Changing this decision requires review against the current specification precedence. If the change affects product behavior, security boundaries, persistence contracts, or another costly-to-reverse architectural choice, update the owning specification(s) before approving a replacement/superseding ADR.
