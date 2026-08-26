import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getEmailProvider } from '../src/utils/email.js';

async function testTargetEmail() {
  const target = 'hiphoptamizhanyasu@gmail.com';
  console.log(`\n==================================================`);
  console.log(`Direct SMTP Dispatch to Target: ${target}`);
  console.log(`==================================================\n`);

  const provider = getEmailProvider();
  const success = await provider.sendEmail({
    to: target,
    subject: 'Nexa Social - Password Reset Verification Test',
    body: `Hello! This is a verification test to confirm your email delivery channel for ${target} is fully functional.`
  });

  console.log(`\nDelivery Result to ${target}: ${success ? '✅ SUCCESS (250 OK)' : '❌ FAILED'}`);
}

testTargetEmail().catch(err => {
  console.error('Dispatch failed:', err);
  process.exit(1);
});
