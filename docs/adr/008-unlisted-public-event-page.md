# ADR 008 — Unlisted Public Event Page and Separate Public Cover

> **Status:** Approved
>
> **Decision scope:** D-29/D-30 pre-launch product extension
>
> **Supersedes:** ADR 003's rejection of public Event pages and ADR 006's
> assumption that every Event image is private Invitation content. Their
> personalized Invitation and private Hero Image boundaries remain in force.

## Context

D-29 approves an unlisted public Event announcement that anyone with its URL
can read. Venue Name and Venue Address may be public, while map URL, arrival
notes, personalized Invitations, RSVP data, and the existing Hero Image remain
private. Publication of an Event alone does not authorize public disclosure,
so existing Events must stay private until an Owner opts in.

## Decision

- Keep the public Event route separate from `/i/[token]`. Its stable random
  public identifier is not an Invitation Token and grants no RSVP authority.
- Serve only an explicitly listed public Event projection through a trusted
  Next.js server-only read service. Do not grant anonymous table access to
  `events`, `invitations`, or `rsvps`.
- Include Venue Name and Venue Address in that projection, but never map URL
  or arrival notes.
- Require an active Published Event and an explicit Owner-controlled public
  enable flag on each public read, including image reads. Return a generic
  unavailable response for all other states. Never cache public content beyond
  the point at which disabling or expiration could take effect.
- Keep personalized Guest pages private/no-store/noindex and preserve all
  Token, deadline, revocation, expiration, and RSVP validations.
- Store the optional public cover as a separate Event-owned object in the
  existing private raster-image bucket. Its public delivery route checks
  current page visibility before streaming bytes. The existing private Hero
  Image path is never used for public delivery.
- Owner preview and management remain authenticated and ownership-checked.
  Cover upload/finalization validates type, size, file signature, and Event
  mutability server-side. Database deletion is authoritative; both image
  objects receive cleanup attempts, and failed cleanup leaves private orphans
  for the existing operational scanner.
- Use only D-29/D-30 approved fields in HTML and page/social metadata. The
  public page is unlisted/noindex; robots directives are not access control.

## Consequences

The application gains a public read surface without expanding anonymous
database grants or weakening bearer-token access. The Owner must understand
that anyone receiving the public URL may copy the approved public content.
Dynamic reads and no-store image delivery favor immediate disable/expiration
over CDN caching. Public-cover storage and orphan cleanup need separate tests.

## Acceptance

Tests must show that disabled, Draft, Ended, and deleted Events reveal no
public data; disabling the page also stops its cover image; public responses
contain Venue Name and Venue Address but no map URL, arrival notes, Invitation,
RSVP, contact, private Hero, or private message data; and a public identifier
never authorizes RSVP. Existing private Guest
access tests remain mandatory.
