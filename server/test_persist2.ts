import axios from 'axios';

async function run() {
  try {
    const res = await axios.post('http://localhost:4000/api/auth/register', {
      username: 'test_persist_' + Date.now(),
      email: 'test_persist_' + Date.now() + '@example.com',
      password: 'password123',
      displayName: 'Test User'
    });
    const token = res.data.data.accessToken;
    const userId = res.data.data.user.userId;
    console.log('Original username:', res.data.data.user.username);

    const newUsername = 'new_persist_' + Date.now();
    const updateRes = await axios.put(`http://localhost:4000/api/users/${userId}`, {
      username: newUsername,
      displayName: 'New Name'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Updated username in response:', updateRes.data.data.username);

    const meRes = await axios.get('http://localhost:4000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Verified username from /auth/me:', meRes.data.data.username);
  } catch (err: any) {
    console.error(err.response?.data || err.message);
  }
}
run();
