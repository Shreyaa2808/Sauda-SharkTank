-- ============================================================================
-- Sauda — Shark Tank India DBMS Project
-- Phase D / Step 3: User Saved Pitch (Watchlist) Schema Migration
-- Target: existing sharktank_db, MySQL Server 8.0.46
-- STATUS: DRAFT FOR REVIEW ONLY
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_saved_pitch (
    user_id BIGINT NOT NULL,
    pitch_id BIGINT NOT NULL,
    saved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, pitch_id),
    UNIQUE KEY unique_user_pitch (user_id, pitch_id),
    KEY idx_user_saved_pitch_user (user_id, saved_at),
    KEY idx_user_saved_pitch_pitch (pitch_id),

    CONSTRAINT fk_user_saved_pitch_user
        FOREIGN KEY (user_id) REFERENCES app_user(user_id)
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT fk_user_saved_pitch_pitch
        FOREIGN KEY (pitch_id) REFERENCES pitch(pitch_id)
        ON UPDATE NO ACTION ON DELETE CASCADE
) ENGINE=InnoDB;
