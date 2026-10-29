-- STATUS: DRAFT
-- Sauda Phase 3: Admin pitch review history.
-- DO NOT APPLY until this migration is reviewed against the actual target schema,
-- a backup exists, and the team explicitly approves it.
--
-- Prerequisites verified in the supplied test-clone schema export:
--   * pitch.pitch_id is BIGINT primary key
--   * app_user.user_id is BIGINT primary key
--   * pitch.pitch_status already supports SUBMITTED/PUBLISHED/REJECTED
--   * pitch.pitch_type separates PLATFORM from immutable SHOW records
--
-- This migration adds an append-only decision history table only. It intentionally
-- does not ALTER pitch or depend on draft migration 002. Existing history is kept
-- when a rejected pitch is edited and resubmitted; each later decision adds an event.
-- Rejection-note length is also enforced by the backend; this CHECK is a second line
-- of defence on MySQL 8.0.16+.

CREATE TABLE pitch_review_event (
  review_event_id BIGINT NOT NULL AUTO_INCREMENT,
  pitch_id BIGINT NOT NULL,
  reviewer_user_id BIGINT NOT NULL,
  decision ENUM('PUBLISH', 'REJECT') NOT NULL,
  review_note VARCHAR(2000) NULL,
  decided_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_event_id),
  KEY idx_pitch_review_event_pitch_time (pitch_id, decided_at, review_event_id),
  KEY idx_pitch_review_event_reviewer_time (reviewer_user_id, decided_at),
  CONSTRAINT fk_pitch_review_event_pitch
    FOREIGN KEY (pitch_id) REFERENCES pitch (pitch_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_pitch_review_event_reviewer
    FOREIGN KEY (reviewer_user_id) REFERENCES app_user (user_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_pitch_review_reject_note
    CHECK (decision <> 'REJECT' OR (review_note IS NOT NULL AND CHAR_LENGTH(TRIM(review_note)) >= 10)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Rollback only before review events are recorded. Do not drop this table after use
-- without a reviewed archival plan because it stores moderation history.
-- DROP TABLE pitch_review_event;
