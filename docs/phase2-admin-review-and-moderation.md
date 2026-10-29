# Phase 2 — Admin Review and Moderation

This phase contains the admin pitch-review API, moderation-safe listing correction/archive routes, admin role management, and database integration-test coverage. The draft migration `004_admin_pitch_review_DRAFT.sql` remains a draft until the team completes the authoritative schema preflight and explicitly approves promotion.

## Included backend routes

- `GET /api/admin/reviews`
- `GET /api/admin/reviews/:pitchId`
- `POST /api/admin/reviews/:pitchId/decision`
- `GET /api/founder/pitches/:pitchId/review-history`
- `PUT /api/admin/platform-pitches/:pitchId`
- `POST /api/admin/platform-pitches/:pitchId/archive`
- `POST /api/admin/users/:userId/roles`

The API reloads roles from the database. Users cannot self-assign ADMIN. The last active ADMIN cannot be revoked. Historical `SHOW` pitches are not eligible for PLATFORM review or moderation edits.

## Safe verification sequence

1. Provision a new, empty local disposable schema matching `sauda_test_[a-z0-9_]+`, or use an existing schema that is verified disposable. Never repurpose the application database.
2. Configure `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD`, and `TEST_DB_NAME` in `server/.env`. The test database name must be different from `DB_NAME`.
3. Run Phase 1 checks:

   ```bash
   npm run test:phase1
   ```

4. Inspect the migration plan first:

   ```bash
   npm run db:migrate -- --target test
   ```

5. Review `database/migrations/004_admin_pitch_review_DRAFT.sql`, confirm the isolated database and backup strategy, then apply pending migrations to the test target only:

   ```bash
   SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:migrate -- --target test --apply
   ```

   The runner permits a draft migration on the explicit `test` target; it refuses draft migrations on `main`. Do not rename or remove the `DRAFT` marker merely to make the command work.

6. Run the unit suite:

   ```bash
   npm run test:admin-review
   ```

7. Run DB-backed tests only after the migration is recorded `APPLIED`. On macOS/Linux, map the test DB variables to the application pool variables for this process:

   ```bash
   set -a
   . ./.env
   set +a

   SAUDA_RUN_ADMIN_REVIEW_INTEGRATION=1 \
   DB_HOST="$TEST_DB_HOST" \
   DB_PORT="$TEST_DB_PORT" \
   DB_USER="$TEST_DB_USER" \
   DB_PASSWORD="$TEST_DB_PASSWORD" \
   DB_NAME="$TEST_DB_NAME" \
   npm run test:integration:admin-review
   ```

The DB-backed suite refuses to run unless the opt-in is present, the database name matches `sauda_test_*`, the host is local, and migration `004` is tracked as `APPLIED`. It creates uniquely named fixture users/companies/pitches and deletes only those fixture rows in cleanup.

## Promotion gate

Do not apply this migration to `sharktank_db` or infer its correctness from the schema clone. First run the repository's read-only preflight against the explicitly designated authoritative system-of-record database, review its output and backup, validate the migration against an isolated copy, and receive explicit approval. Only then should the team consider removing the draft marker/suffix and committing it as reviewed.

## Remaining verification limits

The delivered source includes a real MySQL integration test for queue/detail/history, a publish event, rollback when the reviewer foreign key fails, and simultaneous publish/reject decisions. The bundle authoring environment did not have the project's dependencies installed or a MySQL instance available, so those database-backed assertions must be run in the target developer environment using the commands above.
