import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { initializeDatabase, closeDatabase, getUserRepository } from '../src/repositories/factory.js';

async function fixUserEmail() {
  console.log('\n--- Checking & Fixing User Email in Database ---');
  await initializeDatabase();
  const userRepo = getUserRepository();

  // 1. Search for username 'god_doom_yash' or matching email pattern
  const user = await userRepo.findByUsername('god_doom_yash');
  if (user) {
    console.log(`Found user: userId=${user.userId}, username=${user.username}, currentEmail=${user.email}`);
    if (user.email !== 'hiphoptamizhanyasu@gmail.com') {
      console.log(`Updating email from "${user.email}" -> "hiphoptamizhanyasu@gmail.com"...`);
      await userRepo.updateProfile(user.userId, { email: 'hiphoptamizhanyasu@gmail.com' });
      const updated = await userRepo.findById(user.userId);
      console.log(`✅ Email successfully updated to: ${updated?.email}`);
    } else {
      console.log(`✅ Email is already correctly set to: ${user.email}`);
    }
  } else {
    console.log('User "god_doom_yash" not found in local database.');
  }

  await closeDatabase();
}

fixUserEmail().catch(err => {
  console.error('Error fixing user email:', err);
  process.exit(1);
});
