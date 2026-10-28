# Sauda — Phase 5 Manifest: Security, Validation and Operational Reliability

**Timestamp:** 2026-10-28  
**Scope:** Backend/API, authentication & authorization, input validation, SQL safety, test fixtures & safety tooling, operational documentation.  
**Preserved Commit:** `b34537f` (`fix(workspaces): serialize connection and messaging transitions`)  
**Frontend Changes:** 0 files modified (verified via `git status --porcelain | grep client/`).  
**Git Commits/Pushes:** None executed (working tree strictly uncommitted as requested).

---

## 1. Executive Summary & Verification State

Phase 5 hardens the Sauda SharkTank platform with comprehensive HTTP input validation, bounded pagination, deterministic tie-breaker sorting, bounded upstream OAuth timeouts, credential redaction in logs and client responses, repeatable test safety tooling, and documented first-admin bootstrap procedures.

### Test Results Summary
- **Unified Unit & Deterministic Suite (`npm test` / `npm run test:all`):** **63 / 63 PASSING**
  - Phase 1 Baseline & Migration Planner (`test:dbtools`): **24 / 24 PASSING**
  - Phase 2 Admin Review Decision Logic (`test:admin-review`): **9 / 9 PASSING**
  - Phase 3 Historical CSV Parser & Invariants (`test:historical-csv`): **4 / 4 PASSING**
  - Phase 4 Workflow & Serialization Logic (`test:phase4`): **10 / 10 PASSING**
  - Phase 5 Validation, Security & Safety Guards (`test:phase5`): **16 / 16 PASSING**
- **Live Integration Suites (Local Disposable DB `sauda_test_phase3` on Port 4010):**
  - Workspaces & Role Escalation (`test:integration:workspaces`): **47 / 47 PASSING**
  - Phase 4 Concurrency & Request Lifecycle (`test:integration:phase4`): **7 / 7 PASSING**
  - Admin Review Integration (`test:integration:admin-review`): **1 FAIL (EXPECTED)** — migration `004_admin_pitch_review_DRAFT.sql` is intentionally preserved as a draft and not applied.

---

## 2. Deliverables & File-by-File Breakdown

### A. New Modules & Tooling

| File | Purpose |
| :--- | :--- |
| `server/src/validation.ts` | Shared HTTP input validation helpers: `validateJsonObject`, `parsePositiveIntegerId`, `parsePagination`, `validateAllowedFields`, `validateBoundedString`, `formatSafeErrorResponse`, and `ValidationError`. Standardizes 400 responses across all routes and sanitizes 500 error outputs to guarantee SQL/stack trace redaction. |
| `server/src/testSafetyGuards.ts` | Multi-layer test safety harness: verifies explicit test opt-in (`SAUDA_RUN_*`), enforces local hosts (`localhost`, `127.0.0.1`), enforces `sauda_test_*` disposable DB name patterns, rejects protected databases (`sharktank_db`, `sys`, `mysql`, `information_schema`), rejects default port `4000`, enforces `/api` path, and validates the live MySQL connection against `SELECT DATABASE()`. |
| `server/scripts/verify_admin.ts` | Secret-safe command-line administrator verification tool. Queries active `ADMIN` accounts and outputs masked email addresses without disclosing credentials, database passwords, or `.env` contents. |
| `server/src/phase5.test.ts` | 16 comprehensive, fully offline, deterministic unit tests verifying input validation, Google OAuth timeouts (mock fetch), upstream error mapping, credential redaction, pagination upper bounds, and safety guard abort behavior. |

### B. Modified Backend Services & Endpoints

| File | Modifications |
| :--- | :--- |
| `server/src/auth.ts` | Updated `verifyGoogleIdToken`: bounded request timeout (default 5000ms via `AbortController`), mapping timeouts to 504 `GOOGLE_OAUTH_TIMEOUT` and upstream 5xx errors to 502 `GOOGLE_OAUTH_UNAVAILABLE`. Redacted sensitive token strings from error logging. Preserved strict account-linking safeguards (no email-only auto-linking). |
| `server/src/adminReview.ts` | Enhanced `getAdminReviewQueue` to accept optional `{ limit, offset }` pagination bounded to a maximum of 100 items. Preserved deterministic tie-breaker sorting `ORDER BY p.submitted_at ASC, p.pitch_id ASC`. |
| `server/src/historical.ts` | Added deterministic secondary sort tie-breakers across all list endpoints (`s.season_id ASC`, `e.episode_id ASC`, `sh.shark_id ASC`, `p.pitch_id ASC`). Enforced strict allowlist validation for `dealStatus` and bounded pagination for `searchHistoricalPitches`, `listHistoricalSeasons`, and `listHistoricalEpisodes`. |
| `server/src/workspaces.ts` | Replaced string interpolation in `getInvestorPitches` ordering with a strict allowlist dictionary (`SORT_ORDERS`) ensuring all sort branches enforce the deterministic tie-breaker `, p.pitch_id DESC`. |
| `server/src/index.ts` | Integrated `validation.ts` across route handlers: validated JSON body shapes before property destructuring, validated path and query IDs as safe positive integers, added pagination to `GET /api/admin/reviews`, and ensured unhandled errors return sanitized `{ error: 'SERVER_ERROR', message: 'Unexpected server error.' }` without leaking SQL syntax, stack traces, or environment secrets. |
| `server/src/test_workspaces_security.ts` | Migrated ad-hoc guards to `assertIntegrationTargetSafe` and added active database connection verification via `verifyConnectedDatabase`. |
| `server/src/adminReview.integration.test.ts` | Migrated ad-hoc guards to `assertIntegrationTargetSafe` and added `verifyConnectedDatabase`. |
| `server/src/phase4.integration.test.ts` | Migrated ad-hoc guards to `assertIntegrationTargetSafe` and added `verifyConnectedDatabase`. |
| `server/package.json` | Added `test:phase5` and `db:verify-admin` scripts. Updated `test:all` to run the full suite (build, typechecks, dbtools, admin-review, historical-csv, phase4, phase5). Confirmed `npm test` runs `test:all`. |

