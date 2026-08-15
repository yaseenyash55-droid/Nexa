const oracledb = require('oracledb');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

async function testInsert() {
  const connection = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING
  });

  const insertSql = `
    INSERT INTO MESSAGES (SENDER_ID, RECEIVER_ID, CONTENT, CREATED_AT)
    VALUES (:senderId, :receiverId, :content, SYSTIMESTAMP)
    RETURNING MESSAGE_ID, CREATED_AT INTO :messageId, :createdAt
  `;

  const binds = {
    senderId: 28,
    receiverId: 29,
    content: 'Manual direct SQL INSERT test at ' + new Date().toISOString(),
    messageId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
    createdAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
  };

  console.log('=== EXECUTING ORACLE SQL ===\n' + insertSql.trim());
  const res = await connection.execute(insertSql, binds);
  console.log('=== INSERT OUTBINDS ===\n', res.outBinds);

  await connection.commit();

  const selectRes = await connection.execute(
    'SELECT MESSAGE_ID, SENDER_ID, RECEIVER_ID, CONTENT, READ_AT, CREATED_AT FROM MESSAGES ORDER BY MESSAGE_ID DESC'
  );
  console.log('=== SELECT ALL MESSAGES ===\n', selectRes.rows);

  await connection.close();
}

testInsert().catch(console.error);
