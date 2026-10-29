-- ============================================================================
-- Sauda Phase 2 — READ-ONLY schema inspection. Only SELECT / SHOW statements. No data rows
-- from business tables are read (only reference-table names and counts).
-- Run in MySQL Workbench against the REAL database (ideally a restored clone), then send the
-- result grids/exported text back. Contains no passwords or personal data.
-- ============================================================================

-- 0. Where am I?
SELECT DATABASE() AS db, VERSION() AS mysql_version, @@sql_mode AS sql_mode;

-- 1. All tables and engines
SELECT table_name, engine, table_rows AS approx_rows
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Column definitions for every table the application touches (and the new ones, if present)
SELECT table_name, ordinal_position, column_name, column_type, is_nullable, column_key, column_default, extra, collation_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('app_user','app_role','user_role','founder','investor','company','pitch',
                     'industry','startup_stage','user_saved_pitch','connection_request',
                     'conversation','message','pitch_interest')
ORDER BY table_name, ordinal_position;

-- 3. Foreign keys (with delete/update rules)
SELECT kcu.table_name, kcu.constraint_name, kcu.column_name, kcu.referenced_table_name,
       kcu.referenced_column_name, rc.update_rule, rc.delete_rule
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = kcu.constraint_schema AND rc.constraint_name = kcu.constraint_name
WHERE kcu.table_schema = DATABASE() AND kcu.referenced_table_name IS NOT NULL
ORDER BY kcu.table_name, kcu.constraint_name, kcu.ordinal_position;

-- 4. Unique / primary keys and indexes
SELECT table_name, index_name, non_unique, seq_in_index, column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
ORDER BY table_name, index_name, seq_in_index;

-- 5. CHECK constraints (MySQL 8.0.16+)
SELECT tc.table_name, cc.constraint_name, cc.check_clause
FROM information_schema.check_constraints cc
JOIN information_schema.table_constraints tc
  ON tc.constraint_schema = cc.constraint_schema AND tc.constraint_name = cc.constraint_name
WHERE cc.constraint_schema = DATABASE()
ORDER BY tc.table_name, cc.constraint_name;

-- 6. Triggers and routines (the docs mention six triggers incl. Monday 14:00-16:00 Offer restrictions)
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers WHERE trigger_schema = DATABASE() ORDER BY event_object_table, trigger_name;
SELECT routine_type, routine_name FROM information_schema.routines WHERE routine_schema = DATABASE();

-- 7. Reference data the app depends on (names only, no user data)
SELECT role_id, role_name FROM app_role ORDER BY role_id;
SELECT COUNT(*) AS industries FROM industry;
SELECT COUNT(*) AS startup_stages FROM startup_stage;

-- 8. Were 001 / 002 / 003 already applied?
SELECT column_name FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'app_user' AND column_name = 'google_subject';      -- 001
SELECT table_name FROM information_schema.tables
 WHERE table_schema = DATABASE() AND table_name IN ('connection_request','conversation','message');  -- 001
SELECT column_name FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'pitch' AND column_name IN ('updated_at','review_note'); -- 002
SELECT table_name FROM information_schema.tables
 WHERE table_schema = DATABASE() AND table_name = 'user_saved_pitch';                                 -- 003

-- 9. Data-shape checks on pitch (counts only)
SELECT pitch_type, pitch_status, COUNT(*) AS n FROM pitch GROUP BY pitch_type, pitch_status;
SELECT COUNT(*) AS active_users_without_role
FROM app_user u LEFT JOIN user_role ur ON ur.user_id = u.user_id
WHERE u.account_status = 'ACTIVE' AND ur.user_id IS NULL;