---

## 3. Work Item Details

### Item A: Standardize HTTP Input Validation & SQL Allowlisting
- **JSON Body Shape:** All write endpoints (`POST /api/auth/google`, `POST /api/user/roles/activate`, `POST /api/founder/pitches`, `PUT /api/founder/pitches/:pitchId`, `POST /api/investor/watchlist/toggle`, `POST /api/connections/request`, `POST /api/conversations/:conversationId/messages`) reject null, undefined, arrays, and primitive bodies with consistent HTTP 400 `{ error: 'INVALID_BODY', message: 'A JSON object is required.' }`.
- **Path & Query Identifiers:** Path parameters (`pitchId`, `requestId`, `conversationId`, `seasonId`, `episodeId`, `sharkId`, `offerId`, `userId`) and query IDs are validated via `parsePositiveIntegerId`. Rejects floats (`12.5`), negative numbers, strings with non-digits (`'12abc'`), booleans, and zero with HTTP 400.
- **SQL Identifier Allowlisting:** No user-controlled string is interpolated into SQL identifier positions. `ORDER BY` clauses in `getInvestorPitches` are resolved against a static internal dictionary:
  ```ts
  const SORT_ORDERS: Record<string, string> = {
    latest: 'p.submitted_at DESC, p.pitch_id DESC',
    ask_asc: 'p.original_ask_amount ASC, p.pitch_id DESC',
    ask_desc: 'p.original_ask_amount DESC, p.pitch_id DESC',
    brand_name: 'c.brand_name ASC, p.pitch_id DESC',
  };
  ```

### Item B: Google Token Verification Timeout & Redaction
- **Bounded Request Timeout:** `verifyGoogleIdToken` accepts an optional `timeoutMs` (defaults to `process.env.GOOGLE_OAUTH_TIMEOUT_MS` or `5000ms`) and uses `AbortController` to abort slow upstream requests.
- **Error Mapping:**
  - Upstream timeout / abort: HTTP 504 `{ error: 'GOOGLE_OAUTH_TIMEOUT', message: 'Google token verification service timed out. Please try again.' }`.
  - Upstream 5xx availability failure: HTTP 502 `{ error: 'GOOGLE_OAUTH_UNAVAILABLE', message: 'Google authentication service is currently unreachable. Please try again later.' }`.
  - Upstream 4xx invalid credential: HTTP 401 `{ error: 'TOKEN_VERIFICATION_FAILED', message: '...' }`.
- **Credential Redaction:** Error logs output only `err?.message` or generic network descriptions. Raw `idToken`, claims payloads, or client secrets are never printed.
- **Preserved Safeguards:** Existing signature validation, audience verification (`aud === GOOGLE_CLIENT_ID`), issuer checks, email verification, and the explicit no-email-only auto-linking invariant are preserved.

### Item C: Bounded Pagination & Deterministic Sorting
- **Strict Bounds:** Query parameters `limit` and `offset` are parsed with `parsePagination`.
  - Non-integer or negative inputs are rejected with HTTP 400 (preventing silent coercion).
  - Upper limit is safely clamped to 100 (`Math.min(100, limit)`).
- **Deterministic Sort Orders:**
  - `adminReview.ts` (`getAdminReviewQueue`): `ORDER BY p.submitted_at ASC, p.pitch_id ASC`
  - `historical.ts` (`searchHistoricalPitches`): `ORDER BY s.country_franchise ASC, s.season_number ASC, e.episode_number ASC, p.pitch_sequence_order ASC, p.pitch_id ASC`
  - `historical.ts` (`listHistoricalSeasons`): `ORDER BY s.country_franchise ASC, s.season_number ASC, s.season_id ASC`
  - `historical.ts` (`listHistoricalEpisodes`): `ORDER BY e.episode_number ASC, e.episode_id ASC`
  - `historical.ts` (`listHistoricalSharks`): `ORDER BY i.display_name ASC, sh.shark_id ASC`
  - `historical.ts` (`listHistoricalImportReports`): `ORDER BY audit_id DESC`
  - `workspaces.ts` (`getInvestorPitches`): All sort options include primary key `, p.pitch_id DESC`.

