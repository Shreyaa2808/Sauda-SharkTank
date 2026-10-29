# Sauda — Phase 5 Apply Guide: Security, Validation and Operational Reliability

This guide provides instructions for inspecting, verifying, and applying Phase 5 changes in the `Sauda-SharkTank` repository.

---

## 1. Safety Rules & Constraints

- **Do Not Touch Frontend:** Zero frontend files (`client/`) are modified in this phase.
- **Do Not Commit or Push:** Keep the working tree uncommitted; do not run `git add .`, `git commit`, or `git push`.
- **Preserve Git Commit:** Preserve existing commit `b34537f` (`fix(workspaces): serialize connection and messaging transitions`).
- **Never Target Production/Application Databases:** Write tests are strictly forbidden from connecting to `sharktank_db`, `sharktank_db_test_full_20261023`, or ordinary application databases.
- **Disposable Database Pattern:** Use a dedicated local database matching `sauda_test_*` (such as `sauda_test_phase3`).
- **Dedicated Port for Integration Testing:** Never point test harnesses at port `4000` (the default dev server). Use a dedicated test port (e.g. port `4010`).
- **Draft Migration Preservation:** Keep `server/scripts/db/migrations/004_admin_pitch_review_DRAFT.sql` as a draft. Do not apply it during Phase 5.
- **Secret Redaction:** Never output `.env` secrets, database passwords, session tokens, or OAuth tokens in logs or responses.

---

## 2. Deliverable Files Overview

```
Sauda-SharkTank/
├── PHASE5_MANIFEST.md                       # Comprehensive manifest of Phase 5 changes & test results
├── PHASE5_APPLY_GUIDE.md                    # This document
├── sauda_phase5_deliverables.zip            # Self-contained overlay archive of Phase 5 files
└── server/
    ├── package.json                         # Added test:phase5, db:verify-admin, updated test:all
    ├── scripts/
    │   └── verify_admin.ts                  # Secret-safe CLI admin verification script
    └── src/
        ├── auth.ts                          # Google token verification timeout, redaction, 502/504 mapping
        ├── adminReview.ts                   # Bounded pagination for admin review queue
        ├── historical.ts                    # Bounded pagination & deterministic tie-breaker sorting
        ├── index.ts                         # Standardized input validation & safe error responses
        ├── testSafetyGuards.ts              # Reusable test safety guard harness
        ├── test_workspaces_security.ts      # Hardened with shared test safety guards
        ├── adminReview.integration.test.ts  # Hardened with shared test safety guards
        ├── phase4.integration.test.ts       # Hardened with shared test safety guards
        ├── phase5.test.ts                   # 16 offline unit tests for validation & safety
        ├── validation.ts                    # Standardized validation & error formatting helpers
        └── workspaces.ts                    # SQL order allowlisting & deterministic tie-breaker
```

---

## 3. Verification & Execution Workflow

All steps are run from the `server/` directory:

```bash
cd server
```

### Step 1: Typecheck & Compile

```bash
# 1. Typecheck server application code
npm run typecheck

# 2. Typecheck database tooling & scripts
npm run typecheck:scripts

# 3. Compile TypeScript
npm run build
```
*Expected result:* All three commands complete with exit code 0 and zero errors.

### Step 2: Run Full Unified Offline Test Suite

```bash
npm test
```
*Expected result:* Runs `test:all` which sequentially executes:
1. `npm run typecheck`
2. `npm run typecheck:scripts`
3. `npm run build`
4. `npm run test:dbtools` (24 passing tests)
5. `npm run test:admin-review` (9 passing tests)
6. `npm run test:historical-csv` (4 passing tests)
7. `npm run test:phase4` (10 passing tests)
8. `npm run test:phase5` (16 passing tests)

**Total: 63 / 63 tests passing with exit code 0.**

### Step 3: Run Phase 5 Dedicated Unit Tests

```bash
npm run test:phase5
```
*Expected result:* 16 tests passing, validating:
- JSON body shape validation
- Positive safe integer validation
- Bounded string length validation
- Error sanitization (no SQL/stack leaks)
- Google token verification timeout & 504 status
- Google token upstream error mapping & 502 status
- Pagination bounds (limit clamped to 100, invalid inputs rejected)
- Integration safety guards (port 4000 forbidden, protected DBs rejected, opt-in enforced)

### Step 4: Verify Administrator Existence

```bash
DB_NAME=sauda_test_phase3 npm run db:verify-admin
```
*Expected result:* Displays the administrator count and masked email addresses without printing passwords or credentials.

### Step 5: (Optional) Run Live Integration Tests Against Port 4010

Ensure the dedicated test server is running on port 4010 connected to `sauda_test_phase3`:

```bash
# Workspaces security integration suite
SAUDA_RUN_WORKSPACE_SECURITY_TESTS=1 DB_NAME=sauda_test_phase3 SAUDA_TEST_API_BASE=http://localhost:4010/api npm run test:integration:workspaces

# Phase 4 concurrency & workflow integration suite
SAUDA_RUN_PHASE4_INTEGRATION_TESTS=1 DB_NAME=sauda_test_phase3 SAUDA_TEST_API_BASE=http://localhost:4010/api npm run test:integration:phase4
```
*Expected result:* 47/47 passing tests for workspaces, 7/7 passing sections for Phase 4.

---

## 4. First-Admin Bootstrap Procedure

To establish the first Administrator on an environment where no admin exists:

1. **User Sign-In:** The prospective administrator logs in once via Google OAuth to create an account record in `app_user` with the default `VIEWER` role.
2. **Direct DBA Role Grant:** Using local DBA credentials, execute the safe SQL assignment:
   ```sql
   INSERT INTO user_role (user_id, role_id)
   SELECT u.user_id, r.role_id
   FROM app_user u
   CROSS JOIN app_role r
   WHERE u.email = 'target_admin@example.com' AND r.role_name = 'ADMIN'
   ON DUPLICATE KEY UPDATE role_id = role_id;
   ```
3. **Verify Safely:** Run `npm run db:verify-admin` to confirm the account holds active `ADMIN` status.

---

## 5. Summary of Preserved Open Verification Items

The following items are preserved as open verification tasks:
1. **Historical Admin CUD Integration Tests:** End-to-end integration tests for historical seasons/episodes/sharks create, update, and delete routes.
2. **Admin-Review History Draft Migration:** Migration `004` remains draft; table `pitch_review_event` is not applied until reviewed.
3. **Clean-Database Bootstrap Test:** Execution of baseline initialization on a blank schema to confirm single-pass loading.
4. **Phase 4 Integration Suite in CI:** Re-run Phase 4 concurrency tests against a freshly created test database in CI.
