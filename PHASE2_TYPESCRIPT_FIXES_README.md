# Sauda Phase 2 — TypeScript Error Fixes

This is a small corrective overlay for the Phase 2 bundle. It replaces only five non-frontend source files implicated by the TypeScript diagnostics reported after applying the earlier Phase 2 package.

## Included files

- `server/src/adminReview.integration.test.ts` — removes assertion-based narrowing that made the invalid-input branch type `never`; the runtime guard still throws if a fixture is invalid.
- `server/src/auth.ts` — splits the conditional profile-update SQL into two statically typed query branches for mysql2.
- `server/src/historical.ts` — types validated SQL bind values, narrows deal status and handshake time before binding, and fixes the reported dynamic query overload diagnostics.
- `server/src/index.ts` — narrows the watchlist result via its discriminated `success: false` branch.
- `server/src/workspaces.ts` — includes the `withdrawConnectionRequest` service export expected by `index.ts`. Replace this and `index.ts` together so the import/export set stays consistent.

No frontend files, `.env`, database credentials, migrations, node_modules, or build output are included.

## Apply on macOS

From Terminal, first back up the five target files, then unzip this archive into the repository root, allowing these five files to be replaced:

```bash
cd ~/SharkTankDBMS
BACKUP="$HOME/Desktop/sauda-phase2-ts-fixes-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/server/src"
for f in adminReview.integration.test.ts auth.ts historical.ts index.ts workspaces.ts; do
  cp "server/src/$f" "$BACKUP/server/src/$f"
done
# If the archive is in Downloads:
unzip -o "$HOME/Downloads/Sauda-Phase2-TypeScript-Fixes.zip" -d "$HOME/SharkTankDBMS"
```

Then run from `server/`:

```bash
npm run typecheck
npm run build
npm run test:admin-review
npm run test:historical-csv
```

Do not commit or push until `npm run typecheck` and `npm run build` pass locally. Do not run DB-backed admin integration tests until migration `004` has been reviewed and applied only to a verified disposable `sauda_test_*` database.

## Validation performed while preparing this overlay

- Global TypeScript transpile/syntax sweep: 18 files, 0 syntax diagnostics.
- Pure database-tool, admin-review unit, and historical CSV tests were transpiled in an isolated copy and run with Node: 36 passed, 0 failed.
- A dependency-backed `npm run typecheck` / build could not be completed in this packaging environment because `npm ci` timed out and the resulting `node_modules` tree was incomplete. Please confirm the full check using the project's installed dependencies on your Mac.
