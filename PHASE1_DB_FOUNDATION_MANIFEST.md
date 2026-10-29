# Sauda Phase 1 — Database foundation and test reliability

This bundle contains changed files only. Copy/overlay these paths onto the Sauda repository root. No frontend files, environment secrets, live database values, or migration application are included.

## Included paths

- `server/scripts/db/create_test_db.ts` — validates `BASELINE_INFO.json` and migration claims before loading the baseline; creates tracking metadata after schema files are loaded; records included migrations as `BASELINED` with the migration file checksum.
- `server/scripts/db/baseline.test.ts` — regression test proving the real baseline metadata marks migration `001` and the planner does not schedule it for reapplication.
- `server/src/test_workspaces_security.ts` — disposable database/API guards, test-only industry/stage fixtures with dynamic IDs, repeatable cleanup of the suite's pitch and dependent rows, and concurrency assertions. Investor withdrawal is intentionally not tested in this Phase 1 bundle because it belongs to a later lifecycle phase.
- `server/package.json` — makes `npm test` run Phase 1 tooling checks; adds explicit `test:phase1` and guarded `test:integration:workspaces` scripts.
- `server/scripts/db/TEST_DATABASE_SETUP.md` — setup, tracking, fixture, and integration-test safety instructions.

## Safety boundaries

- The loader operates only on the configured test target after `assertDisposableTestTarget` succeeds and the target is confirmed empty.
- It never creates or drops databases.
- The bundle does not seed guessed real industry/stage names into the official baseline.
- Draft migration `004` is not applied or promoted.
- `server/.env` is not included or modified.
- Frontend implementation files are not included.

## Apply and verify

1. Back up any local modifications to the listed files.
2. Overlay the archive paths onto the repository root.
3. Review with `git diff --stat` and `git diff --check`.
4. Run `cd server && npm run test:phase1`.
5. Follow the documented empty disposable database setup only if you need to validate the real loader. Never drop an existing schema just to make the test pass.

The static tests establish migration-planning behaviour but do not replace a fresh-database integration check. Run that check against a newly provisioned disposable database with the correct local credentials.
