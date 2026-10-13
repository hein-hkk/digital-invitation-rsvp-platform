# 06 — Design System and UI Foundation

> **Project:** Digital Invitation & RSVP Platform  
> **Document status:** Approved  
> **Project phase:** Planning / Specification  
> **Initial vertical:** Wedding RSVP Website  
> **Source-of-truth relationship:** This document defines the V1 visual and interaction foundation for the approved Product Concept, Product Decisions D-01 through D-28, `02-prd.md`, `03-user-flows.md`, `04-technical-architecture.md`, and `05-data-model.md`. It must not change approved business behavior.

---

## 1. Purpose

This document defines the shared V1 UI foundation used by both the public **Guest Invitation** experience and the authenticated **Organizer/Admin** experience.

It establishes:

- responsive strategy;
- layout foundations;
- typography;
- color and semantic tokens;
- spacing and sizing;
- radii, borders, and shadows;
- shared component foundations;
- forms and validation presentation;
- loading, empty, success, warning, and error states;
- accessibility and focus treatment;
- motion and reduced-motion behavior;
- image treatment;
- content hierarchy;
- implementation guidance for Tailwind CSS.

Detailed Guest page hierarchy belongs to `07-guest-experience-spec.md`.

Detailed Organizer dashboard information architecture belongs to `08-admin-dashboard-spec.md`.

---

## 2. Design Principles

### DS-P01 — Guest experience is mobile-first

The public Invitation is designed first for phone-sized screens because Invitees are expected to open personalized links from messaging applications.

Desktop enhancement must not make mobile behavior secondary.

### DS-P02 — Wedding presentation is elegant but restrained

V1 provides one curated wedding experience.

The design should feel:

- warm;
- refined;
- calm;
- personal;
- readable;
- contemporary rather than ornamental for its own sake.

The UI must not become a theme-builder or design-editor product.

### DS-P03 — Admin experience favors clarity over decoration

The Organizer interface should prioritize:

- status recognition;
- attendance totals;
- fast Invitation lookup;
- safe operational actions;
- clear form validation.

The Admin and Guest surfaces may differ in presentation while sharing core accessibility and component foundations.

### DS-P04 — Content remains usable without optional media

The Guest Invitation must remain complete and visually coherent when no Hero Image is configured.

### DS-P05 — Motion is supportive, never required

Animation may add polish but must never:

- hide critical information;
- delay form completion;
- become necessary to understand state;
- override reduced-motion preferences.

### DS-P06 — Accessible by default

UI foundations target **WCAG 2.2 AA** for normal product interaction.

Later page specifications may add stronger constraints but must not weaken this baseline.

---

## 3. Visual Direction

### 3.1 Curated V1 theme

The single V1 wedding theme uses a soft editorial aesthetic:

- warm ivory page background;
- white or near-white content surfaces;
- dark warm-neutral text;
- muted rose/wine accent;
- restrained borders;
- generous whitespace;
- serif display typography for Guest wedding headings;
- sans-serif typography for body copy, forms, controls, and all Admin UI.

This is a **product design decision**, not an Organizer-configurable setting.

### 3.2 Guest versus Admin tone

**Guest surfaces** may use larger display typography, generous vertical rhythm, centered composition where appropriate, subtle separators, and restrained entrance motion.

**Admin surfaces** use denser information hierarchy, left-aligned operational content, compact tables/cards/forms, minimal decorative styling, and stronger status differentiation.

Both surfaces share the same semantic color, focus, form, and accessibility rules.

---

## 4. Design Tokens

All design values should be represented through CSS custom properties and mapped into Tailwind utilities.

Recommended token prefixes:

```text
--color-*
--space-*
--radius-*
--shadow-*
--duration-*
--ease-*
```

Do not scatter raw visual values throughout components when a semantic token exists.

### 4.1 Color palette

