import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getEmailProvider } from '../src/utils/email.js';

async function runEmailTest() {
  const targetEmail = 'nexadoomsorb@gmail.com';
  console.log(`\n==================================================`);
  console.log(`Testing Nexa Email Dispatch to: ${targetEmail}`);
  console.log(`==================================================\n`);

  console.log('Environment configuration:');
  console.log('BREVO_API_KEY set:', Boolean(process.env.BREVO_API_KEY));
  console.log('BREVO_SENDER_EMAIL:', process.env.BREVO_SENDER_EMAIL);
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS set:', Boolean(process.env.SMTP_PASS || process.env.SMTP_PASSWORD));
  console.log('\nInitializing provider via getEmailProvider()...');

  const provider = getEmailProvider();

  console.log('\nDispatching test email...');
  const success = await provider.sendEmail({
    to: targetEmail,
    subject: 'Nexa Social - Live Email Delivery Test',
    body: `Hello! This is a test email sent from the Nexa Social backend verification pipeline at ${new Date().toISOString()}. If you received this, your email configuration is 100% operational!`
  });

  console.log(`\nResult: ${success ? '✅ EMAIL DELIVERED' : '❌ DELIVERY REJECTED'}`);
}

runEmailTest().catch((err) => {
  console.error('\n❌ Email test failed with error:');
  console.error(err);
  process.exit(1);
});
