-- ============================================================================
-- Sauda — Shark Tank India DBMS Project
-- Phase D / Step 2: Platform authentication + connections + text messaging
-- Target: existing sharktank_db, MySQL Server 8.0.46
-- STATUS: DRAFT FOR REVIEW ONLY. THIS FILE HAS NOT BEEN EXECUTED.
--
-- IMPORTANT SAFETY NOTES
-- 1) Confirm the matching backup and complete the preflight in:
--    docs/phase-d-step-2-schema-gap-and-migration-plan.md
-- 2) Ownership decision confirmed for this project: for a PLATFORM pitch,
--    pitch.submitted_by_user_id is the authoritative listing owner. The owner
--    is the only ordinary founder/editor; existing requirements still allow
--    narrowly scoped Administrator moderation/correction and listing removal.
-- 3) This is a one-time migration, NOT idempotent. Do not run it twice.
-- 4) Do not run this file on a live database until explicitly reviewed/approved.
-- 5) MySQL DDL may implicitly commit; this is not one rollbackable transaction.
-- 6) No existing routines, triggers, business tables, or rows are dropped.
-- ============================================================================

USE sharktank_db;

-- ---------------------------------------------------------------------------
-- 1. Google identity support
-- ---------------------------------------------------------------------------
-- Google subject is an identifier only (not a client secret or access token).
-- It is nullable for users who do not use Google sign-in. The unique index
-- permits multiple NULL values but prevents a Google subject binding to two
-- platform accounts.
--
-- Password hash becomes nullable so a Google-only account is representable.
-- Separate CHECK constraints reject whitespace-only hashes and Google subjects,
-- and the auth-identifier CHECK prevents an account with neither credential.
-- Application code must still validate hashes and verify Google ID tokens server-side.

ALTER TABLE app_user
    MODIFY COLUMN password_hash VARCHAR(255) NULL,
    ADD COLUMN google_subject VARCHAR(255)
        CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL
        AFTER email,
    ADD CONSTRAINT uq_app_user_google_subject UNIQUE (google_subject),
    ADD CONSTRAINT chk_app_user_password_hash_nonblank
        CHECK (
            password_hash IS NULL
            OR NOT REGEXP_LIKE(password_hash, '^[[:space:]]*$')
        ),
    ADD CONSTRAINT chk_app_user_google_subject_nonblank
        CHECK (
            google_subject IS NULL
            OR NOT REGEXP_LIKE(google_subject, '^[[:space:]]*$')
        ),
    ADD CONSTRAINT chk_app_user_auth_identifier
        CHECK (
            (password_hash IS NOT NULL
                AND NOT REGEXP_LIKE(password_hash, '^[[:space:]]*$'))
            OR
            (google_subject IS NOT NULL
                AND NOT REGEXP_LIKE(google_subject, '^[[:space:]]*$'))
        );

-- ---------------------------------------------------------------------------
-- 2. Investor-to-founder connection requests
-- ---------------------------------------------------------------------------
-- One request concerns one specific PLATFORM pitch. The application MUST check
-- pitch_type='PLATFORM', pitch_status='PUBLISHED', and that
-- pitch.submitted_by_user_id = founder_user_id before accepting an insert.
-- The FKs below ensure the requester and receiver have the corresponding
-- registered profile, because founder.user_id and investor.user_id are UNIQUE.
--
-- The active-pair generated keys are non-NULL only for PENDING / ACCEPTED.
-- Their unique index blocks a second active request for the same pair, even
-- when the second request targets another listing. Non-active historical rows
-- yield NULL key values, and MySQL permits multiple NULL values in a UNIQUE key.

