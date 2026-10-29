# Sauda Phase 1 — security & privacy hardening (changed files only)

Extract over the project root; paths are preserved.

| File | Change |
|---|---|
| server/src/auth.ts | Removed hardcoded session-secret fallback; added `assertSessionSecretConfigured()` (exists, >=32 chars, not placeholder, enough variety; error never prints secret). VIEWER role looked up by name *before* insert; missing/invalid role => rollback-safe 500 `SERVER_CONFIGURATION_ERROR` (no `|| 1`). |
| server/src/index.ts | Fails closed at startup if secret invalid; `express.json({limit:'100kb'})`; error handler (413 / 400 invalid JSON); safe `req.body?.` access; conversation ID validation. |
| server/src/workspaces.ts | Removed investor/founder/counterpart emails from all three SQL result sets and types; bounded/type-checked intro (1000) and chat (2000) messages -> 400 `MESSAGE_TOO_LONG` / `INVALID_MESSAGE` / `EMPTY_MESSAGE`. |
| server/.env.example | `AUTH_SESSION_SECRET` now blank with generation instructions (your `.env` untouched). |
| client/src/types/workspace.ts | Removed email fields. |
| client/src/components/connections/ConnectionsHub.tsx / .css | Emails removed from UI; list items keyboard-operable (role=button, tabIndex, Enter/Space, aria-pressed) with visible focus; factual header copy. |
| client/src/components/settings/AccountSettingsPage.tsx | Accurate HttpOnly and fixed 7-day expiry wording; removed "verified founders / accredited investors" claims. |
| client/src/components/investor/InvestorWorkspace.tsx | "verified connection proposal" -> "connection proposal". |

No schema changes. IMPORTANT: set a real `AUTH_SESSION_SECRET` in server/.env before starting the server (existing placeholder values will now be rejected).
