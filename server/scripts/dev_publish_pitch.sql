-- ============================================================================
-- DEV / DEMO ONLY - NOT part of the product.
-- ----------------------------------------------------------------------------
-- There is currently no admin review flow, so nothing moves a pitch from
-- SUBMITTED to PUBLISHED or REJECTED. Use this script on a LOCAL/TEST database
-- to simulate that review step so the founder -> investor flow can be tested.
-- OPEN QUESTION FOR THE TEAM: who publishes/rejects pitches in the real product?
--
-- Safety: only touches a PLATFORM pitch currently in SUBMITTED status.
-- Usage (MySQL Workbench / mysql client):
--   1. Set @pitch_id and choose ONE of the two UPDATE statements.
--   2. Run the SELECT at the end to confirm.
-- ============================================================================

SET @pitch_id = 0;   -- <-- put the pitch_id here

-- Option 1: publish
UPDATE pitch
SET pitch_status = 'PUBLISHED'
WHERE pitch_id = @pitch_id
  AND pitch_type = 'PLATFORM'
  AND pitch_status = 'SUBMITTED';

-- Option 2: reject (comment out Option 1 and uncomment this)
-- UPDATE pitch
-- SET pitch_status = 'REJECTED'
-- WHERE pitch_id = @pitch_id
--   AND pitch_type = 'PLATFORM'
--   AND pitch_status = 'SUBMITTED';

SELECT pitch_id, pitch_type, pitch_status, submitted_by_user_id
FROM pitch
WHERE pitch_id = @pitch_id;
