# Sauda Phase 4: Founder/Investor Workflow Correctness Manifest

## Overview

Phase 4 delivers workflow correctness across backend APIs, authentication/authorization safeguards, concurrency serializations, transactional MySQL logic, role profile editing, submission lifecycle timestamps, and accurate account recovery guidance.

No frontend files were modified, no migrations were applied, no authoritative databases were touched, and workspace concurrency commit `b34537f` was preserved.

---

## Deliverables & File Index

### 1. Backend Core Services & Routes
- **`server/src/workspaces.ts`**
  - **Section A (Investor Withdrawal):** Implements `withdrawConnectionRequest(userId, requestId, reason)` with row-locking (`SELECT ... FOR UPDATE`), requester validation (`investor_user_id === userId`), status guard (`request_status === 'PENDING'`), atomic update (`status_reason`, `withdrawn_at = CURRENT_TIMESTAMP`, `request_status = 'WITHDRAWN'`), and consistent `400` / `403` / `404` / `409` conflict responses. Adds `withdrawnAt` to `ConnectionRequestItem`, `getConnectionRequestById`, and `getUserConnections`.
  - **Section B (Request vs Archive Serialization):** Updates `createConnectionRequest` to start transactions before inspecting pitch state, acquiring an exclusive `FOR UPDATE` lock on the `pitch` row matching `archiveFounderPitch`'s lock order to prevent race conditions and deadlocks with soft deletion.
  - **Section C (Watchlist Transactional Logic):** Updates `toggleWatchlist` to lock the target pitch and existing watchlist record with `FOR UPDATE`. Verifies `pitch_status === 'PUBLISHED'` before allowing insertion, permits clean removal of saved entries, and catches duplicate-key collisions to return `409 WATCHLIST_CONFLICT` instead of generic 500 errors.
  - **Input Validation:** Enhances `validateBoundedText` to support configurable error codes (`INVALID_REASON`, `REASON_TOO_LONG`).

- **`server/src/founder.ts`**
  - **Section B & D (Lifecycle Timestamps & Archive):** In `updateFounderPitch`, refreshes `submitted_at = CURRENT_TIMESTAMP` exclusively on state transitions into `SUBMITTED` (initial submission from `DRAFT` or resubmission after `REJECTED`). Ordinary edits of drafts or rejected pitches preserve existing timestamps. Preserves lock order and atomic cascading status updates in `archiveFounderPitch`.

- **`server/src/roleProfiles.ts`**
  - **Section E (Role-Specific Profiles):** Implements authenticated read/update operations for Founder and Investor profiles (`getFounderRoleProfile`, `updateFounderRoleProfile`, `getInvestorRoleProfile`, `updateInvestorRoleProfile`).
  - Enforces strict allowlisting of editable fields, length constraints (names max 80, bio max 5000, etc.), phone number regex validation (`/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/`), valid calendar date format validation, non-negative amounts, and atomic validation that `minInvestmentAmount <= maxInvestmentAmount`.
  - Explicitly rejects privileged fields (`userId`, `role`, `roles`, `founderId`, `investorId`, `createdAt`, `updatedAt`) with `400 PRIVILEGED_FIELD_FORBIDDEN`.
  - Atomically creates or updates related investor profile rows and preference foreign keys in a single database transaction.

- **`server/src/auth.ts`**
  - **Section F (Account Linking Guidance):** Replaces the dead-end instruction advising password login with actionable guidance directing users with existing registered emails to contact the designated support/admin process (`support@sauda.internal`). Preserves protection against silent auto-linking on matching email addresses alone.

- **`server/src/db.ts`**
  - Configures `dbPool` to seamlessly route connections to `TEST_DB_USER` / `TEST_DB_PASSWORD` when targeting a verified disposable `sauda_test_*` schema, preventing permission collisions while keeping `DB_*` untouched for normal environments.

- **`server/src/index.ts`**
  - Mounts route handlers with `requireAuthAndRole` guards:
    - `POST /api/connections/:requestId/withdraw` (requester investor only)
    - `GET /api/founder/profile` (authenticated founder)
    - `PUT /api/founder/profile` (authenticated founder)
    - `GET /api/investor/profile` (authenticated investor)
    - `PUT /api/investor/profile` (authenticated investor)

