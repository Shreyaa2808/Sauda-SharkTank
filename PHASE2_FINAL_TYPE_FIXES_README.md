# Sauda Phase 2 — Final TypeScript corrections

This is a narrowly scoped correction overlay for the last two TypeScript errors reported by the local Mac build.

## Files
- `server/src/auth.ts`: make the optional phone bind value explicitly `null` when absent, so the mysql2 execute bind array does not contain `undefined`.
- `server/src/index.ts`: narrow the watchlist result by checking for the success-only `saved` property before reading it; the other branch is the structured error result.

No frontend files, environment files, migrations, database contents, or generated build outputs are included.

## Apply
Back up these two files first, then extract this ZIP into the repository root. It replaces only the two listed files.

From `~/SharkTankDBMS/server`, run:

```bash
npm run typecheck
npm run typecheck:scripts
npm run build
```

Then run the Phase 1, admin-review unit, and historical CSV tests. Do not commit or push unless typecheck and build both pass.