### Item D: Test Fixture Repeatability & Safety Guards
- **Shared Safety Module (`server/src/testSafetyGuards.ts`):**
  - Requires explicit opt-in variable (`SAUDA_RUN_* === '1'`).
  - Restricts `DB_HOST` to local interfaces (`localhost`, `127.0.0.1`, `::1`).
  - Restricts `DB_NAME` to `/^sauda_test_[a-z0-9_]{1,40}$/i`.
  - Forbids targeting protected databases (`sharktank_db`, `sharktank_db_test_full_20261023`, `mysql`, `information_schema`, `performance_schema`, `sys`).
  - Rejects default development port `4000` (requires a dedicated non-4000 port like `4010`).
  - Verifies active database connection via `SELECT DATABASE()`.
- **Harness Regression Tests:** Unit tests in `phase5.test.ts` verify immediate rejection when opt-in is absent, when port 4000 is used, when protected databases are targeted, and when remote hosts are specified.

### Item E: First-Admin Bootstrap Review & Error Disclosure Safeguards
- **Role Model Protection:** Self-service role activation (`POST /api/user/roles/activate`) continues to strictly forbid the `ADMIN` role with HTTP 403 `ROLE_ACTIVATION_FORBIDDEN`.
- **First-Admin Bootstrap Procedure:**
  1. Have the user sign in once via Google OAuth to create the initial `app_user` record with the default `VIEWER` role.
  2. The DBA executes a manual direct SQL grant (safe, repeatable, idempotent):
     ```sql
     INSERT INTO user_role (user_id, role_id)
     SELECT u.user_id, r.role_id
     FROM app_user u
     CROSS JOIN app_role r
     WHERE u.email = 'target_admin@example.com' AND r.role_name = 'ADMIN'
     ON DUPLICATE KEY UPDATE role_id = role_id;
     ```
  3. Verify administrator existence safely via the new script:
     ```bash
     npm run db:verify-admin
     ```
     This queries the database and reports active administrator counts with masked emails, without exposing credentials or secrets.
- **Secret-Safe Error Responses:** Centralized error handler and route error formatters (`formatSafeErrorResponse`) catch unhandled errors and return `{ error: 'SERVER_ERROR', message: 'Unexpected server error.' }`. SQL queries, database error numbers, stack traces, `.env` values, and credentials are never sent to the client.

### Item F: Test Scripts and Developer Workflow
- **`npm test` / `npm run test:all`:** Runs all deterministic offline checks: `typecheck`, `typecheck:scripts`, `build`, `test:dbtools`, `test:admin-review`, `test:historical-csv`, `test:phase4`, `test:phase5`. Requires no live database connection.
- **Dedicated Test Commands:**
  - `npm run test:phase1` — Phase 1 DB tools and baseline tests
  - `npm run test:admin-review` — Phase 2 Admin review decision logic tests
  - `npm run test:historical-csv` — Phase 3 Historical CSV parsing tests
  - `npm run test:phase4` — Phase 4 Workflow & serialization unit tests
  - `npm run test:phase5` — Phase 5 Input validation & security unit tests
  - `npm run db:verify-admin` — Secret-safe administrator verification
  - `npm run test:integration:workspaces` — Integration suite for workspace permissions
  - `npm run test:integration:phase4` — Integration suite for Phase 4 concurrency & request lifecycle
  - `npm run test:integration:admin-review` — Integration suite for admin review (draft migration 004 dependent)

---

## 4. Preserved Open Verification Items

As required by the Phase 5 specification, the following four items are explicitly tracked and documented as open verification items:

1. **Phase 3 Historical Admin Create/Update/Delete Integration Tests:**
   The Phase 3 historical read, CSV import, and comparison services have full test coverage, but the administrative CUD routes (`POST /api/admin/historical/seasons`, etc.) still await a dedicated end-to-end database integration test suite.
2. **Draft Migration 004 & Admin-Review History:**
   The `pitch_review_event` table and review history persistence depend on migration `004_admin_pitch_review_DRAFT.sql`. In accordance with instructions, migration `004` remains in `DRAFT` status and was not applied.
3. **Clean-Database Migration / Bootstrap Test:**
   A clean-database bootstrap test should be executed on an empty MySQL database to prove the baseline DDL loads cleanly in a single pass and the migration planner accurately marks `001` as `BASELINED` and skips `002`/`003`.
4. **Phase 4 Integration Suite Against Committed Repository State:**
   The Phase 4 integration suite (`test:integration:phase4`) passes 7/7 on the active `sauda_test_phase3` instance. Once working changes are committed by the team, the suite should be re-run in CI against a fresh disposable test database.
