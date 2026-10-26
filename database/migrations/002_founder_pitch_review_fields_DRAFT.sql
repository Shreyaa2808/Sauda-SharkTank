-- ============================================================================
-- DRAFT ONLY - DO NOT RUN without review, a fresh backup, and team approval.
-- ----------------------------------------------------------------------------
-- Why: the pitch table appears to have only submitted_at, which is set at
-- creation. Consequences: the UI cannot tell "when was this last edited" from
-- "when was it created", and a REJECTED pitch has nowhere to store the reason.
--
-- FIRST run:  SHOW CREATE TABLE pitch;
-- and remove any column below that already exists. The server code in
-- founder.ts does NOT depend on these columns yet; they are optional.
-- ============================================================================

ALTER TABLE pitch
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN review_note VARCHAR(500) NULL;

-- Rollback (only if the columns were added by this script):
-- ALTER TABLE pitch DROP COLUMN review_note, DROP COLUMN updated_at;
