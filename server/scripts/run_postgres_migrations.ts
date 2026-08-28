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

    const migrationsDir = path.resolve(process.cwd(), '../database/postgres');
    const altMigrationsDir = path.resolve(process.cwd(), 'database/postgres');
    const targetDir = fs.existsSync(migrationsDir) ? migrationsDir : altMigrationsDir;

    if (!fs.existsSync(targetDir)) {
      throw new Error(`Migrations directory not found at: ${targetDir}`);
    }

    const files = fs.readdirSync(targetDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(targetDir, file);
      logger.info(`Applying migration: ${file}...`);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      await client.query(sqlContent);
      logger.info(`Successfully applied ${file}.`);
    }

    logger.info('All PostgreSQL migrations applied successfully!');
  } catch (err) {
    logger.error({ err }, 'Error applying PostgreSQL migrations');
    process.exit(1);
  } finally {
    await client.end();
  }
}

runPostgresMigrations();