### 2. Test Suites & Verification Scripts
- **`server/src/phase4.test.ts`**
  - Pure unit tests independent of MySQL covering withdrawal requester checks, invalid state conflicts, withdrawal reason bounds, pitch request eligibility, watchlist visibility rules, submission timestamp refresh logic, review queue deterministic tie-breakers, profile security guards, and account recovery message validation.
- **`server/src/phase4.integration.test.ts`**
  - MySQL-backed integration test suite guarded by strict safety constraints (`SAUDA_RUN_PHASE4_INTEGRATION_TESTS=1`, local host check, `sauda_test_*` disposable name check, protected DB refusal, explicit port check refusing `4000`).
  - Tests simultaneous races:
    - Investor withdrawal vs founder acceptance (serialized via row locking, zero corrupt state).
    - Connection request creation vs pitch archiving (pitch becomes `ARCHIVED`, any raced request is `WITHDRAWN`, no orphan pending request).
    - Concurrent watchlist toggling.
    - Timestamp refresh and deterministic review queue order (`submitted_at ASC, pitch_id ASC`).
    - Authenticated role profile editing and cross-role authorization rejection (`403`).
    - Account linking recovery validation without live Google OAuth token.
- **`server/src/test_workspaces_security.ts`**
  - Updated to dynamically resolve taxonomy IDs (`industryId`, `stageId`) rather than assuming hardcoded IDs, ensuring compatibility with clean baseline test databases.
- **`server/package.json`**
  - Adds `test:phase4` and `test:integration:phase4` script targets and includes `test:phase4` in the aggregate `test:all` / `npm test` pipeline.

### 3. Documentation
- **`PHASE4_MANIFEST.md`** — This manifest.
- **`PHASE4_APPLY_GUIDE.md`** — Instructions for safe overlay, environment setup, and test verification.

---

## Schema & Migration Status

- **`001_platform_auth_connections_messaging.sql`**: BASELINED.
- **`002_founder_pitch_review_fields_DRAFT.sql`**: SUPERSEDED (history handled by 004; `pitch.submitted_at` handles timestamps).
- **`003_user_saved_pitch_DRAFT.sql`**: SUPERSEDED (`user_saved_pitch` exists in baseline schema).
- **`004_admin_pitch_review_DRAFT.sql`**: PENDING DRAFT. Kept strictly as draft; not applied.
- **Schema Evaluation for Timestamps:** Baseline column `pitch.submitted_at` is `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`. It accurately records the latest submission and resubmission timestamps when updated on state transition to `SUBMITTED`. No database migration was needed or applied for Phase 4.

---

## Test Execution Results

| Test Target | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** (0 errors) | Strict compilation across all source and test files |
| **Scripts Typecheck** | `npm run typecheck:scripts` | **PASS** (0 errors) | Tooling and migration script types |
| **Production Build** | `npm run build` | **PASS** (0 errors) | `tsc` emits to `server/dist/` |
| **Phase 1 Database Tooling** | `npm run test:phase1` | **PASS** (24/24) | Baseline validation, migration planner, checksums |
| **Phase 2/3 Admin Review** | `npm run test:admin-review` | **PASS** (9/9) | Authorization, decision rules, SHOW immutability |
| **Phase 3 Historical CSV** | `npm run test:historical-csv` | **PASS** (4/4) | RFC 4180 parsing, quotes, CRLF |
| **Phase 4 Unit Suite** | `npm run test:phase4` | **PASS** (10/10) | Sections A through F pure validation tests |
| **Workspace Security Integration** | `npm run test:integration:workspaces` | **PASS** (47/47) | Multi-role activation, pitch owner guards, messaging, races |
| **Phase 4 Integration Suite** | `npm run test:integration:phase4` | **PASS** (7/7) | Live MySQL concurrency and API tests against `sauda_test_phase3` |

---

## Open Verification Items from Phase 3 (Preserved)

As required by the roadmap constraints:
- **Phase 3 Item Preserved:** Phase 3 read routes, CSV import, persistent report retrieval, comparison, and statistics were smoke-tested against the isolated database. Admin historical create/update/delete paths have not all been integration-tested. This item remains open and is preserved for the final verification phase.
