-- ============================================================================
-- Sauda minimal reference seed (NO users, NO business data, NO credentials)
-- Evidence: the application looks roles up BY NAME (server/src/auth.ts: VIEWER on sign-up,
-- FOUNDER / INVESTOR on role activation, ADMIN checked by the authorization helpers) and the
-- source database has app_role with UNIQUE(role_name) and 4 rows (AUTO_INCREMENT=5).
-- Role IDs are deliberately NOT hardcoded; they are assigned by AUTO_INCREMENT.
-- INSERT IGNORE + UNIQUE(role_name) makes this safe to re-run.
--
-- NOT seeded (no evidence of the real values yet): industry and startup_stage rows.
-- The source has 4 industries and 6 stages but their names were not supplied.
-- Until they are added, founder pitch forms have no industry/stage choices in a fresh database.
-- NO ADMIN USER is created here (admin bootstrap is a Phase 3 decision).
-- ============================================================================

INSERT IGNORE INTO app_role (role_name) VALUES
    ('VIEWER'),
    ('FOUNDER'),
    ('INVESTOR'),
    ('ADMIN');
