# ADR 006 — Private Hero Image Storage

> **Status:** Approved  
> **Project:** Digital Invitation & RSVP Platform  
> **Decision scope:** V1 architecture  
> **Relationship to source of truth:** This ADR records an architectural decision already established by approved project specifications. It does not introduce or override product/business behavior.

---

## Context

Hero Image is optional Event presentation media. It can contain personally meaningful wedding imagery and is part of a private Invitation experience rather than a public media site.

The approved Guest model requires Event content to be available only through an authorized current Invitation before expiration.

---

## Decision

Store Hero Images in a **private Supabase Storage bucket**.

Only the authenticated Event Owner may upload/replace/remove the Hero Image for a mutable Event.

Use an Event-scoped private object path and a prepare/upload/finalize flow.

Before recording the image reference, trusted server code verifies the approved raster type and size constraints.

Authorized Guest rendering receives a **short-lived signed/private read URL** only after Guest Invitation access has been validated.

---

## Alternatives Considered

### Public Storage bucket

Rejected because possession of a media URL would bypass Invitation access/expiration rules.

### Store binary image directly in PostgreSQL

Rejected because object storage is better suited to media and the approved architecture already uses Supabase Storage.

### Third-party image CDN as canonical private store

Rejected for V1 because it adds another security/operations vendor without an approved requirement.

---

## Consequences

Benefits:

- Event media follows the same privacy posture as Invitation data;
- no permanent public media URL;
- Supabase Storage integrates with the approved backend platform;
- signed access can be short-lived.

Costs:

- upload/finalization is a multi-step flow;
- deletion may leave a private orphan if DB deletion succeeds and Storage cleanup fails;
- operational orphan cleanup is required.

---

## Implementation Constraints

- Allowed V1 source formats: JPEG, PNG, WebP.
- SVG is rejected.
- Source file maximum is 10 MiB.
- Validate declared MIME plus file signature/magic bytes.
- Bucket remains private.
- Event deletion does not roll back if Storage cleanup fails; orphan remains private and is removed by the approved operational cleanup process.

---

## Source Alignment

Primary alignment:

- D-14, D-15.
- `04-technical-architecture.md`: TA-06.
- `07-guest-experience-spec.md`: optional Hero behavior.
- `10-security-and-privacy.md`: Hero Image upload/storage security.
- `12-development-architecture.md`: prepare/upload/finalize flow.
- `14-deployment-and-operations.md`: orphan cleanup.

---

## Change Rule

Changing this decision requires review against the current specification precedence. If the change affects product behavior, security boundaries, persistence contracts, or another costly-to-reverse architectural choice, update the owning specification(s) before approving a replacement/superseding ADR.
