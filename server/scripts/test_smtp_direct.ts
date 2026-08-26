import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { ProductionEmailProvider } from '../src/utils/email.js';

async function runSmtpTest() {
  console.log('\n--- Testing Direct SMTP via smtp-relay.brevo.com ---');
  const provider = new ProductionEmailProvider();
  
  const success = await provider.sendEmail({
    to: 'nexadoomsorb@gmail.com',
    subject: 'Nexa Social - Direct SMTP Test',
    body: 'Testing direct SMTP via Brevo relay.'
  });

  console.log('SMTP Delivery Success:', success);
}

runSmtpTest().catch(err => {
  console.error('SMTP Delivery Error:', err);
});
