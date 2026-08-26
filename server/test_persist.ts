import axios from 'axios';
import { spawn } from 'child_process';

async function run() {
  const backend = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['ts-node', 'server/src/server.ts'], { env: { ...process.env, PORT: '4000' } });
  
  backend.stdout.on('data', (data) => console.log(`Backend: ${data}`));
  backend.stderr.on('data', (data) => console.error(`Backend error: ${data}`));

  await new Promise(r => setTimeout(r, 8000)); // wait for it to start

  try {
    // Register
    const res = await axios.post('http://localhost:4000/api/auth/register', {
      username: 'test_persist_' + Date.now(),
      email: 'test_persist_' + Date.now() + '@example.com',
      password: 'password123',
      displayName: 'Test User'
    });
    const token = res.data.data.accessToken;
    const userId = res.data.data.user.userId;
    const originalUsername = res.data.data.user.username;
    console.log('Original username:', originalUsername);

    // Update
    const newUsername = 'new_persist_' + Date.now();
    const updateRes = await axios.put(`http://localhost:4000/api/users/${userId}`, {
      username: newUsername,
      displayName: 'New Name'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Updated username in response:', updateRes.data.data.username);

    // Verify
    const meRes = await axios.get('http://localhost:4000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Verified username from /auth/me:', meRes.data.data.username);
    
    // Check if it's the new username
    if (meRes.data.data.username !== newUsername) {
      console.log('BUG DETECTED: Username did not persist!');
    } else {
      console.log('SUCCESS: Username persisted.');
    }
  } catch (err: any) {
    console.error(err.response?.data || err.message);
  } finally {
    backend.kill();
  }
}
run();
