import { UserService } from './src/services/user.service.js';
import { initializeOraclePool, closeOraclePool } from './src/db/pool.js';
import { env } from './src/config/env.js';

async function run() {
  await initializeOraclePool();
  const userService = new UserService();
  
  // Find a user
  const dbUser = await userService.getUserByUsername('testuser123'); // assuming this user exists or we just create one
  console.log(dbUser);
  
  await closeOraclePool();
}

run().catch(console.error);
