import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import oracledb from 'oracledb';

const dbConfig = {
  user: process.env.DB_USER || 'NEXA_USER',
  password: process.env.DB_PASSWORD || 'NexaPass123#',
  connectString: process.env.DB_CONNECT_STRING || 'localhost:1521/FREEPDB1'
};

const MIGRATIONS_DIR = path.resolve(process.cwd(), '../database');

  // Dynamically discover all .sql migration files in the database directory, sorted alphabetically to ensure proper order.
  const MIGRATION_FILES = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

async function calculateChecksum(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function parseStatements(sqlScript) {
  const cleanSql = sqlScript
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^SET\s+.*$/gmi, '')
    .replace(/^WHENEVER\s+.*$/gmi, '')
    .replace(/^PROMPT\s+.*$/gmi, '')
    .trim();

  // If script contains PL/SQL blocks (BEGIN / END), split by slash
  if (/BEGIN|DECLARE/i.test(cleanSql)) {
    return cleanSql
      .split(/\n\/\s*$/m)
      .map(s => s.replace(/\/$/, '').trim())
      .filter(s => s.length > 0);
  }

  // Split standard DDL statements by semicolon
  return cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && s !== '/');
}

async function run() {
  let connection;
  try {
    console.log('Connecting to Oracle Database for Migration Execution...');
    connection = await oracledb.getConnection(dbConfig);
    connection.autoCommit = true;

    // 1. Ensure Ledger Table Exists
    console.log('Ensuring SCHEMA_MIGRATIONS ledger table exists...');
    const ledgerSql = `
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
          IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
      END;
    `;
    await connection.execute(ledgerSql);

    // 2. Process each migration file
    for (const filename of MIGRATION_FILES) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        console.warn(`Skipping missing migration file: ${filename}`);
        continue;
      }

      const checksum = await calculateChecksum(filePath);

      // Check if version was already applied
      const checkRes = await connection.execute(
        `SELECT CHECKSUM_SHA256 FROM SCHEMA_MIGRATIONS WHERE VERSION = :version`,
        [filename]
      );

      if (checkRes.rows && checkRes.rows.length > 0) {
        const recordedChecksum = checkRes.rows[0][0];
        if (recordedChecksum !== checksum) {
          throw new Error(`CRITICAL CHECKSUM MISMATCH in ${filename}! Expected ${recordedChecksum}, found ${checksum}. Aborting migrations.`);
        }
        console.log(`[SKIPPED] Migration ${filename} already applied with matching checksum.`);
        continue;
      }

      console.log(`[EXECUTING] Applying migration ${filename}...`);
      const startTime = Date.now();

      const sqlScript = fs.readFileSync(filePath, 'utf8');
      const statements = parseStatements(sqlScript);

      for (const stmt of statements) {
        try {
          await connection.execute(stmt);
        } catch (err) {
          // ORA-00955 (name is already used by an existing object) or ORA-01430 (column being added already exists)
          if (err.code === 'ORA-00955' || err.code === 'ORA-01430') {
            console.log(`  [EXISTING OBJECT GUARD] Ignored ${err.code} for statement.`);
          } else {
            console.error(`[ERROR] Failed executing statement in ${filename}:`, stmt, err);
            throw err;
          }
        }
      }

      const durationMs = Date.now() - startTime;

      // Record successful application in ledger
      await connection.execute(
        `INSERT INTO SCHEMA_MIGRATIONS (VERSION, CHECKSUM_SHA256, EXECUTION_MS, APPLIED_BY)
         VALUES (:version, :checksum, :durationMs, USER)`,
        { version: filename, checksum, durationMs }
      );

      console.log(`[SUCCESS] Migration ${filename} applied in ${durationMs}ms.`);
    }

    console.log('All database migrations verified and applied successfully.');
  } catch (err) {
    console.error('Migration Runner Failure:', err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

run();
