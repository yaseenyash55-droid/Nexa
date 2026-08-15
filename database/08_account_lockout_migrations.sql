-- ====================================================================
-- NEXA ORACLE DATABASE MIGRATION SCRIPT
-- FILE: 08_account_lockout_migrations.sql
-- DESCRIPTION: Migration script for brute-force account lockout protection
-- ====================================================================

BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE USERS ADD (
    FAILED_LOGIN_ATTEMPTS      NUMBER DEFAULT 0 NOT NULL,
    FIRST_FAILED_ATTEMPT_AT    TIMESTAMP WITH TIME ZONE,
    LOCKOUT_UNTIL              TIMESTAMP WITH TIME ZONE
  )';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -1430 THEN NULL; ELSE RAISE; END IF;
END;
/

COMMIT;
