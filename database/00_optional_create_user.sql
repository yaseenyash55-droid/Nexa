-- 00_optional_create_user.sql
-- Administrative setup script for Oracle Database 19c/21c XE / 23c/26ai Free
-- Must be executed as SYSDBA or SYSTEM:
-- sqlplus sys/your_admin_password@localhost:1521/FREEPDB1 as sysdba @database/00_optional_create_user.sql

ALTER SESSION SET CONTAINER = FREEPDB1;

SET SERVEROUTPUT ON;
ACCEPT nexa_password CHAR HIDE PROMPT 'Enter a new password for NEXA_USER: '

DECLARE
  v_user_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_user_exists FROM dba_users WHERE username = 'NEXA_USER';
  IF v_user_exists = 0 THEN
    EXECUTE IMMEDIATE 'CREATE USER NEXA_USER IDENTIFIED BY "' || REPLACE('&nexa_password', '"', '""') || '" DEFAULT TABLESPACE USERS QUOTA UNLIMITED ON USERS';
    EXECUTE IMMEDIATE 'GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER, CREATE VIEW TO NEXA_USER';
    DBMS_OUTPUT.PUT_LINE('Schema user NEXA_USER created successfully.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('Schema user NEXA_USER already exists.');
  END IF;
END;
/
