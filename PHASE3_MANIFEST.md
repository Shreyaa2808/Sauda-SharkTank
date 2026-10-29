# Sauda Phase 3 delivery manifest (non-frontend source reference)

## Included changes

### Backend
- `server/src/adminReview.ts` — input validation, role-access helper, review eligibility/state transition rules, queue/detail/history queries, transactional row-locked publish/reject service, and owner-only founder history lookup.
- `server/src/index.ts` — Admin-only review endpoints and Founder-owner review-history endpoint; shared role decision used by the request authorization guard.
- `server/src/adminReview.test.ts` — unit tests for anonymous/non-admin/admin access decisions, publish/reject validation, required rejection notes, invalid statuses, SHOW immutability, repeated-decision guard, and founder ownership policy.
- `server/package.json` — adds `test:admin-review`, `test:historical-csv`, guarded integration-test targets, `test:phase1`, and an aggregate `test:all` target used by the default `npm test`.

### Database/docs
- `database/migrations/004_admin_pitch_review_DRAFT.sql` — draft-only append-only review event table. It is not applied by this patch.
- `docs/admin-pitch-review-workflow.md` — state transitions, route descriptions, DB migration safety steps, and a documented manual first-ADMIN role-grant procedure for an existing authorized active account.

### Frontend
- `client/src/App.tsx` — protected `/admin/reviews` route.
- `client/src/components/admin/AdminReviewPage.tsx` and `.css` — responsive Admin queue, detail view, history, publish/reject actions, rejection-note validation, loading/error/empty/retry states.
- `client/src/components/navigation/NavDrawer.tsx` and `client/src/components/auth/AccountMenu.tsx` — Admin review navigation shown only when the server-provided session contains `ADMIN`.
- `client/src/components/founder/FounderWorkspace.tsx` and `.css` — owners can open review history for rejected/published pitches and edit/resubmit rejected pitches through the existing workflow.
- `client/src/services/workspace.ts` and `client/src/types/workspace.ts` — typed Founder review-history client.

## Safety
- No database was connected to or modified.
- No migration was applied. The new migration remains `DRAFT` pending review and explicit approval.
- No `.env`, credentials, seed business data, `node_modules`, or build outputs are included.
- Admin authorization is checked server-side; UI visibility is not used as security.

## Checks performed
- TypeScript/TSX syntax transpilation checks passed for the changed source files.
- 9 pure unit tests passed using the system TypeScript transpiler and Node's built-in test runner.
- CSS brace balance and ZIP integrity checked.
- Phase 6 Update (Historical Admin CRUD Integration Coverage): Administrative endpoints for Seasons, Episodes, and Sharks now have full database-backed integration coverage verified against `sauda_test_phase3` via `server/src/historicalAdmin.integration.test.ts` (5/5 passing sections). Direct MySQL insertions, updates, and deletions verified with exact-ID teardown.
- Phase 6 Update (Admin Review Prerequisite Guard): `server/src/adminReview.integration.test.ts` now explicitly guards against missing draft migration 004, skipping execution with an explicit prerequisite notification rather than failing with runtime schema exceptions.
