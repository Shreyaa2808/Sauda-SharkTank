-- Migration tracking table. Created automatically (CREATE TABLE IF NOT EXISTS) by
-- server/scripts/db/migrate.ts the first time it is run with --apply or --mark-applied.
-- Safe to run by hand as well. It never touches any other table.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version         VARCHAR(16)  NOT NULL,
    filename        VARCHAR(255) NOT NULL,
    checksum_sha256 CHAR(64)     NOT NULL,
    -- APPLYING  : runner started this file and has not recorded success. Treat as a possible
    --             PARTIAL APPLY: inspect the schema by hand before doing anything else.
    -- APPLIED   : runner executed the file successfully.
    -- BASELINED : recorded as already present (applied by hand earlier, or included in a baseline).
    status          ENUM('APPLYING', 'APPLIED', 'BASELINED') NOT NULL,
    started_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_at      TIMESTAMP    NULL,
    applied_by      VARCHAR(128) NULL,
    PRIMARY KEY (version)
) ENGINE=InnoDB;
