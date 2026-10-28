# Sauda — Phase 4 Apply Guide: Founder/Investor Workflow Correctness

This guide describes how to verify and apply the Phase 4 deliverable package to a target `Sauda-SharkTank` repository.

---

## 1. Safety Constraints & Prerequisites

1. **No Frontend Modifications:** Phase 4 touches only backend services, API routes, database locking logic, tests, package scripts, and documentation. No files in `client/` are modified.
2. **Protected Databases:** Never point destructive or database-writing integration tests at `sharktank_db`, `sharktank_db_test_full_20261023`, or production databases.
3. **Dedicated Port:** All integration tests require an explicit `SAUDA_TEST_API_BASE` targeting a dedicated server port (e.g. `http://localhost:4010/api`). Tests refuse port `4000` to prevent accidental execution against the development environment.
4. **Draft Migration 004:** Keep migration `004_admin_pitch_review_DRAFT.sql` as a draft. Do not apply it as part of Phase 4.

---

## 2. Overlay Installation

From the repository root:

```bash
# Verify working tree cleanliness
git status --short

# Unpack the deliverables overlay (preserves existing directory structure)
unzip -o sauda_phase4_deliverables.zip
```

---

## 3. Build & Static Verification

From the `server/` directory:

```bash
cd server

# 1. Typecheck application and test code
npm run typecheck

# 2. Typecheck database tooling and scripts
npm run typecheck:scripts

# 3. Compile TypeScript to dist/
npm run build
```

---

## 4. Run Unit Test Suites (No MySQL Required)

Run the fast unit suites (these do not connect to a database):

```bash
cd server

# Phase 1 baseline & migration planner checks
npm run test:phase1

# Phase 2/3 admin review logic checks
npm run test:admin-review

# Phase 3 historical CSV parser checks
npm run test:historical-csv

# Phase 4 workflow correctness unit tests
npm run test:phase4

# Or run all unit tests in a single aggregated run
npm test
```

---

## 5. Run Integration Test Suites (Against Verified Disposable Test Database)

Ensure a dedicated API server is running on port `4010` connected to a verified disposable database matching `sauda_test_*` (e.g., `sauda_test_phase3`):

```bash
# In terminal 1 (dedicated test API server on port 4010):
cd server
PORT=4010 DB_NAME=sauda_test_phase3 npm run dev

# In terminal 2 (running integration tests):
cd server

# Run workspace concurrency & security integration suite
SAUDA_RUN_WORKSPACE_SECURITY_TESTS=1 \
DB_NAME=sauda_test_phase3 \
SAUDA_TEST_API_BASE=http://localhost:4010/api \
npm run test:integration:workspaces

# Run Phase 4 workflow correctness & concurrency integration suite
SAUDA_RUN_PHASE4_INTEGRATION_TESTS=1 \
DB_NAME=sauda_test_phase3 \
SAUDA_TEST_API_BASE=http://localhost:4010/api \
npm run test:integration:phase4
```

Both integration suites:
- Verify that the database is local and named `sauda_test_*`.
- Refuse protected databases.
- Require explicit opt-in flags.
- Tag fixtures with unique run IDs.
- Clean up all created fixtures in reverse foreign-key order upon test completion.
