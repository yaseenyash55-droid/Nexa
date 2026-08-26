import { Redis } from 'ioredis';

const redisUrl = 'rediss://default:gQAAAAAAApOPAAIgcDE3ZTRlM2VjMDI3MjA0ZmFkOTExMmNhYzIzMmUxZDYyYw@hot-shad-168847.upstash.io:6379';

async function testRedisConnection() {
  console.log('Testing connection to Upstash Redis at hot-shad-168847.upstash.io:6379...');
  
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    tls: { rejectUnauthorized: false }
  });

  try {
    const pingResult = await redis.ping();
    console.log('✅ Redis PING response:', pingResult);

    await redis.set('nexa:test_key', 'upstash_redis_working', 'EX', 60);
    const value = await redis.get('nexa:test_key');
    console.log('✅ Redis GET test_key:', value);

    console.log('🎉 Upstash Redis connection successful and fully operational!');
  } catch (err: any) {
    console.error('❌ Redis connection test failed:', err?.message || err);
  } finally {
    redis.disconnect();
  }
}

testRedisConnection();
