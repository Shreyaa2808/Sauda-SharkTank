# Sauda Phase 6: Operational Apply & Verification Guide

This guide provides instructions for running both offline unit test suites and database-backed integration test suites for Phase 6.

---

## 1. Safety Rules & Pre-Flight Checks

Before running any commands:
1. **Never run writes against production databases:** `sharktank_db` and `sharktank_db_test_full_20261023` are strictly protected and rejected by repository test safety guards.
2. **Never drop or wipe populated test fixtures:** `sauda_test_phase3` contains existing test fixtures and import reports. Integration tests are designed to insert unique test-tagged rows and clean up only those specific IDs.
3. **Do not apply draft migration 004:** `database/migrations/004_admin_pitch_review_DRAFT.sql` must remain in `DRAFT` status until separately approved.
4. **No client modifications:** Frontend files in `client/` must remain untouched.
5. **No git commits/pushes:** All work must remain in the working directory; parent commit `b34537f` is preserved.

---

## 2. Fast Offline Verification (No Database Connection Required)

To verify TypeScript compilation, scripts build, and all 66 offline unit tests across Phases 1 through 6:

```bash
cd server
npm test
```

This runs:
- `npm run typecheck` — TypeScript check of server source files (`tsc --noEmit`).
- `npm run typecheck:scripts` — TypeScript check of DB scripts (`tsc -p tsconfig.scripts.json`).
- `npm run build` — Server build (`tsc`).
- `npm run test:dbtools` — 24 baseline, planner, and database tooling tests.
- `npm run test:admin-review` — 9 admin review workflow unit tests.
- `npm run test:historical-csv` — 4 historical CSV parsing tests.
- `npm run test:phase4` — 10 founder/investor workflow unit tests.
- `npm run test:phase5` — 16 HTTP validation, pagination, and OAuth error mapping tests.
- `npm run test:phase6` — 3 date normalization and database safety unit tests.

**Expected Result:** 66 tests pass, 0 fail.

---

## 3. Database-Backed Integration Testing (`sauda_test_phase3`)

### Prerequisites:
- Local MySQL instance running on `127.0.0.1:3306`.
- Server running on port `4010` (or another designated test port).
- `sauda_test_phase3` database accessible with `sauda_test_user`.

### A. Historical Admin CRUD Integration Suite

Verifies administrative create, update, and delete endpoints for seasons, episodes, and sharks, testing authentication, 403 non-admin rejection, malformed parameters, and direct MySQL state persistence:

```bash
cd server
SAUDA_RUN_HISTORICAL_ADMIN_INTEGRATION=1 \
DB_NAME=sauda_test_phase3 \
SAUDA_TEST_API_BASE=http://localhost:4010/api \
npm run test:integration:historical-admin
```

**Expected Result:**
```text
▶ Sauda Phase 6: Historical Admin CRUD Integration Suite
  ✔ 1. Access controls: Unauthenticated (401) and Non-Admin (403) are rejected
  ✔ 2. Historical Seasons: Create, Update, Delete with database verification
  ✔ 3. Historical Episodes: Create, Update, Delete with database verification
  ✔ 4. Historical Sharks: Create, Update, Delete with database verification
✔ Sauda Phase 6: Historical Admin CRUD Integration Suite
ℹ tests 5, pass 5, fail 0
```

### B. Phase 4 Founder/Investor Integration Suite

Verifies pending connection withdrawal, pitch archiving concurrency locks, watchlist transactions, and submission timestamps:

```bash
cd server
SAUDA_RUN_PHASE4_INTEGRATION_TESTS=1 \
DB_NAME=sauda_test_phase3 \
SAUDA_TEST_API_BASE=http://localhost:4010/api \
npm run test:integration:phase4
```

**Expected Result:**
```text
▶ Sauda Phase 4: Founder/Investor Workflow Correctness Integration Suite
  ✔ Section A: Investor withdrawal of pending request and race against acceptance
  ✔ Section B: Concurrent request creation vs pitch archiving
  ✔ Section C: Transactional, visibility-aware watchlist toggling
  ✔ Section D: Submission timestamps and review queue ordering in MySQL
  ✔ Section E: Authenticated Founder and Investor profile editing with schema constraints
  ✔ Section F: Account linking recovery guidance in Google auth endpoint
✔ Sauda Phase 4: Founder/Investor Workflow Correctness Integration Suite
ℹ tests 7, pass 7, fail 0
```