| Token | Value | Primary use |
|---|---|---|
| `--color-page` | `#FFFDF9` | Guest page background |
| `--color-surface` | `#FFFFFF` | Cards, forms, Admin surfaces |
| `--color-surface-subtle` | `#F8F4EF` | Secondary surfaces |
| `--color-text` | `#211C18` | Primary text |
| `--color-text-muted` | `#665E57` | Secondary text |
| `--color-border` | `#E5DDD5` | Default borders/dividers |
| `--color-border-strong` | `#CFC3B8` | Stronger neutral border |
| `--color-accent` | `#7A4452` | Primary Guest/Admin accent |
| `--color-accent-hover` | `#663744` | Accent hover/pressed |
| `--color-accent-soft` | `#F4E9EC` | Soft accent background |
| `--color-focus` | `#2457C5` | Focus ring |
| `--color-success` | `#176B4B` | Success status |
| `--color-success-soft` | `#E7F4EE` | Success background |
| `--color-warning` | `#8A5A00` | Warning status |
| `--color-warning-soft` | `#FFF3D6` | Warning background |
| `--color-danger` | `#B42318` | Errors/destructive actions |
| `--color-danger-hover` | `#8F1D14` | Destructive hover |
| `--color-danger-soft` | `#FDECEA` | Error background |
| `--color-info` | `#285A8E` | Informational state |
| `--color-info-soft` | `#EAF2FA` | Informational background |
| `--color-overlay` | `rgba(33, 28, 24, 0.52)` | Modal/dialog backdrop |

These colors form the fixed V1 system. Organizers do not edit them.

Usage rules:

- Body text uses `--color-text`.
- Secondary text uses `--color-text-muted`.
- Accent color is not used for long body copy.
- Danger color is reserved for error/destructive meaning.
- Status meaning must not rely on color alone.
- Focus uses a dedicated visible focus color rather than the decorative accent.

### 4.2 Typography

Recommended V1 pair:

```text
Display / wedding headings:
"Playfair Display", Georgia, serif

UI / body / Admin:
"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Use `next/font` so fonts are self-hosted by the built application rather than fetched by the browser at runtime.

| Role | Mobile | Desktop | Weight | Line height |
|---|---:|---:|---:|---:|
| `display-xl` | 44px | 64px | 500 | 1.05 |
| `display-lg` | 36px | 52px | 500 | 1.10 |
| `heading-1` | 30px | 40px | 600 | 1.15 |
| `heading-2` | 24px | 30px | 600 | 1.20 |
| `heading-3` | 20px | 24px | 600 | 1.25 |
| `body-lg` | 18px | 18px | 400 | 1.60 |
| `body` | 16px | 16px | 400 | 1.55 |
| `body-sm` | 14px | 14px | 400 | 1.50 |
| `label` | 14px | 14px | 600 | 1.35 |
| `caption` | 12px | 12px | 500 | 1.40 |

Rules:

- Default Guest RSVP body text must not be smaller than `16px`.
- Admin metadata may use `14px`.
- `12px` is reserved for non-critical captions/metadata.
- Long-form Event details use `body` or `body-lg`.
- Guest display serif is not used for form controls or data-heavy Admin tables.
- Heading levels follow semantic HTML structure rather than visual size alone.

---

## 5. Spacing System

Use a 4px base grid.

| Token | Value |
|---|---:|
| `space-0` | 0 |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |
| `space-20` | 80px |
| `space-24` | 96px |

Guest sections may use `48–80px` separation on mobile and `64–96px` on desktop.

Admin interfaces primarily use `8–24px` internal spacing and `24–32px` section spacing.

---

## 6. Layout and Responsive Strategy

### 6.1 Mobile-first breakpoints

Use Tailwind's standard responsive model unless later development architecture changes it:

```text
base       < 640px
sm         >= 640px
md         >= 768px
lg         >= 1024px
xl         >= 1280px
2xl        >= 1536px
```

### 6.2 Guest content width

Recommended:

```text
Guest reading/form column: max-width 720px
Guest wide media/decorative content: max-width 1120px
```

### 6.3 Admin content width

Recommended maximum shell:

```text
max-width: 1440px
```

### 6.4 Horizontal gutters

| Viewport | Gutter |
|---|---:|
| Mobile | 16px |
| Small tablet | 24px |
| Desktop | 32px |
| Wide desktop | 40px |

### 6.5 Responsive principles

- Forms are single-column by default.
- Admin forms may become two-column when fields are logically related and space permits.
- Primary actions must remain reachable at narrow widths.
- Guest RSVP must not require horizontal scrolling.
- Admin data that cannot fit must use an accessible responsive pattern defined in the Admin spec.
- Guest layouts should support mobile safe-area insets when relevant.

---

## 7. Radii, Borders, and Shadows

### 7.1 Radius tokens

| Token | Value | Use |
|---|---:|---|
| `radius-sm` | 6px | Small controls/badges |
| `radius-md` | 10px | Inputs/buttons |
| `radius-lg` | 16px | Cards |
| `radius-xl` | 24px | Guest feature surfaces |
| `radius-full` | 9999px | Pills/circular controls |

### 7.2 Borders

Default control/card border:

```text
1px solid --color-border
```

### 7.3 Shadows

Use shadows sparingly. Guest elegance should primarily come from typography, spacing, imagery, and surface contrast rather than heavy elevation.

---

## 8. Shared Component Foundation

### 8.1 Button

Variants:

- Primary
- Secondary
- Ghost
- Danger

Requirements:

- minimum interactive height `44px`;
- clear hover, active, disabled, focus-visible states;
- loading state preserves width where practical;
- icon-only buttons require an accessible name;
- destructive variant is clearly distinct from Primary.

### 8.2 Link

Links must be visually distinguishable, keyboard-focusable, and accessible. External map navigation may include an external-navigation icon, but the icon library is deferred.

### 8.3 Input / Textarea

Shared states:

- default;
- hover;
- focus;
- invalid;
- disabled;
- read-only.

Input height should be at least `44px`.

Textarea supports Event content, Dietary Requirements, Guest Message, and similar multiline fields.

### 8.4 Select / Combobox

Use native select semantics or an accessible custom implementation. Do not build custom selection behavior only for decorative appearance.

### 8.5 Checkbox / Radio

Use native semantic inputs with styled visible controls. Radio-group semantics are appropriate where one exclusive RSVP choice is presented.

Exact RSVP interaction design belongs to `07-guest-experience-spec.md`.

### 8.6 Field wrapper

Every field supports:

```text
Label
Optional/required indication where appropriate
Control
Description/help text
Error text
```

Errors must be programmatically associated with controls.

### 8.7 Card / Panel

Neutral structural container for Admin metrics, Invitation details, forms, and selected Guest surfaces. Guest pages should not become generic dashboard-style card collections.

### 8.8 Badge / Status

Support at least:

- Awaiting Response;
- Attending;
- Declined;
- Draft;
- Published;
- Ended;
- Revoked where shown administratively.

Status uses text plus color and optionally icon. Color alone is insufficient.

### 8.9 Alert

Variants:

- Info
- Success
- Warning
- Error

### 8.10 Dialog

May be used for high-impact confirmation such as Token regeneration or Invitation revocation when specified later.

Requirements include focus trap, focus return, keyboard support, title/description, and clear action hierarchy.

### 8.11 Toast

Appropriate for low-risk transient confirmation such as `Invitation link copied` or `Changes saved`.

Critical errors must not exist only in a toast.

### 8.12 Skeleton

Use only when it meaningfully reduces perceived wait; do not cause large layout shifts.

### 8.13 Empty state

State what is empty, explain the next useful action when one exists, and remain consistent with permissions.

---

## 9. Form Foundation

### 9.1 Labels

Every form control requires an accessible label. Placeholder text is never the only label.

### 9.2 Draft versus publication completeness

Event Drafts may be incomplete even though publication requires specific fields. Form UI must distinguish:

- field validity during editing; and
- publication completeness.

The UI must not imply that every required-to-publish field must be completed merely to save a Draft.

Exact Event-editor messaging belongs to `08-admin-dashboard-spec.md`.

### 9.3 Validation timing

Recommended pattern:

- lightweight client validation may run on blur or submit;
- authoritative validation runs server-side;
- server errors map back to the relevant field/form;
- error styling is not shown prematurely before reasonable interaction.

### 9.4 Error placement

Field error pattern:

```text
Label
[Control]
Specific error message
```

Form-level errors appear near the form action/summary and should be focusable or announced appropriately when submission fails.

### 9.5 Preserve input

After recoverable validation errors, valid entered values should remain visible where technically safe.

### 9.6 Disabled versus read-only

Use **disabled** when an action is unavailable and **read-only** when the value remains useful to see but editing is intentionally prevented.

After RSVP Deadline, Guest RSVP should communicate a read-only state rather than appearing broken.

---

## 10. Interactive Target Sizes

Target minimum pointer/touch size:

```text
44 x 44px
```

This applies to buttons, icon buttons, checkbox/radio hit areas, and other primary interactive controls.

---

## 11. Focus and Keyboard Interaction

### 11.1 Focus-visible

Recommended:

```text
2px focus ring
2px offset where surface permits
--color-focus
```

### 11.2 Keyboard

All workflows must be completable without a pointer where the browser interaction model supports it.

Required:

- predictable Tab order;
- no keyboard traps;
- native Enter/Space behavior;
- Escape behavior for dismissible dialogs/popovers;
- focus restoration after modal close where appropriate.

### 11.3 Focus after mutation

After form errors, focus should move to or announce the first meaningful error when appropriate. Successful ordinary saves should not unnecessarily steal focus.

---

## 12. Accessibility Foundation

V1 targets WCAG 2.2 AA.

At minimum:

- semantic HTML;
- logical heading hierarchy;
- explicit form labels;
- associated descriptions/errors;
- sufficient contrast;
- visible focus;
- keyboard operation;
- meaningful link/button names;
- appropriate status announcements;
- reduced-motion support;
- meaningful image alternative text;
- decorative imagery hidden from assistive technology;
- no essential information conveyed by color alone.

### 12.1 Hero Image alternative text

Hero Image alt-text behavior depends on whether the uploaded image communicates meaningful Event content. `07-guest-experience-spec.md` should define the final behavior without duplicating nearby Event information unnecessarily.

### 12.2 Live announcements

Use `aria-live` where appropriate for submission results, validation summaries, and relevant dynamic form changes. Do not make every visual update a live announcement.

---

## 13. Semantic Status Presentation

### RSVP

- **Awaiting Response:** neutral, not alarming.
- **Attending:** success-positive.
- **Declined:** neutral-to-muted rather than destructive.

Declining an Invitation is a valid response, not an application error.

### Invitation Revoked

Revoked is an administrative access state and may use warning/danger treatment in Admin UI.

### Event state

- Draft: neutral
- Published: positive/info
- Ended: muted

Exact copy belongs to later Guest/Admin specifications.

---

## 14. Loading States

### Page loading

Prefer server-rendered content. When deferred content is needed, use stable skeleton dimensions and avoid unnecessary full-screen spinners.

### Form submission

During submission:

- prevent duplicate submission when necessary;
- preserve visible form context;
- show pending state on the action;
- do not clear fields before successful persistence.

### Copy action

Copy-to-clipboard should give immediate non-blocking confirmation.

---

## 15. Success States

Small Admin saves may use inline/transient `Saved` feedback.

Guest RSVP completion is a major state change and should receive a persistent confirmation state defined in `07-guest-experience-spec.md`.

After Token regeneration, Admin UI must make the new link available and clearly indicate that the old link is invalid.

---

## 16. Error States

### Validation errors

Use specific actionable language, for example:

```text
Maximum Party Size must be between 1 and 20.
```

Avoid generic `Invalid input` where a specific cause is known.

### Guest access errors

Invalid, obsolete, revoked, Draft, and Ended states must not reveal unnecessary private details. Exact wording belongs to the Guest Experience specification.

### Unexpected errors

Show safe recovery-oriented feedback. Never surface stack traces, database errors, raw token values, or internal technical detail.

---

## 17. Empty States

Foundational patterns are required for:

- Organizer has no Events;
- Event has no Invitations;
- search/filter returns no Invitations;
- optional Guest content is absent.

Search/filter empty state must be distinguishable from an Event that truly has zero Invitations.

---

## 18. Destructive and High-Impact Actions

Potentially high-impact actions include:

- Regenerate Invitation Token;
- Revoke Invitation;
- Permanently Delete Event.

Rules:

- label the action explicitly;
- communicate the consequence before completion;
- regeneration must state that the previous link stops working;
- Event deletion must state that Event, Invitations, RSVPs, access credentials, and Hero Image are permanently removed with no V1 restore;
- destructive styling is not used for routine actions.

Whether these use Dialogs or dedicated confirmation sections is finalized in `08-admin-dashboard-spec.md`.

---

## 19. Image and Media Foundation

### Hero Image

Guest design must support Hero Image present, absent, loading, and error fallback.

Recommended behavior:

- responsive image sizing;
- stable layout dimensions;
- avoid unnecessarily large image downloads;
- preserve visual focus where possible.

Exact crop/aspect-ratio strategy belongs to `07-guest-experience-spec.md`.

### Decorative imagery

Decorative assets must not contain essential text, block form interaction, or be announced to assistive technology.

---

## 20. Motion Foundation

Motion / Framer Motion may be used for polish.

### 20.1 Motion tokens

| Token | Value |
|---|---:|
| `duration-fast` | 120ms |
| `duration-base` | 180ms |
| `duration-slow` | 320ms |

Recommended easing:

```text
standard: cubic-bezier(0.2, 0, 0, 1)
enter:    cubic-bezier(0.16, 1, 0.3, 1)
exit:     cubic-bezier(0.4, 0, 1, 1)
```

### 20.2 Appropriate motion

Examples include subtle Guest section entry, Dialog transition, status transition, and button/field micro-interactions.

### 20.3 Inappropriate motion

Do not use long blocking intros, scroll-jacking, distracting autoplay animation, or animation required to understand business state.

### 20.4 Reduced motion

Under `prefers-reduced-motion: reduce`, remove non-essential movement and preserve all functionality.

---

## 21. Guest Page Foundation

Detailed hierarchy belongs to `07-guest-experience-spec.md`, but the foundation requires:

- one-column mobile-first reading flow;
- clear personalized Invitee context;
- readable Event date/time/venue;
- strong RSVP entry point;
- Maximum Party Size clarity;
- touch-sized form controls;
- clear read-only RSVP state after deadline;
- graceful no-Hero-Image state.

---

## 22. Admin Foundation

Detailed information architecture belongs to `08-admin-dashboard-spec.md`, but the foundation requires:

- clear page title and Event context;
- consistent top-level action placement;
- metric-card pattern;
- form-section pattern;
- Invitation-list/table pattern;
- status-badge pattern;
- search/filter control pattern;
- safe secondary actions for copy, regenerate, revoke, and export;
- a clear read-only presentation for Ended Event records.

Admin density may increase on desktop without making narrow-screen use unusable.

For Ended Events, view/export controls remain available while mutation controls are removed, disabled, or replaced by read-only value presentation according to `08-admin-dashboard-spec.md`.

---

## 23. Content and Microcopy Principles

UI copy should be concise, specific, calm, action-oriented, and consistent with canonical terminology.

Use canonical terms:

- Organizer
- Event
- Invitation
- Invitee
- Invitation Token
- Maximum Party Size
- RSVP
- Attendee
- Attendee Count
- RSVP Deadline

Guest-facing language may be warmer, but it must not create contradictory domain concepts.

---

## 24. Date and Time Presentation Foundation

UI principles:

- display Event-local date/time rather than server timezone;
- show timezone context when ambiguity matters;
- avoid raw ISO timestamps in normal UI;
- use readable locale-aware formatting.

Exact format strings are deferred to Guest/Admin specs.

---

## 25. Responsive Data Presentation

### Metrics

Metric cards may be single-column on narrow mobile, two-column where useful, and a larger grid on desktop.

### Invitation list

The Admin spec must define an accessible responsive representation. The foundation does not prematurely mandate desktop table versus mobile list/card behavior.

### Forms

Mobile forms are single-column and use available width. Wider Admin screens may place logically paired fields on one row.

---

## 26. Tailwind Implementation Foundation

Prefer semantic design tokens via CSS variables.

Conceptual pattern:

```css
:root {
  --color-page: #FFFDF9;
  --color-surface: #FFFFFF;
  --color-text: #211C18;
  --color-text-muted: #665E57;
  --color-border: #E5DDD5;
  --color-accent: #7A4452;
  --color-focus: #2457C5;
  --color-danger: #B42318;
}
```

Tailwind utilities/components should reference semantic variables rather than duplicate raw values.

Repeated component patterns belong in shared UI primitives. Exact Tailwind configuration and component folders belong to `12-development-architecture.md`.

---

## 27. Component State Matrix

| Component | Default | Hover | Focus | Active | Disabled | Invalid | Loading |
|---|---:|---:|---:|---:|---:|---:|---:|
| Button | Yes | Yes | Yes | Yes | Yes | N/A | Yes |
| Text Input | Yes | Yes | Yes | N/A | Yes | Yes | N/A |
| Textarea | Yes | Yes | Yes | N/A | Yes | Yes | N/A |
| Select | Yes | Yes | Yes | Yes | Yes | Yes | N/A |
| Checkbox | Yes | Yes | Yes | Yes | Yes | When relevant | N/A |
| Radio | Yes | Yes | Yes | Yes | Yes | When relevant | N/A |
| Link | Yes | Yes | Yes | Yes | N/A | N/A | N/A |
| Icon Button | Yes | Yes | Yes | Yes | Yes | N/A | When relevant |

Read-only is a separate semantic state where the value remains visible but editing is intentionally prevented.

---

## 28. UI Foundation Decisions Proposed by This Document

These are presentation/design decisions and do not alter business rules.

### UI-01 — Fixed curated V1 visual system

V1 uses one fixed visual token system. There is no Organizer-facing theme configuration.

### UI-02 — Serif display + sans UI typography

Guest wedding display headings use a serif family; forms, body copy, and Admin use a sans-serif family.

### UI-03 — Warm neutral + muted wine palette

V1 uses the fixed palette in Section 4.

### UI-04 — Mobile-first responsive foundation

Guest layouts start from mobile; Admin remains responsive across supported viewport sizes.

### UI-05 — WCAG 2.2 AA baseline

Shared components and page specifications target WCAG 2.2 AA.

### UI-06 — 44px minimum interactive target

Primary interactive controls target a minimum 44px touch/click size.

### UI-07 — Persistent validation feedback

Transient toasts alone are insufficient for actionable validation failures.

### UI-08 — Reduced-motion support

Non-essential motion is reduced or removed when the user prefers reduced motion.

---

## 29. What This Document Does Not Decide

This foundation intentionally leaves the following for later specifications:

- exact Guest Invitation section order;
- exact RSVP control pattern;
- exact RSVP confirmation composition;
- Hero Image crop/aspect ratio;
- exact invalid/revoked/expired Guest copy;
- exact Admin navigation;
- exact desktop/mobile Invitation-list pattern;
- exact Event-edit page layout;
- exact Auth screens;
- exact Dialog usage per Admin action;
- exact icons/icon library;
- exact date/time strings;
- exact empty-state illustrations;
- exact component implementation files;
- exact Storybook/component-doc tooling.

These details must be specified in the appropriate later document rather than inferred during implementation.

---

## 30. Traceability

| UI foundation area | Approved source |
|---|---|
| Mobile-first Guest UI | Product Concept, FR-PRES-002 |
| One curated wedding theme | D-15, FR-PRES-001 |
| No visual theme editor | D-15, FR-PRES-001 |
| Guest no-account access | R-GUEST, Guest User Flows |
| RSVP states / deadline read-only | D-02, D-03, FR-RSVP-001/002/007 |
| Party-size UI validation | D-25, FR-INV-003, FR-RSVP-003 |
| Optional Attendee Names | D-06, D-20, FR-RSVP-004 |
| Dietary Requirements / Guest Message | D-08, FR-RSVP-005 |
| Guest Message Admin read-only | D-22, FR-RSVP-009 |
| Regeneration warning | D-10, UF-ORG-12 |
| Revocation | D-11, UF-ORG-13 |
| Draft / Published / Ended display | D-18, FR-EVT-004 |
| Search/filter foundation | D-23, FR-INV-007 |
| Private Hero Image | D-14, TA-06 |
| Server-first accessibility support | Technical Architecture |
| Canonical terminology | README / Product Concept |

---

## 31. Review Checklist

Before marking this document Approved, confirm:

- the fixed V1 palette and typography direction are acceptable;
- V1 still has one curated wedding experience and no theme editor;
- Guest design remains mobile-first;
- Admin design prioritizes operational clarity;
- optional Hero Image absence is fully supported;
- typography sizes are readable on mobile;
- controls provide keyboard and visible-focus support;
- field errors are persistent and associated with controls;
- RSVP read-only state can be represented clearly;
- status meaning does not rely on color alone;
- Declined is not styled as an application error;
- destructive/high-impact actions remain distinguishable;
- motion is optional and reduced-motion aware;
- no UI choice changes an approved product rule.

---

## 32. Next Document

After this Design System and UI Foundation is reviewed and approved, create:

**`07-guest-experience-spec.md`**

The Guest Experience specification should use this foundation to define the exact mobile-first Invitation page hierarchy, content sections, RSVP interaction, confirmation/read-only states, validation presentation, Hero Image behavior, venue/map interaction, and invalid/revoked/expired Invitation states without changing approved business behavior.
