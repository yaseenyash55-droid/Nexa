import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
config({ path: path.resolve(__dirname, '.env') });

import { initializeOraclePool, closeOraclePool, executeSql } from './src/db/pool.js';
import { UserService } from './src/services/user.service.js';

async function testUpdate() {
  await initializeOraclePool();
  const userService = new UserService();
  
  try {
    // 1. Get first user
    const res = await executeSql('SELECT USER_ID FROM USERS FETCH FIRST 1 ROWS ONLY');
    if (!res.rows || res.rows.length === 0) {
      console.log('No user found to test with');
      return;
    }
    const userId = (res.rows[0] as any).USER_ID;
    
    const user = await userService.getUserById(userId);
    console.log('Original user:', user.username);
    
    // 2. Update username
    const newUsername = 'test_' + Math.floor(Math.random() * 1000);
    console.log('Attempting to update to:', newUsername);
    
    const updated = await userService.updateProfile(user.userId, {
      username: newUsername
    });
    
    console.log('Updated user returned by service:', updated.username);
    
    // 3. Fetch again to verify
    const fetchedAgain = await userService.getUserById(user.userId);
    console.log('User in DB after update:', fetchedAgain.username);
    
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await closeOraclePool();
  }
}

testUpdate();
