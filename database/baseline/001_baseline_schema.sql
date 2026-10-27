-- ============================================================================
-- Sauda baseline schema (schema only, NO data)
-- Source: mysqldump --no-data of database `sharktank_db_test_full_20261023`
--         (MySQL 8.0.46), dump completed 2026-10-27 14:08:52. This is a TEST CLONE of
--         the application database, not necessarily identical to `sharktank_db`.
-- Contains 41 tables = 38 original + connection_request, conversation, message (migration 001).
-- It ALREADY includes migration 001 and the pre-existing `user_saved_pitch` table.
-- It does NOT include migration 002 (pitch.updated_at / review_note).
-- NO triggers or routines are included because the supplied dump contains none
-- (see docs/phase-2-schema-reconciliation.md, section 6).
--
-- Differences from the raw dump (mechanical only; no structural change):
--   * removed DROP TABLE statements and dump session settings (this file never drops anything)
--   * removed clone-specific AUTO_INCREMENT=N table options
--   * tables ordered so every foreign key references a table created earlier
-- Load ONLY into an empty database. Do not run against an existing application database.
-- ============================================================================

CREATE TABLE `app_role` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(30) NOT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `app_user` (
  `user_id` bigint NOT NULL AUTO_INCREMENT,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(255) NOT NULL,
  `google_subject` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `phone_number` varchar(25) DEFAULT NULL,
  `account_status` enum('ACTIVE','SUSPENDED','DELETED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_app_user_google_subject` (`google_subject`),
  CONSTRAINT `chk_app_user_auth_identifier` CHECK ((((`password_hash` is not null) and (not(regexp_like(`password_hash`,_utf8mb4'^[[:space:]]*$')))) or ((`google_subject` is not null) and (not(regexp_like(`google_subject`,_utf8mb4'^[[:space:]]*$')))))),
  CONSTRAINT `chk_app_user_google_subject_nonblank` CHECK (((`google_subject` is null) or (not(regexp_like(`google_subject`,_utf8mb4'^[[:space:]]*$'))))),
  CONSTRAINT `chk_app_user_password_hash_nonblank` CHECK (((`password_hash` is null) or (not(regexp_like(`password_hash`,_utf8mb4'^[[:space:]]*$')))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `application_audit_log` (
  `audit_id` bigint NOT NULL AUTO_INCREMENT,
  `table_name` varchar(100) NOT NULL,
  `operation_type` varchar(10) NOT NULL,
  `record_id` bigint DEFAULT NULL,
  `old_data` json DEFAULT NULL,
  `new_data` json DEFAULT NULL,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `industry` (
  `industry_id` int NOT NULL AUTO_INCREMENT,
  `industry_name` varchar(100) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`industry_id`),
  UNIQUE KEY `industry_name` (`industry_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `show_season` (
  `season_id` bigint NOT NULL AUTO_INCREMENT,
  `season_number` int NOT NULL,
  `country_franchise` varchar(100) NOT NULL DEFAULT 'India',
  `premiere_date` date DEFAULT NULL,
  `finale_date` date DEFAULT NULL,
  `total_episodes` int DEFAULT NULL,
  `network_channel` varchar(150) DEFAULT NULL,
  `production_house` varchar(180) DEFAULT NULL,
  `budget_amount` decimal(18,2) DEFAULT NULL,
  PRIMARY KEY (`season_id`),
  UNIQUE KEY `country_franchise` (`country_franchise`,`season_number`),
  CONSTRAINT `show_season_chk_1` CHECK ((`season_number` > 0)),
  CONSTRAINT `show_season_chk_2` CHECK (((`total_episodes` is null) or (`total_episodes` >= 0))),
  CONSTRAINT `show_season_chk_3` CHECK (((`budget_amount` is null) or (`budget_amount` >= 0))),
  CONSTRAINT `show_season_chk_4` CHECK (((`premiere_date` is null) or (`finale_date` is null) or (`finale_date` >= `premiere_date`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `startup_stage` (
  `stage_id` int NOT NULL AUTO_INCREMENT,
  `stage_name` varchar(50) NOT NULL,
  PRIMARY KEY (`stage_id`),
  UNIQUE KEY `stage_name` (`stage_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `company` (
  `company_id` bigint NOT NULL AUTO_INCREMENT,
  `legal_business_name` varchar(200) DEFAULT NULL,
  `brand_name` varchar(150) NOT NULL,
  `industry_id` int NOT NULL,
  `stage_id` int DEFAULT NULL,
  `business_model` varchar(100) DEFAULT NULL,
  `website_url` varchar(500) DEFAULT NULL,
  `founded_year` smallint DEFAULT NULL,
  `headquarters_city` varchar(100) DEFAULT NULL,
  `headquarters_state` varchar(100) DEFAULT NULL,
  `headquarters_country` varchar(100) DEFAULT NULL,
  `employee_count` int DEFAULT NULL,
  `has_patents` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`company_id`),
  KEY `idx_company_stage` (`stage_id`),
  KEY `idx_company_industry` (`industry_id`),
  CONSTRAINT `company_ibfk_1` FOREIGN KEY (`industry_id`) REFERENCES `industry` (`industry_id`),
  CONSTRAINT `company_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `startup_stage` (`stage_id`),
  CONSTRAINT `company_chk_1` CHECK (((`founded_year` is null) or (`founded_year` between 1800 and 2100))),
  CONSTRAINT `company_chk_2` CHECK (((`employee_count` is null) or (`employee_count` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `founder` (
  `founder_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint DEFAULT NULL,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) DEFAULT NULL,
  `gender` varchar(30) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone_number` varchar(25) DEFAULT NULL,
  `highest_education` varchar(120) DEFAULT NULL,
  `prior_startups_count` int NOT NULL DEFAULT '0',
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`founder_id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `founder_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `founder_chk_1` CHECK ((`prior_startups_count` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `investor` (
  `investor_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint DEFAULT NULL,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) DEFAULT NULL,
  `display_name` varchar(150) DEFAULT NULL,
  `investment_firm_name` varchar(180) DEFAULT NULL,
  `net_worth` decimal(18,2) DEFAULT NULL,
  `primary_industry_id` int DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`investor_id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `primary_industry_id` (`primary_industry_id`),
  CONSTRAINT `investor_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `investor_ibfk_2` FOREIGN KEY (`primary_industry_id`) REFERENCES `industry` (`industry_id`),
  CONSTRAINT `investor_chk_1` CHECK (((`net_worth` is null) or (`net_worth` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `show_episode` (
  `episode_id` bigint NOT NULL AUTO_INCREMENT,
  `season_id` bigint NOT NULL,
  `episode_number` int NOT NULL,
  `episode_title` varchar(200) DEFAULT NULL,
  `tape_date` date DEFAULT NULL,
  `air_date` date DEFAULT NULL,
  `duration_minutes` int DEFAULT NULL,
  `tv_rating` decimal(8,3) DEFAULT NULL,
  `viewers_count_millions` decimal(12,3) DEFAULT NULL,
  `filming_location` varchar(200) DEFAULT NULL,
  `video_url` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`episode_id`),
  UNIQUE KEY `season_id` (`season_id`,`episode_number`),
  CONSTRAINT `show_episode_ibfk_1` FOREIGN KEY (`season_id`) REFERENCES `show_season` (`season_id`),
  CONSTRAINT `show_episode_chk_1` CHECK ((`episode_number` > 0)),
  CONSTRAINT `show_episode_chk_2` CHECK (((`duration_minutes` is null) or (`duration_minutes` > 0))),
  CONSTRAINT `show_episode_chk_3` CHECK (((`viewers_count_millions` is null) or (`viewers_count_millions` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `startup_battle` (
  `battle_id` bigint NOT NULL AUTO_INCREMENT,
  `created_by_user_id` bigint NOT NULL,
  `title` varchar(180) NOT NULL,
  `description` text,
  `battle_type` enum('STANDARD','BLIND_PITCH') NOT NULL DEFAULT 'STANDARD',
  `battle_status` enum('DRAFT','OPEN','CLOSED') NOT NULL DEFAULT 'DRAFT',
  `starts_at` datetime DEFAULT NULL,
  `ends_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`battle_id`),
  KEY `created_by_user_id` (`created_by_user_id`),
  CONSTRAINT `startup_battle_ibfk_1` FOREIGN KEY (`created_by_user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `startup_battle_chk_1` CHECK (((`starts_at` is null) or (`ends_at` is null) or (`ends_at` > `starts_at`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_role` (
  `user_id` bigint NOT NULL,
  `role_id` int NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `user_role_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `user_role_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `app_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `company_founder` (
  `company_id` bigint NOT NULL,
  `founder_id` bigint NOT NULL,
  `role_title` varchar(100) DEFAULT NULL,
  `equity_pct_pre_pitch` decimal(5,2) DEFAULT NULL,
  `is_primary_presenter` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`company_id`,`founder_id`),
  KEY `founder_id` (`founder_id`),
  CONSTRAINT `company_founder_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `company` (`company_id`),
  CONSTRAINT `company_founder_ibfk_2` FOREIGN KEY (`founder_id`) REFERENCES `founder` (`founder_id`),
  CONSTRAINT `company_founder_chk_1` CHECK (((`equity_pct_pre_pitch` is null) or (`equity_pct_pre_pitch` between 0 and 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `company_metric_snapshot` (
  `metric_snapshot_id` bigint NOT NULL AUTO_INCREMENT,
  `company_id` bigint NOT NULL,
  `as_of_date` date NOT NULL,
  `fiscal_year` smallint DEFAULT NULL,
  `lifetime_sales` decimal(18,2) DEFAULT NULL,
  `previous_year_revenue` decimal(18,2) DEFAULT NULL,
  `current_year_revenue` decimal(18,2) DEFAULT NULL,
  `current_debt` decimal(18,2) DEFAULT NULL,
  `monthly_cash_burn_rate` decimal(18,2) DEFAULT NULL,
  PRIMARY KEY (`metric_snapshot_id`),
  UNIQUE KEY `company_id` (`company_id`,`as_of_date`),
  UNIQUE KEY `company_id_2` (`company_id`,`metric_snapshot_id`),
  CONSTRAINT `company_metric_snapshot_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `company` (`company_id`),
  CONSTRAINT `company_metric_snapshot_chk_1` CHECK (((`lifetime_sales` is null) or (`lifetime_sales` >= 0))),
  CONSTRAINT `company_metric_snapshot_chk_2` CHECK (((`previous_year_revenue` is null) or (`previous_year_revenue` >= 0))),
  CONSTRAINT `company_metric_snapshot_chk_3` CHECK (((`current_year_revenue` is null) or (`current_year_revenue` >= 0))),
  CONSTRAINT `company_metric_snapshot_chk_4` CHECK (((`current_debt` is null) or (`current_debt` >= 0))),
  CONSTRAINT `company_metric_snapshot_chk_5` CHECK (((`monthly_cash_burn_rate` is null) or (`monthly_cash_burn_rate` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `investor_industry_preference` (
  `investor_id` bigint NOT NULL,
  `industry_id` int NOT NULL,
  `preference_weight` decimal(5,2) NOT NULL DEFAULT '1.00',
  PRIMARY KEY (`investor_id`,`industry_id`),
  KEY `industry_id` (`industry_id`),
  CONSTRAINT `investor_industry_preference_ibfk_1` FOREIGN KEY (`investor_id`) REFERENCES `investor` (`investor_id`),
  CONSTRAINT `investor_industry_preference_ibfk_2` FOREIGN KEY (`industry_id`) REFERENCES `industry` (`industry_id`),
  CONSTRAINT `investor_industry_preference_chk_1` CHECK ((`preference_weight` between 0 and 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `investor_profile` (
  `investor_id` bigint NOT NULL,
  `biography` text,
  `min_investment_amount` decimal(15,2) DEFAULT NULL,
  `max_investment_amount` decimal(15,2) DEFAULT NULL,
  `is_accepting_pitches` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`investor_id`),
  CONSTRAINT `investor_profile_ibfk_1` FOREIGN KEY (`investor_id`) REFERENCES `investor` (`investor_id`),
  CONSTRAINT `investor_profile_chk_1` CHECK (((`min_investment_amount` is null) or (`min_investment_amount` >= 0))),
  CONSTRAINT `investor_profile_chk_2` CHECK (((`max_investment_amount` is null) or (`max_investment_amount` >= 0))),
  CONSTRAINT `investor_profile_chk_3` CHECK (((`min_investment_amount` is null) or (`max_investment_amount` is null) or (`min_investment_amount` <= `max_investment_amount`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `investor_stage_preference` (
  `investor_id` bigint NOT NULL,
  `stage_id` int NOT NULL,
  PRIMARY KEY (`investor_id`,`stage_id`),
  KEY `stage_id` (`stage_id`),
  CONSTRAINT `investor_stage_preference_ibfk_1` FOREIGN KEY (`investor_id`) REFERENCES `investor` (`investor_id`),
  CONSTRAINT `investor_stage_preference_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `startup_stage` (`stage_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `shark` (
  `shark_id` bigint NOT NULL AUTO_INCREMENT,
  `investor_id` bigint NOT NULL,
  `stage_name` varchar(150) DEFAULT NULL,
  `gender` varchar(30) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `is_guest_shark` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`shark_id`),
  UNIQUE KEY `investor_id` (`investor_id`),
  CONSTRAINT `shark_ibfk_1` FOREIGN KEY (`investor_id`) REFERENCES `investor` (`investor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_watchlist` (
  `user_id` bigint NOT NULL,
  `company_id` bigint NOT NULL,
  `added_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`company_id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `user_watchlist_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `user_watchlist_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `episode_shark_seat` (
  `episode_id` bigint NOT NULL,
  `shark_id` bigint NOT NULL,
  `chair_position_number` int NOT NULL,
  PRIMARY KEY (`episode_id`,`shark_id`),
  UNIQUE KEY `episode_id` (`episode_id`,`chair_position_number`),
  KEY `shark_id` (`shark_id`),
  CONSTRAINT `episode_shark_seat_ibfk_1` FOREIGN KEY (`episode_id`) REFERENCES `show_episode` (`episode_id`),
  CONSTRAINT `episode_shark_seat_ibfk_2` FOREIGN KEY (`shark_id`) REFERENCES `shark` (`shark_id`),
  CONSTRAINT `episode_shark_seat_chk_1` CHECK ((`chair_position_number` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pitch` (
  `pitch_id` bigint NOT NULL AUTO_INCREMENT,
  `company_id` bigint NOT NULL,
  `financial_snapshot_id` bigint DEFAULT NULL,
  `pitch_type` enum('SHOW','PLATFORM') NOT NULL,
  `episode_id` bigint DEFAULT NULL,
  `submitted_by_user_id` bigint DEFAULT NULL,
  `pitch_sequence_order` int DEFAULT NULL,
  `original_ask_amount` decimal(18,2) DEFAULT NULL,
  `original_ask_equity_pct` decimal(5,2) DEFAULT NULL,
  `recorded_duration_minutes` decimal(8,2) DEFAULT NULL,
  `aired_duration_minutes` decimal(8,2) DEFAULT NULL,
  `pitch_hook` text,
  `cried_on_set` tinyint(1) DEFAULT NULL,
  `has_demo_stunt` tinyint(1) DEFAULT NULL,
  `pitch_status` enum('DRAFT','SUBMITTED','PUBLISHED','REJECTED','ARCHIVED') NOT NULL DEFAULT 'SUBMITTED',
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pitch_id`),
  UNIQUE KEY `company_id_2` (`company_id`,`pitch_id`),
  UNIQUE KEY `episode_id` (`episode_id`,`pitch_sequence_order`),
  KEY `submitted_by_user_id` (`submitted_by_user_id`),
  KEY `company_id` (`company_id`,`financial_snapshot_id`),
  KEY `idx_pitch_type_status` (`pitch_type`,`pitch_status`),
  KEY `idx_pitch_episode` (`episode_id`),
  CONSTRAINT `pitch_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `company` (`company_id`),
  CONSTRAINT `pitch_ibfk_2` FOREIGN KEY (`episode_id`) REFERENCES `show_episode` (`episode_id`),
  CONSTRAINT `pitch_ibfk_3` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `pitch_ibfk_4` FOREIGN KEY (`company_id`, `financial_snapshot_id`) REFERENCES `company_metric_snapshot` (`company_id`, `metric_snapshot_id`),
  CONSTRAINT `pitch_chk_1` CHECK (((`original_ask_amount` is null) or (`original_ask_amount` >= 0))),
  CONSTRAINT `pitch_chk_2` CHECK (((`original_ask_equity_pct` is null) or (`original_ask_equity_pct` between 0.01 and 100))),
  CONSTRAINT `pitch_chk_3` CHECK (((`recorded_duration_minutes` is null) or (`recorded_duration_minutes` >= 0))),
  CONSTRAINT `pitch_chk_4` CHECK (((`aired_duration_minutes` is null) or (`aired_duration_minutes` >= 0))),
  CONSTRAINT `pitch_chk_5` CHECK ((((`pitch_type` = _utf8mb4'SHOW') and (`episode_id` is not null) and (`submitted_by_user_id` is null)) or ((`pitch_type` = _utf8mb4'PLATFORM') and (`episode_id` is null) and (`submitted_by_user_id` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_follow_shark` (
  `user_id` bigint NOT NULL,
  `shark_id` bigint NOT NULL,
  `followed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`shark_id`),
  KEY `shark_id` (`shark_id`),
  CONSTRAINT `user_follow_shark_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `user_follow_shark_ibfk_2` FOREIGN KEY (`shark_id`) REFERENCES `shark` (`shark_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `battle_entry` (
  `battle_id` bigint NOT NULL,
  `pitch_id` bigint NOT NULL,
  `entry_alias` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`battle_id`,`pitch_id`),
  UNIQUE KEY `battle_id` (`battle_id`,`entry_alias`),
  KEY `pitch_id` (`pitch_id`),
  CONSTRAINT `battle_entry_ibfk_1` FOREIGN KEY (`battle_id`) REFERENCES `startup_battle` (`battle_id`),
  CONSTRAINT `battle_entry_ibfk_2` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `company_performance_snapshot` (
  `performance_id` bigint NOT NULL AUTO_INCREMENT,
  `company_id` bigint NOT NULL,
  `pitch_id` bigint DEFAULT NULL,
  `observed_on` date NOT NULL,
  `website_crashed_on_air` tinyint(1) DEFAULT NULL,
  `traffic_spike_first_24h` bigint DEFAULT NULL,
  `revenue_first_48h` decimal(18,2) DEFAULT NULL,
  `revenue_first_30d` decimal(18,2) DEFAULT NULL,
  `amazon_rank_peak` int DEFAULT NULL,
  `is_company_active` tinyint(1) DEFAULT NULL,
  `exit_type` varchar(100) DEFAULT NULL,
  `exit_valuation` decimal(18,2) DEFAULT NULL,
  PRIMARY KEY (`performance_id`),
  UNIQUE KEY `company_id_2` (`company_id`,`observed_on`),
  KEY `company_id` (`company_id`,`pitch_id`),
  KEY `idx_performance_company_date` (`company_id`,`observed_on`),
  CONSTRAINT `company_performance_snapshot_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `company` (`company_id`),
  CONSTRAINT `company_performance_snapshot_ibfk_2` FOREIGN KEY (`company_id`, `pitch_id`) REFERENCES `pitch` (`company_id`, `pitch_id`),
  CONSTRAINT `company_performance_snapshot_chk_1` CHECK (((`traffic_spike_first_24h` is null) or (`traffic_spike_first_24h` >= 0))),
  CONSTRAINT `company_performance_snapshot_chk_2` CHECK (((`revenue_first_48h` is null) or (`revenue_first_48h` >= 0))),
  CONSTRAINT `company_performance_snapshot_chk_3` CHECK (((`revenue_first_30d` is null) or (`revenue_first_30d` >= 0))),
  CONSTRAINT `company_performance_snapshot_chk_4` CHECK (((`amazon_rank_peak` is null) or (`amazon_rank_peak` > 0))),
  CONSTRAINT `company_performance_snapshot_chk_5` CHECK (((`exit_valuation` is null) or (`exit_valuation` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `connection_request` (
  `request_id` bigint NOT NULL AUTO_INCREMENT,
  `pitch_id` bigint NOT NULL,
  `investor_user_id` bigint NOT NULL,
  `founder_user_id` bigint NOT NULL,
  `request_status` enum('PENDING','ACCEPTED','DECLINED','WITHDRAWN','ENDED') NOT NULL DEFAULT 'PENDING',
  `initial_message` text,
  `status_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `responded_at` timestamp NULL DEFAULT NULL,
  `withdrawn_at` timestamp NULL DEFAULT NULL,
  `ended_at` timestamp NULL DEFAULT NULL,
  `active_investor_user_id` bigint GENERATED ALWAYS AS ((case when (`request_status` in (_utf8mb4'PENDING',_utf8mb4'ACCEPTED')) then `investor_user_id` else NULL end)) STORED,
  `active_founder_user_id` bigint GENERATED ALWAYS AS ((case when (`request_status` in (_utf8mb4'PENDING',_utf8mb4'ACCEPTED')) then `founder_user_id` else NULL end)) STORED,
  PRIMARY KEY (`request_id`),
  UNIQUE KEY `uq_connection_request_active_pair` (`active_investor_user_id`,`active_founder_user_id`),
  KEY `idx_connection_request_pitch_status` (`pitch_id`,`request_status`),
  KEY `idx_connection_request_founder_status` (`founder_user_id`,`request_status`,`created_at`),
  KEY `idx_connection_request_investor_status` (`investor_user_id`,`request_status`,`created_at`),
  CONSTRAINT `fk_connection_request_founder_profile` FOREIGN KEY (`founder_user_id`) REFERENCES `founder` (`user_id`),
  CONSTRAINT `fk_connection_request_investor_profile` FOREIGN KEY (`investor_user_id`) REFERENCES `investor` (`user_id`),
  CONSTRAINT `fk_connection_request_pitch` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`),
  CONSTRAINT `chk_connection_request_distinct_parties` CHECK ((`investor_user_id` <> `founder_user_id`)),
  CONSTRAINT `chk_connection_request_initial_message_nonblank` CHECK (((`initial_message` is null) or (not(regexp_like(`initial_message`,_utf8mb4'^[[:space:]]*$'))))),
  CONSTRAINT `chk_connection_request_timestamps` CHECK ((((`request_status` = _utf8mb4'PENDING') and (`responded_at` is null) and (`withdrawn_at` is null) and (`ended_at` is null)) or ((`request_status` = _utf8mb4'ACCEPTED') and (`responded_at` is not null) and (`withdrawn_at` is null) and (`ended_at` is null)) or ((`request_status` = _utf8mb4'DECLINED') and (`responded_at` is not null) and (`withdrawn_at` is null) and (`ended_at` is null)) or ((`request_status` = _utf8mb4'WITHDRAWN') and (`responded_at` is null) and (`withdrawn_at` is not null) and (`ended_at` is null)) or ((`request_status` = _utf8mb4'ENDED') and (`responded_at` is not null) and (`withdrawn_at` is null) and (`ended_at` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `offer` (
  `offer_id` bigint NOT NULL AUTO_INCREMENT,
  `pitch_id` bigint NOT NULL,
  `round_number` int NOT NULL,
  `is_counter_offer` tinyint(1) NOT NULL DEFAULT '0',
  `created_by_founder_id` bigint DEFAULT NULL,
  `created_by_investor_id` bigint DEFAULT NULL,
  `amount_offered` decimal(18,2) DEFAULT NULL,
  `equity_requested_pct` decimal(5,2) DEFAULT NULL,
  `royalty_per_unit` decimal(15,2) DEFAULT NULL,
  `royalty_cap_amount` decimal(18,2) DEFAULT NULL,
  `loan_amount` decimal(18,2) DEFAULT NULL,
  `loan_interest_rate_pct` decimal(7,4) DEFAULT NULL,
  `advisory_shares_pct` decimal(5,2) DEFAULT NULL,
  `shot_clock_applied` tinyint(1) NOT NULL DEFAULT '0',
  `offer_status` enum('PROPOSED','COUNTERED','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED') NOT NULL DEFAULT 'PROPOSED',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`offer_id`),
  UNIQUE KEY `pitch_id` (`pitch_id`,`offer_id`),
  KEY `created_by_founder_id` (`created_by_founder_id`),
  KEY `created_by_investor_id` (`created_by_investor_id`),
  KEY `idx_offer_pitch_status` (`pitch_id`,`offer_status`),
  CONSTRAINT `offer_ibfk_1` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`),
  CONSTRAINT `offer_ibfk_2` FOREIGN KEY (`created_by_founder_id`) REFERENCES `founder` (`founder_id`),
  CONSTRAINT `offer_ibfk_3` FOREIGN KEY (`created_by_investor_id`) REFERENCES `investor` (`investor_id`),
  CONSTRAINT `offer_chk_1` CHECK ((`round_number` > 0)),
  CONSTRAINT `offer_chk_2` CHECK (((`amount_offered` is null) or (`amount_offered` >= 0))),
  CONSTRAINT `offer_chk_3` CHECK (((`equity_requested_pct` is null) or (`equity_requested_pct` between 0 and 100))),
  CONSTRAINT `offer_chk_4` CHECK (((`royalty_per_unit` is null) or (`royalty_per_unit` >= 0))),
  CONSTRAINT `offer_chk_5` CHECK (((`royalty_cap_amount` is null) or (`royalty_cap_amount` >= 0))),
  CONSTRAINT `offer_chk_6` CHECK (((`loan_amount` is null) or (`loan_amount` >= 0))),
  CONSTRAINT `offer_chk_7` CHECK (((`loan_interest_rate_pct` is null) or (`loan_interest_rate_pct` >= 0))),
  CONSTRAINT `offer_chk_8` CHECK (((`advisory_shares_pct` is null) or (`advisory_shares_pct` between 0 and 100))),
  CONSTRAINT `offer_chk_9` CHECK ((((`created_by_founder_id` is not null) and (`created_by_investor_id` is null)) or ((`created_by_founder_id` is null) and (`created_by_investor_id` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pitch_comment` (
  `comment_id` bigint NOT NULL AUTO_INCREMENT,
  `pitch_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `parent_comment_id` bigint DEFAULT NULL,
  `comment_text` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_hidden` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`comment_id`),
  KEY `pitch_id` (`pitch_id`),
  KEY `user_id` (`user_id`),
  KEY `parent_comment_id` (`parent_comment_id`),
  CONSTRAINT `pitch_comment_ibfk_1` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`),
  CONSTRAINT `pitch_comment_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `pitch_comment_ibfk_3` FOREIGN KEY (`parent_comment_id`) REFERENCES `pitch_comment` (`comment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pitch_interest` (
  `interest_id` bigint NOT NULL AUTO_INCREMENT,
  `pitch_id` bigint NOT NULL,
  `investor_id` bigint NOT NULL,
  `interest_status` enum('INTERESTED','MEETING_REQUESTED','NEGOTIATING','PASSED') NOT NULL DEFAULT 'INTERESTED',
  `message` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`interest_id`),
  UNIQUE KEY `pitch_id` (`pitch_id`,`investor_id`),
  KEY `investor_id` (`investor_id`),
  CONSTRAINT `pitch_interest_ibfk_1` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`),
  CONSTRAINT `pitch_interest_ibfk_2` FOREIGN KEY (`investor_id`) REFERENCES `investor` (`investor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pitch_moment` (
  `moment_id` bigint NOT NULL AUTO_INCREMENT,
  `pitch_id` bigint NOT NULL,
  `moment_type` enum('PRODUCT_DEMO','COUNTER_OFFER','SHARK_REACTION','DEAL_FALLOUT','OTHER') NOT NULL,
  `title` varchar(180) NOT NULL,
  `description` text,
  `start_seconds` int NOT NULL,
  `end_seconds` int DEFAULT NULL,
  PRIMARY KEY (`moment_id`),
  KEY `pitch_id` (`pitch_id`),
  CONSTRAINT `pitch_moment_ibfk_1` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`),
  CONSTRAINT `pitch_moment_chk_1` CHECK ((`start_seconds` >= 0)),
  CONSTRAINT `pitch_moment_chk_2` CHECK (((`end_seconds` is null) or (`end_seconds` >= `start_seconds`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pitch_prediction` (
  `prediction_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `pitch_id` bigint NOT NULL,
  `predicted_deal_closed` tinyint(1) NOT NULL,
  `predicted_company_active` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`prediction_id`),
  UNIQUE KEY `user_id` (`user_id`,`pitch_id`),
  KEY `pitch_id` (`pitch_id`),
  CONSTRAINT `pitch_prediction_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `pitch_prediction_ibfk_2` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `product_sample` (
  `sample_id` bigint NOT NULL AUTO_INCREMENT,
  `pitch_id` bigint NOT NULL,
  `item_name` varchar(180) NOT NULL,
  `unit_cost_to_make` decimal(15,2) DEFAULT NULL,
  `retail_sale_price` decimal(15,2) DEFAULT NULL,
  PRIMARY KEY (`sample_id`),
  KEY `pitch_id` (`pitch_id`),
  CONSTRAINT `product_sample_ibfk_1` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`),
  CONSTRAINT `product_sample_chk_1` CHECK (((`unit_cost_to_make` is null) or (`unit_cost_to_make` >= 0))),
  CONSTRAINT `product_sample_chk_2` CHECK (((`retail_sale_price` is null) or (`retail_sale_price` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `shark_reaction` (
  `reaction_id` bigint NOT NULL AUTO_INCREMENT,
  `pitch_id` bigint NOT NULL,
  `shark_id` bigint NOT NULL,
  `did_sample_product` tinyint(1) DEFAULT NULL,
  `spit_out_product` tinyint(1) DEFAULT NULL,
  `out_reason` text,
  `went_out_order` int DEFAULT NULL,
  PRIMARY KEY (`reaction_id`),
  UNIQUE KEY `pitch_id` (`pitch_id`,`shark_id`),
  KEY `shark_id` (`shark_id`),
  CONSTRAINT `shark_reaction_ibfk_1` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`),
  CONSTRAINT `shark_reaction_ibfk_2` FOREIGN KEY (`shark_id`) REFERENCES `shark` (`shark_id`),
  CONSTRAINT `shark_reaction_chk_1` CHECK (((`went_out_order` is null) or (`went_out_order` > 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_saved_pitch` (
  `user_id` bigint NOT NULL,
  `pitch_id` bigint NOT NULL,
  `saved_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `private_notes` text,
  PRIMARY KEY (`user_id`,`pitch_id`),
  KEY `pitch_id` (`pitch_id`),
  CONSTRAINT `user_saved_pitch_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `user_saved_pitch_ibfk_2` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `battle_vote` (
  `battle_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `vote_category` enum('OVERALL','VALUATION','GROWTH','BUSINESS_MODEL') NOT NULL DEFAULT 'OVERALL',
  `selected_pitch_id` bigint NOT NULL,
  `voted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`battle_id`,`user_id`,`vote_category`),
  KEY `user_id` (`user_id`),
  KEY `battle_id` (`battle_id`,`selected_pitch_id`),
  CONSTRAINT `battle_vote_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `battle_vote_ibfk_2` FOREIGN KEY (`battle_id`, `selected_pitch_id`) REFERENCES `battle_entry` (`battle_id`, `pitch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `closed_deal` (
  `deal_id` bigint NOT NULL AUTO_INCREMENT,
  `pitch_id` bigint NOT NULL,
  `accepted_offer_id` bigint NOT NULL,
  `final_agreed_amount` decimal(18,2) NOT NULL,
  `final_agreed_equity_pct` decimal(5,2) DEFAULT NULL,
  `contingency_terms` text,
  `handshake_time` datetime DEFAULT NULL,
  `deal_status` enum('PENDING_DUE_DILIGENCE','COMPLETED','FELL_THROUGH') NOT NULL DEFAULT 'PENDING_DUE_DILIGENCE',
  PRIMARY KEY (`deal_id`),
  UNIQUE KEY `pitch_id` (`pitch_id`),
  UNIQUE KEY `accepted_offer_id` (`accepted_offer_id`),
  KEY `pitch_id_2` (`pitch_id`,`accepted_offer_id`),
  CONSTRAINT `closed_deal_ibfk_1` FOREIGN KEY (`pitch_id`) REFERENCES `pitch` (`pitch_id`),
  CONSTRAINT `closed_deal_ibfk_2` FOREIGN KEY (`pitch_id`, `accepted_offer_id`) REFERENCES `offer` (`pitch_id`, `offer_id`),
  CONSTRAINT `closed_deal_chk_1` CHECK ((`final_agreed_amount` >= 0)),
  CONSTRAINT `closed_deal_chk_2` CHECK (((`final_agreed_equity_pct` is null) or (`final_agreed_equity_pct` between 0 and 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `conversation` (
  `conversation_id` bigint NOT NULL AUTO_INCREMENT,
  `request_id` bigint NOT NULL,
  `conversation_status` enum('OPEN','READ_ONLY') NOT NULL DEFAULT 'OPEN',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`conversation_id`),
  UNIQUE KEY `uq_conversation_request` (`request_id`),
  KEY `idx_conversation_status` (`conversation_status`,`created_at`),
  CONSTRAINT `fk_conversation_request` FOREIGN KEY (`request_id`) REFERENCES `connection_request` (`request_id`),
  CONSTRAINT `chk_conversation_closed_timestamp` CHECK ((((`conversation_status` = _utf8mb4'OPEN') and (`closed_at` is null)) or ((`conversation_status` = _utf8mb4'READ_ONLY') and (`closed_at` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `notification` (
  `notification_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `notification_type` varchar(50) NOT NULL,
  `title` varchar(180) NOT NULL,
  `message` text NOT NULL,
  `related_pitch_id` bigint DEFAULT NULL,
  `related_offer_id` bigint DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `related_pitch_id` (`related_pitch_id`),
  KEY `related_offer_id` (`related_offer_id`),
  KEY `idx_notification_user_unread` (`user_id`,`is_read`),
  CONSTRAINT `notification_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `notification_ibfk_2` FOREIGN KEY (`related_pitch_id`) REFERENCES `pitch` (`pitch_id`),
  CONSTRAINT `notification_ibfk_3` FOREIGN KEY (`related_offer_id`) REFERENCES `offer` (`offer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `offer_investor` (
  `offer_id` bigint NOT NULL,
  `investor_id` bigint NOT NULL,
  `capital_share_pct` decimal(5,2) DEFAULT NULL,
  `equity_share_pct` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`offer_id`,`investor_id`),
  KEY `investor_id` (`investor_id`),
  CONSTRAINT `offer_investor_ibfk_1` FOREIGN KEY (`offer_id`) REFERENCES `offer` (`offer_id`),
  CONSTRAINT `offer_investor_ibfk_2` FOREIGN KEY (`investor_id`) REFERENCES `investor` (`investor_id`),
  CONSTRAINT `offer_investor_chk_1` CHECK (((`capital_share_pct` is null) or (`capital_share_pct` between 0 and 100))),
  CONSTRAINT `offer_investor_chk_2` CHECK (((`equity_share_pct` is null) or (`equity_share_pct` between 0 and 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `deal_status_history` (
  `history_id` bigint NOT NULL AUTO_INCREMENT,
  `deal_id` bigint NOT NULL,
  `changed_by_user_id` bigint DEFAULT NULL,
  `old_status` enum('PENDING_DUE_DILIGENCE','COMPLETED','FELL_THROUGH') DEFAULT NULL,
  `new_status` enum('PENDING_DUE_DILIGENCE','COMPLETED','FELL_THROUGH') NOT NULL,
  `change_note` text,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`history_id`),
  KEY `deal_id` (`deal_id`),
  KEY `changed_by_user_id` (`changed_by_user_id`),
  CONSTRAINT `deal_status_history_ibfk_1` FOREIGN KEY (`deal_id`) REFERENCES `closed_deal` (`deal_id`),
  CONSTRAINT `deal_status_history_ibfk_2` FOREIGN KEY (`changed_by_user_id`) REFERENCES `app_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `due_diligence` (
  `audit_id` bigint NOT NULL AUTO_INCREMENT,
  `deal_id` bigint NOT NULL,
  `audit_start_date` date DEFAULT NULL,
  `audit_end_date` date DEFAULT NULL,
  `financials_verified` tinyint(1) DEFAULT NULL,
  `ip_verified` tinyint(1) DEFAULT NULL,
  `fallout_reason` text,
  PRIMARY KEY (`audit_id`),
  KEY `deal_id` (`deal_id`),
  CONSTRAINT `due_diligence_ibfk_1` FOREIGN KEY (`deal_id`) REFERENCES `closed_deal` (`deal_id`),
  CONSTRAINT `due_diligence_chk_1` CHECK (((`audit_start_date` is null) or (`audit_end_date` is null) or (`audit_end_date` >= `audit_start_date`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `message` (
  `message_id` bigint NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint NOT NULL,
  `sender_user_id` bigint NOT NULL,
  `message_body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `idx_message_conversation_time` (`conversation_id`,`created_at`,`message_id`),
  KEY `idx_message_sender_time` (`sender_user_id`,`created_at`),
  CONSTRAINT `fk_message_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversation` (`conversation_id`),
  CONSTRAINT `fk_message_sender` FOREIGN KEY (`sender_user_id`) REFERENCES `app_user` (`user_id`),
  CONSTRAINT `chk_message_nonempty_body` CHECK ((not(regexp_like(`message_body`,_utf8mb4'^[[:space:]]*$'))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

