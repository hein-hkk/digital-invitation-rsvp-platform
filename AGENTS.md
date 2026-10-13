# AGENTS.md — Digital Invitation & RSVP Platform

This file is implementation guidance for Codex and other coding agents working in this repository.

It does **not** override the approved project specifications or ADRs. When anything conflicts, follow the precedence defined in `README.md`.

---

## 1. Read the Source of Truth Before Coding

Before implementing a slice:

1. read the relevant approved Product Decision(s);
2. read the relevant PRD requirement(s);
3. read the relevant User Flow;
4. read the Data Model;
5. read the Guest/Admin UI specification;
6. read the API/Server Contract;
7. read Security/Privacy;
8. read the applicable approved ADR(s);
9. read the required tests in `11-testing-strategy.md`;
10. follow `12-development-architecture.md` and `13-development-roadmap.md`.

If a required business rule is missing or conflicting, **stop and resolve the specification before coding**.

---

## 2. Mandatory Dependency Freshness Policy

### Do not rely on model-training-time package versions

When bootstrapping the repository, adding a dependency, or performing a dependency upgrade, **do not choose versions from memory or from the Codex model's training data**.

Actively verify the versions available **at implementation time** using authoritative current sources.

### Select the latest stable, production-supported, mutually compatible release

For every directly selected runtime, framework, tool, or library:

1. determine the current stable release from the official package registry and/or official project release documentation;
2. confirm that it is production-supported by the other parts of the approved stack;
3. confirm peer-dependency/runtime compatibility;
4. use the **latest stable compatible release** available at that time.

If the newest stable release of one package is incompatible with the approved stack, use the newest **stable compatible** release and document the compatibility reason in the implementation change/PR.

### Never silently use prerelease channels

Do **not** use any release identified as:

```text
alpha
beta
rc
canary
next
nightly
experimental
preview
prerelease
```

or another non-stable release channel/version identifier unless an approved specification or ADR explicitly requires it.

Do not select a Git commit/SHA build as a normal dependency version.

### If current version information cannot be verified

If internet/registry access is unavailable and the current stable version cannot be verified, **do not guess from model memory**.

Report that current-version verification is blocked and wait until authoritative version information can be checked.

---

## 3. Authoritative Version Sources

Prefer primary sources.

For JavaScript/npm packages:

- official npm registry/package metadata;
- official framework/library documentation;
- official release notes/changelog;
- official compatibility/upgrade guide.

For platform/runtime compatibility:

- official Vercel documentation;
- official Supabase documentation;
- official Node.js release/support information;
- official pnpm documentation.

Do not use a random blog post, tutorial, generated code sample, or old Stack Overflow answer as the authority for a current version choice.

---

## 4. Stack Compatibility Check at Repository Bootstrap

Before installing the initial dependency set, verify the current stable compatibility of at least:

```text
Node.js
pnpm
Next.js
React / React DOM
TypeScript
Tailwind CSS
Supabase JavaScript / SSR packages used by the chosen Auth integration
Zod
Motion / Framer Motion package used by the approved UI approach
Vitest
React Testing Library
Playwright
ESLint
Prettier
```

For **Node.js**, prefer the latest production-supported **Active LTS** line compatible with the current stable Next.js/Vercel stack unless official current platform guidance requires a different supported stable line.

For packages that must be paired, such as Next.js and React, verify the pairing from the current official compatibility guidance rather than choosing each version independently.

---

## 5. Recording the Chosen Versions

The repository configuration is the executable record of implementation-time versions.

At bootstrap:

- set the selected Node/runtime requirement in repository configuration;
- set the exact pnpm version through the `packageManager` field;
- record direct dependencies/devDependencies in `package.json`;
- commit `pnpm-lock.yaml`;
- use the lockfile for reproducible CI/deploy installs.

CI should install with the frozen lockfile.

Do not put rapidly aging exact dependency numbers into long-lived product specifications unless a compatibility/security requirement explicitly requires a fixed version there.

---

## 6. Adding or Upgrading Dependencies Later

Before adding a new production dependency:

1. confirm it serves an approved V1 need;
2. confirm the platform/framework does not already provide the capability adequately;
3. verify the latest stable release from authoritative current sources;
4. inspect peer dependencies and runtime support;
5. for major-version changes, read the official migration/upgrade guide;
6. update the lockfile;
7. run the required quality/test gates.

Do not perform broad automatic major-version upgrades without review.

Dependency updates must not silently change approved product behavior, security boundaries, API behavior, database behavior, or UI requirements.

---

## 7. Required Verification After Dependency Changes

At minimum run the repository-defined equivalents of:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:security
```

Run affected Playwright E2E tests and database/RLS tests when the changed dependency can affect them.

For a framework/runtime/toolchain upgrade, run the full required CI suite before treating the upgrade as complete.

---

## 8. Security and Stability Over Novelty

The target is:

> **latest stable and supported**, not **latest experimental**.

Do not enable experimental framework features merely because they are newer.

If a stable feature can satisfy the approved architecture, prefer it over an unstable equivalent.

Any proposal that requires an unstable dependency or experimental platform feature must be raised for explicit architecture/spec review before implementation.

---

## 9. Keep Changes Narrow

Implement the smallest coherent roadmap slice.

Do not:

- add speculative dependencies;
- introduce a global client-state library without approved need;
- add a separate API layer for ordinary first-party forms;
- replace approved platform choices without an ADR;
- change domain vocabulary;
- invent missing business rules.

---

## 10. Before Declaring a Slice Complete

Confirm:

```text
[ ] relevant specifications and ADRs were followed
[ ] selected dependency versions were verified from current authoritative sources
[ ] no prerelease/unstable package was introduced without explicit approval
[ ] package.json / runtime config / pnpm-lock.yaml reflect the selected versions
[ ] server/client boundaries remain valid
[ ] authorization and validation remain server-side
[ ] required tests pass
[ ] no secrets/private data leak into client code or logs
[ ] no new business rule was invented
```
