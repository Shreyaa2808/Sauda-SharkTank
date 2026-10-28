# Sauda Phase 2 — Non-Frontend Apply Guide

This ZIP is an **overlay bundle**, not a full repository archive. It contains selected backend, database migration, test, and documentation files only. It contains no frontend source, `.env`, `node_modules`, or build output.

## Before overlaying

Your working tree has other uncommitted changes. Back up the listed target files before extraction. Do not run `git restore`, `git reset`, `git clean`, or `git add .` as part of applying this bundle.

From Terminal on macOS, use the repo root:

```bash
cd ~/SharkTankDBMS

BACKUP="$HOME/Desktop/sauda-phase2-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
while IFS= read -r path; do
  [ -e "$path" ] || continue
  mkdir -p "$BACKUP/$(dirname "$path")"
  cp -R "$path" "$BACKUP/$path"
done <<'EOF'
PHASE2_NON_FRONTEND_MANIFEST.md
PHASE2_APPLY_GUIDE.md
PHASE3_MANIFEST.md
docs/admin-pitch-review-workflow.md
docs/phase2-admin-review-and-moderation.md
database/migrations/004_admin_pitch_review_DRAFT.sql
database/migrations/superseded.json
server/package.json
server/scripts/db/TEST_DATABASE_SETUP.md
server/scripts/db/baseline.test.ts
server/scripts/db/create_test_db.ts
server/src/adminReview.ts
server/src/adminReview.test.ts
server/src/adminReview.integration.test.ts
server/src/auth.ts
server/src/founder.ts
server/src/historical.ts
server/src/historicalCsv.ts
server/src/historicalCsv.test.ts
server/src/index.ts
server/src/roleProfiles.ts
server/src/test_workspaces_security.ts
server/src/workspaces.ts
EOF

echo "Backup created at: $BACKUP"
unzip -o ~/Downloads/Sauda-Phase2-Backend-Completion.zip -d ~/SharkTankDBMS
```

If the ZIP is saved under a different location, change the ZIP path only. Do not extract it into `client/` or into the parent directory above the repository root.

## Local checks (no DB migration required)

```bash
cd ~/SharkTankDBMS/server
npm run test:phase1
npm run test:admin-review
npm run test:historical-csv
npm run typecheck
npm run typecheck:scripts
npm run build
```

The first four commands plus `typecheck:scripts` and build should complete before attempting any DB-backed tests. If dependency installation is needed, use the existing `package-lock.json` (`npm ci`) and do not include `node_modules` in commits or ZIPs.

## Admin-review DB integration test

`database/migrations/004_admin_pitch_review_DRAFT.sql` remains a draft. The integration test refuses to run unless the configured DB is a local `sauda_test_*` database, migration `004` is tracked as `APPLIED`, and `SAUDA_RUN_ADMIN_REVIEW_INTEGRATION=1` is set.

1. Confirm `TEST_DB_*` points to a **verified disposable local database**, not `DB_NAME` or any authoritative/application database.
2. Inspect the plan first:

   ```bash
   npm run db:migrate -- --target test
   ```

3. Only after confirming the target is disposable and the draft SQL has been reviewed, apply it to that test target (never to the main/authoritative DB):

   ```bash
   SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:migrate -- --target test --apply
   ```

4. Then run the DB-backed test:

   ```bash
   set -a
   . ./.env
   set +a

   SAUDA_RUN_ADMIN_REVIEW_INTEGRATION=1    DB_HOST="$TEST_DB_HOST"    DB_PORT="$TEST_DB_PORT"    DB_USER="$TEST_DB_USER"    DB_PASSWORD="$TEST_DB_PASSWORD"    DB_NAME="$TEST_DB_NAME"    npm run test:integration:admin-review
   ```

Do not run the baseline loader against a populated schema; it explicitly requires a pre-created, empty disposable database. Do not apply migration `004` to `sharktank_db` or `sharktank_db_test_full_20261023`. Migration promotion requires a separate authoritative schema preflight, backup review, and explicit approval.

## Workspace integration suite

After overlaying the latest test safety guard, rerun the workspace integration suite against a dedicated local API port other than `4000`, mapping `TEST_DB_*` to `DB_*` for both the API process and test process. Keep your existing API server on port `4000` untouched. The test writes fixture users/pitches in the disposable schema, so run it only after that target is verified.

## Scope and verification boundary

This bundle includes the Phase 1 baseline-tracking repair plus Phase 2 admin review/moderation and selected non-frontend core API fixes. It is not approval to promote the draft migration or to claim verified historical Shark Tank data has been loaded. In the packaging environment, 18 backend TypeScript files passed syntax/transpile checks and 36 pure tests passed in an isolated runtime copy. Full typecheck/build and DB-backed integration tests must be run on the developer Mac with dependencies and a verified disposable MySQL database available.
