# Safe test database setup patch

## Files
- `server/scripts/db/create_test_db.ts` — changed to load a baseline only into an already-created, empty test database. It never creates or drops databases and refuses `--recreate`.
- `server/scripts/db/TEST_DATABASE_SETUP.md` — documents one-time administrator provisioning and safe use.

## Safety
- Does not read or modify `.env` files.
- Does not connect to MySQL during packaging or validation.
- Does not execute SQL or create/drop databases.
- The test account can be granted privileges only on `sauda_test_local`.*, avoiding global database-create/drop permissions.

## Verification
- Static source inspection and ZIP integrity checked.
- No MySQL runtime test performed here. After merging, run server typecheck and database-tool tests.
