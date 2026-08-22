import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import { sanitizePostgresUrl } from '../src/db/postgres.pool.js';

async function runPostgresMigrations() {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    logger.error('DATABASE_URL is required to run PostgreSQL migrations.');
    process.exit(1);
  }

  logger.info({ url: sanitizePostgresUrl(connectionString) }, 'Connecting to PostgreSQL for migration...');

  const client = new pg.Client({
    connectionString,
    ssl: env.PG_SSL ? { rejectUnauthorized: false } : undefined
  });

  try {
    await client.connect();
    logger.info('Connected to PostgreSQL successfully.');

    const schemaPath = path.resolve(process.cwd(), '../database/postgres/01_schema.sql');
    const altSchemaPath = path.resolve(process.cwd(), 'database/postgres/01_schema.sql');
    const targetPath = fs.existsSync(schemaPath) ? schemaPath : altSchemaPath;

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Schema file not found at: ${targetPath}`);
    }

    const sqlContent = fs.readFileSync(targetPath, 'utf8');
    logger.info(`Applying DDL schema from ${targetPath}...`);

    await client.query(sqlContent);
    logger.info('PostgreSQL DDL schema applied successfully! All tables, indexes, and constraints are in place.');
  } catch (err) {
    logger.error({ err }, 'Error applying PostgreSQL migrations');
    process.exit(1);
  } finally {
    await client.end();
  }
}

runPostgresMigrations();