CREATE TABLE connection_request (
    request_id BIGINT NOT NULL AUTO_INCREMENT,
    pitch_id BIGINT NOT NULL,
    investor_user_id BIGINT NOT NULL,
    founder_user_id BIGINT NOT NULL,

    request_status ENUM(
        'PENDING',
        'ACCEPTED',
        'DECLINED',
        'WITHDRAWN',
        'ENDED'
    ) NOT NULL DEFAULT 'PENDING',

    initial_message TEXT NULL,
    status_reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    -- responded_at: founder accepted/declined; retained after an accepted connection ends.
    -- withdrawn_at: pending request withdrawn by investor or system.
    -- ended_at: accepted connection ended by either party or listing archive.
    responded_at TIMESTAMP NULL,
    withdrawn_at TIMESTAMP NULL,
    ended_at TIMESTAMP NULL,

    active_investor_user_id BIGINT
        GENERATED ALWAYS AS (
            CASE
                WHEN request_status IN ('PENDING', 'ACCEPTED')
                    THEN investor_user_id
                ELSE NULL
            END
        ) STORED,
    active_founder_user_id BIGINT
        GENERATED ALWAYS AS (
            CASE
                WHEN request_status IN ('PENDING', 'ACCEPTED')
                    THEN founder_user_id
                ELSE NULL
            END
        ) STORED,

    PRIMARY KEY (request_id),
    UNIQUE KEY uq_connection_request_active_pair (
        active_investor_user_id,
        active_founder_user_id
    ),
    KEY idx_connection_request_pitch_status (pitch_id, request_status),
    KEY idx_connection_request_founder_status (
        founder_user_id, request_status, created_at
    ),
    KEY idx_connection_request_investor_status (
        investor_user_id, request_status, created_at
    ),

    CONSTRAINT fk_connection_request_pitch
        FOREIGN KEY (pitch_id) REFERENCES pitch(pitch_id)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT fk_connection_request_investor_profile
        FOREIGN KEY (investor_user_id) REFERENCES investor(user_id)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT fk_connection_request_founder_profile
        FOREIGN KEY (founder_user_id) REFERENCES founder(user_id)
        ON UPDATE NO ACTION ON DELETE NO ACTION,

    CONSTRAINT chk_connection_request_distinct_parties
        CHECK (investor_user_id <> founder_user_id),
    CONSTRAINT chk_connection_request_timestamps
        CHECK (
            (request_status = 'PENDING'
                AND responded_at IS NULL
                AND withdrawn_at IS NULL
                AND ended_at IS NULL)
            OR
            (request_status = 'ACCEPTED'
                AND responded_at IS NOT NULL
                AND withdrawn_at IS NULL
                AND ended_at IS NULL)
            OR
            (request_status = 'DECLINED'
                AND responded_at IS NOT NULL
                AND withdrawn_at IS NULL
                AND ended_at IS NULL)
            OR
            (request_status = 'WITHDRAWN'
                AND responded_at IS NULL
                AND withdrawn_at IS NOT NULL
                AND ended_at IS NULL)
            OR
            (request_status = 'ENDED'
                AND responded_at IS NOT NULL
                AND withdrawn_at IS NULL
                AND ended_at IS NOT NULL)
        ),
    CONSTRAINT chk_connection_request_initial_message_nonblank
        CHECK (
            initial_message IS NULL
            OR NOT REGEXP_LIKE(initial_message, '^[[:space:]]*$')
        )
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3. One conversation per accepted connection request
-- ---------------------------------------------------------------------------
-- The application should create a conversation only when accepting a pending
-- request, in the same transaction as the status change. UNIQUE(request_id)
-- prevents multiple conversations for the same request. No CASCADE is used:
-- private message history must not disappear from a delete operation.

CREATE TABLE conversation (
    conversation_id BIGINT NOT NULL AUTO_INCREMENT,
    request_id BIGINT NOT NULL,
    conversation_status ENUM('OPEN', 'READ_ONLY') NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,

    PRIMARY KEY (conversation_id),
    UNIQUE KEY uq_conversation_request (request_id),
    KEY idx_conversation_status (conversation_status, created_at),

    CONSTRAINT fk_conversation_request
        FOREIGN KEY (request_id) REFERENCES connection_request(request_id)
        ON UPDATE NO ACTION ON DELETE NO ACTION,

    CONSTRAINT chk_conversation_closed_timestamp
        CHECK (
            (conversation_status = 'OPEN' AND closed_at IS NULL)
            OR
            (conversation_status = 'READ_ONLY' AND closed_at IS NOT NULL)
        )
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 4. Text-only conversation messages
-- ---------------------------------------------------------------------------
-- Application authorization must check that the current user is the investor
-- or founder on the request related to this conversation. Admin status alone
-- must never grant access to message bodies. If a conversation is READ_ONLY,
-- message inserts must be rejected by the application. No attachments or
-- realtime-delivery state are part of this migration.

CREATE TABLE message (
    message_id BIGINT NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    sender_user_id BIGINT NOT NULL,
    message_body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (message_id),
    KEY idx_message_conversation_time (
        conversation_id, created_at, message_id
    ),
    KEY idx_message_sender_time (sender_user_id, created_at),

    CONSTRAINT fk_message_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversation(conversation_id)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT fk_message_sender
        FOREIGN KEY (sender_user_id) REFERENCES app_user(user_id)
        ON UPDATE NO ACTION ON DELETE NO ACTION,

    CONSTRAINT chk_message_nonempty_body
        CHECK (NOT REGEXP_LIKE(message_body, '^[[:space:]]*$'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- END OF DRAFT MIGRATION
-- ---------------------------------------------------------------------------
-- This file deliberately does not:
--   * create or modify the existing Viewer/Founder/Investor/Admin role rows;
--   * change pitch_interest;
--   * alter pitch/company/founder/investor rows or demo content;
--   * change or drop any existing trigger, routine, index, or table;
--   * implement the application transactions for accept/decline/withdraw/end/archive;
--   * archive listings or update requests automatically;
--   * delete any user, listing, request, conversation, or message.
--
-- After explicit approval and execution, inspect each new table with SHOW CREATE
-- TABLE, confirm original rows/objects are unchanged, and run behavior tests in
-- a disposable test database before connecting backend routes to these tables.
