import nodemailer from 'nodemailer';

const user = 'b6696f001@smtp-brevo.com';
const pass = 'xsmtpsib-e6582a1a966831b16cfeb95cff460b12aa51a92749fbada6cac4963ebfc90c3b-mNssT3r6bzyHXPWl';

async function testPort(port: number, secure: boolean) {
  console.log(`\nTesting smtp-relay.brevo.com on port ${port} (secure: ${secure})...`);
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000
  });

  try {
    const verifyResult = await transporter.verify();
    console.log(`✅ Port ${port} verified successfully:`, verifyResult);

    const sendResult = await transporter.sendMail({
      from: '"Nexa" <nexadoomsorb@gmail.com>',
      to: 'nexadoomsorb@gmail.com',
      subject: `Nexa Test - Port ${port}`,
      text: `Test delivery from port ${port}`
    });
    console.log(`🎉 Port ${port} email sent:`, sendResult.messageId);
    return true;
  } catch (err: any) {
    console.error(`❌ Port ${port} failed:`, err?.response || err?.message || err);
    return false;
  }
}

async function runAll() {
  await testPort(587, false);
  await testPort(465, true);
  await testPort(2525, false);
}

runAll();
