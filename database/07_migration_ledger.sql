-- Migration Ledger Table DDL for Production Migration Management
-- Tracks version, SHA-256 checksums, and execution timestamps

BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE SCHEMA_MIGRATIONS (
      VERSION            VARCHAR2(100) PRIMARY KEY,
      CHECKSUM_SHA256    VARCHAR2(64) NOT NULL,
      APPLIED_AT         TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
      EXECUTION_MS       NUMBER,
      APPLIED_BY         VARCHAR2(128)
    )
  ';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN
      NULL; -- Table already exists
    ELSE
      RAISE;
    END IF;
END;
