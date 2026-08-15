const { io } = require('socket.io-client');
const http = require('http');
const oracledb = require('oracledb');
const assert = require('assert/strict');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

async function apiRequest(path, method, data, token) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (payload) {
      headers['Content-Length'] = payload.length;
    }
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 4000,
        path,
        method,
        headers
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }
    );
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('=== 1. LOGGING IN USER A, USER B, USER C ===');
  const loginA = await apiRequest('/api/auth/login', 'POST', {
    emailOrUsername: 'user_alpha_1786459077710',
    password: 'Password123#'
  });
  const loginB = await apiRequest('/api/auth/login', 'POST', {
    emailOrUsername: 'user_beta_1786459077710',
    password: 'Password123#'
  });
  const loginC = await apiRequest('/api/auth/login', 'POST', {
    emailOrUsername: 'user_charlie_1786460411242',
    password: 'Password123#'
  });

  const tokenA = loginA.body.data.accessToken;
  const tokenB = loginB.body.data.accessToken;
  const tokenC = loginC.body.data.accessToken;

  console.log('=== 2. CONNECTING USER A REAL SOCKET.IO CLIENT ===');
  const socketA = io('http://localhost:4000', {
    auth: { token: tokenA },
    transports: ['websocket', 'polling']
  });

  let messageReadCount = 0;
  let receivedPayload = null;

  socketA.on('message:read', (data) => {
    messageReadCount++;
    receivedPayload = data;
    console.log(`[Socket.IO Event] message:read received by User A! (Count: ${messageReadCount})`, data);
  });

  await new Promise((r) => socketA.on('connect', r));
  console.log('✓ User A Socket.IO connected with socketId:', socketA.id);

  console.log('=== 3. USER A SENDS NEW MESSAGE TO USER B ===');
  const sendRes = await apiRequest(
    '/api/messages',
    'POST',
    {
      receiverId: 29,
      content: 'Live Socket Read-Receipt Verification Message at ' + new Date().toISOString()
    },
    tokenA
  );
  const newMsgId = sendRes.body.data.messageId;
  console.log(`✓ Message created with ID ${newMsgId}:`, sendRes.body.data.content);

  console.log('=== 4. USER C ATTEMPTS READ (UNRELATED USER) ===');
  const readAttemptC = await apiRequest(`/api/messages/${newMsgId}/read`, 'POST', null, tokenC);
  console.log('User C Attempt API Response:', readAttemptC.body);
  assert.equal(readAttemptC.body.data.rowsAffected, 0);
  assert.equal(messageReadCount, 0);
  console.log(`Assert messageReadCount === 0: actual is ${messageReadCount}`);

  console.log('=== 5. USER B READS MESSAGE (AUTHORIZED RECEIVER) ===');
  const readResB1 = await apiRequest(`/api/messages/${newMsgId}/read`, 'POST', null, tokenB);
  console.log('User B First Read Response:', readResB1.body);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(readResB1.body.data.rowsAffected, 1);
  assert.equal(messageReadCount, 1);
  assert.ok(receivedPayload?.readAt);
  console.log(`Assert messageReadCount === 1: actual is ${messageReadCount}`);
  console.log('Socket Payload READ_AT Timestamp:', receivedPayload?.readAt);

  console.log('=== 6. USER B REPEATS READ (IDEMPOTENCY) ===');
  const readResB2 = await apiRequest(`/api/messages/${newMsgId}/read`, 'POST', null, tokenB);
  console.log('User B Repeat Read Response:', readResB2.body);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(readResB2.body.data.rowsAffected, 0);
  assert.equal(messageReadCount, 1);
  console.log(`Assert messageReadCount === 1 (No duplicate socket emit): actual is ${messageReadCount}`);

  console.log('=== 7. DIRECT ORACLE SELECT QUERY ===');
  const c = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING
  });
  const resOracle = await c.execute(
    'SELECT MESSAGE_ID, SENDER_ID, RECEIVER_ID, CONTENT, READ_AT, CREATED_AT FROM MESSAGES WHERE MESSAGE_ID = :msgId',
    { msgId: newMsgId }
  );
  console.log('=== ORACLE DB MESSAGES ROW RESULT ===\n', resOracle.rows);

  await c.close();
  socketA.disconnect();
  console.log('✓ Test complete cleanly.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
