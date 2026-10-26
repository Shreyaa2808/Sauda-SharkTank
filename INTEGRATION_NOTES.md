# Person 1 — Platform Integration & Role-Based Navigation

## Files changed
- `client/src/App.tsx` — route table, guards, role-aware nav, workspace switch button, login-resume
- `client/src/components/workspace/WorkspaceGate.tsx` — NEW, shared sign-in / access-denied / activation panel
- `client/src/components/workspace/WorkspaceChooserModal.tsx` — Escape to close, Tab focus trap, focus restored to opener
- `client/src/components/auth/AccountMenu.tsx` — shows all assigned roles
- `client/src/services/auth.ts` — `checkSession` times out after 10s (treated as signed out) so a hung API never leaves the loader up

No server files, migrations, DB config or env files were touched.

## Routes
`/` discovery · `/login` · `/profile` · `/settings` · `/founder` · `/investor` · `/connections`
(History API, no new router; unknown paths fall back to discovery.)

## Authorization model
- Identity and roles come only from `GET /api/auth/me` (server-verified cookie).
- Guard is derived at render time: signed-out + protected route -> `/login` (history `replace`, so Back never loops); signed-in + `/login` -> `/`.
- Workspace routes re-verify roles with `/api/auth/me` on entry, so stale client roles never decide access.
- Role activation goes through `POST /api/user/roles/activate`; ADMIN is rejected server-side. Client never sets roles itself.
- Client gating is UX only; every workspace endpoint is still enforced by `requireAuthAndRole` on the backend.

## Remaining items for Person 2 / Person 3
1. `user_saved_pitch` is used by `server/src/workspaces.ts` (watchlist, investor dashboard/pitches) but is not defined in `database/migrations/001_*.sql`. Not fixed here (out of scope). Investor endpoints will fail if the table is absent in the target DB.
2. Workspace components should handle 401/403 from their own API calls (show the gate/re-login) — shell only re-verifies on route entry.
3. `POST /api/connections/:id/respond` is FOUNDER-only; the Connections hub UI should only offer Accept/Decline to founders.
4. `server/src/test_workspaces_security.ts` mutates DB rows — do not run against `sharktank_db`.
