import pg from 'pg';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import { sanitizePostgresUrl, checkPostgresHealth, initializePostgresPool, closePostgresPool } from '../src/db/postgres.pool.js';

async function testPostgresConnection() {
  const url = env.DATABASE_URL;
  if (!url) {
    logger.error('No DATABASE_URL found in environment variables. Please provide DATABASE_URL in .env to test connection.');
    console.error('\n❌ ERROR: DATABASE_URL is missing in .env');
    console.log('Example: DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?sslmode=require"\n');
    process.exit(1);
  }

  const sanitized = sanitizePostgresUrl(url);
  console.log(`\n🔍 Testing PostgreSQL connection to: ${sanitized}`);
  console.log(`🔒 SSL mode: ${env.PG_SSL ? 'Enabled (rejectUnauthorized: false)' : 'Disabled'}`);

  try {
    await initializePostgresPool();
    const health = await checkPostgresHealth();

    if (health.reachable) {
      console.log('\n✅ SUCCESS: Successfully connected to PostgreSQL Database!');
      console.log('   - Pool initialization: OK');
      console.log('   - Health check query (SELECT 1 AS alive): OK\n');
    } else {
      console.error(`\n❌ FAILED: Health probe reported unreachable: ${health.details}\n`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n❌ FAILED: Could not connect to PostgreSQL Database.');
    console.error(`   Error message: ${err.message || err}\n`);
    process.exit(1);
  } finally {
    await closePostgresPool();
  }
}

testPostgresConnection();
