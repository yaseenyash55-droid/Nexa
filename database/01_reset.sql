-- 01_reset.sql
-- Dependency-safe PL/SQL reset script for Nexa Application Schema.
-- Drops all application tables in reverse dependency order without breaking on missing tables.

SET SERVEROUTPUT ON;

DECLARE
  TYPE v_table_array IS TABLE OF VARCHAR2(30);
  v_tables v_table_array := v_table_array(
    'SECURITY_EVENTS',
    'PASSWORD_RESET_TOKENS',
    'EMAIL_VERIFICATION_TOKENS',
    'MFA_RECOVERY_CODES',
    'USER_SESSIONS',
    'USER_PRIVACY_SETTINGS',
    'USER_SECURITY_SETTINGS',
    'MEDIA_ASSETS',
    'BROADCAST_RECIPIENTS',
    'BROADCASTS',
    'GROUP_MESSAGES',
    'GROUP_MEMBERS',
    'GROUPS',
    'REEL_LIKES',
    'REELS',
    'STORIES',
    'MESSAGES',
    'NOTIFICATIONS',
    'BOOKMARKS',
    'REFRESH_TOKENS',
    'FOLLOWERS',
    'LIKES',
    'COMMENTS',
    'POSTS',
    'USERS'
  );
BEGIN
  DBMS_OUTPUT.PUT_LINE('Starting Nexa Schema Reset...');
  FOR i IN 1..v_tables.COUNT LOOP
    BEGIN
      EXECUTE IMMEDIATE 'DROP TABLE ' || v_tables(i) || ' CASCADE CONSTRAINTS';
      DBMS_OUTPUT.PUT_LINE('Dropped table: ' || v_tables(i));
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE = -942 THEN
          -- ORA-00942: table or view does not exist (expected on fresh schema)
          DBMS_OUTPUT.PUT_LINE('Table ' || v_tables(i) || ' did not exist. Skipped.');
        ELSE
          DBMS_OUTPUT.PUT_LINE('Error dropping table ' || v_tables(i) || ': ' || SQLERRM);
          RAISE;
        END IF;
    END;
  END LOOP;
  DBMS_OUTPUT.PUT_LINE('Nexa Schema Reset Complete.');
END;
/