### C. Workspace & Security Integration Suite

Verifies role escalation prevention, workspace activation, founder pitch ownership, and connection message lifecycles:

```bash
cd server
SAUDA_RUN_WORKSPACE_SECURITY_TESTS=1 \
DB_NAME=sauda_test_phase3 \
SAUDA_TEST_API_BASE=http://localhost:4010/api \
npm run test:integration:workspaces
```

**Expected Result:** `TEST SUMMARY: 47 PASSED, 0 FAILED`.

### D. Admin-Review Migration Dependency Check

Verifies that the test suite detects the draft state of migration 004 and skips execution safely:

```bash
cd server
SAUDA_RUN_ADMIN_REVIEW_INTEGRATION=1 \
DB_NAME=sauda_test_phase3 \
npm run test:integration:admin-review
```

**Expected Result:**
```text
﹣ admin review: queue, history, publish/reject, rollback, and concurrent decisions use MySQL transactions # PREREQUISITE BLOCKED: pitch_review_event table is absent. Migration 004 is kept as DRAFT and unapplied in this phase.
ℹ tests 1, pass 0, fail 0, skipped 1
```

---

## 4. Clean-Database Bootstrap Verification & DBA Setup

The application's test user (`sauda_test_user`) has schema-level privileges on `sauda_test_local` and `sauda_test_phase3`, but lacks global `CREATE DATABASE` privileges (`ER_DBACCESS_DENIED_ERROR`).

To test clean bootstrapping on an empty schema:

### Step 1: Provision Empty Schema in MySQL Workbench
Log into MySQL as `root` (or a DBA account) and execute:

```sql
CREATE DATABASE `sauda_test_clean` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `sauda_test_clean`.* TO 'sauda_test_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### Step 2: Run Bootstrap Verification
Once the empty database has been provisioned:

```bash
cd server
SAUDA_RUN_CLEAN_BOOTSTRAP_TEST=1 \
CLEAN_TEST_DB_NAME=sauda_test_clean \
npm run test:integration:clean-bootstrap
```

**What this verifies:**
1. Connects to `sauda_test_clean` and confirms zero pre-existing tables.
2. Creates `schema_migration` tracking table.
3. Applies baseline schema DDL and reference role seeds in a single pass.
4. Marks baseline migration 001 as `BASELINED`.
5. Confirms migration planner sees 0 unapplied baseline DDL and recognizes migration 004 as pending `DRAFT`.
6. Leaves populated fixture database `sauda_test_phase3` completely untouched.

### Step 3: Teardown (Optional)
When bootstrap verification is complete, drop the clean test schema in MySQL Workbench:

```sql
DROP DATABASE `sauda_test_clean`;
```

---

## 5. Summary of Package Test Scripts

| Script | Purpose | Environment Dependencies |
| :--- | :--- | :--- |
| `npm test` (`npm run test:all`) | Complete offline test sweep (Phases 1-6) | None (offline) |
| `npm run typecheck` | TypeScript compile check | None (offline) |
| `npm run typecheck:scripts` | Scripts compile check | None (offline) |
| `npm run build` | Transpile server build to `dist/` | None (offline) |
| `npm run test:phase6` | Phase 6 date & safety unit tests | None (offline) |
| `npm run test:integration:historical-admin` | Seasons, episodes, sharks live admin CRUD | MySQL + Port 4010 |
| `npm run test:integration:phase4` | Workflow correctness & concurrency | MySQL + Port 4010 |
| `npm run test:integration:workspaces` | Workspace role & message security | MySQL + Port 4010 |
| `npm run test:integration:admin-review` | Pitch review migration & workflow | MySQL (Migration 004 required for live run) |
| `npm run test:integration:clean-bootstrap` | Baseline loader verification on empty DB | MySQL (`sauda_test_clean` provisioned) |
