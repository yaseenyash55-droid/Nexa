import axios from 'axios';

async function run() {
  try {
    // Register a user
    const res = await axios.post('http://localhost:4000/api/auth/register', {
      username: 'testuser_' + Date.now(),
      email: 'test_' + Date.now() + '@example.com',
      password: 'password123',
      displayName: 'Test User'
    });
    const token = res.data.data.accessToken;
    const userId = res.data.data.user.userId;
    console.log('Created user:', res.data.data.user.username);

    // Update profile
    const updateRes = await axios.put(`http://localhost:4000/api/users/${userId}`, {
      username: 'newname_' + Date.now(),
      displayName: 'New Name'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Updated user from response:', updateRes.data.data.username);

    // Fetch user
    const meRes = await axios.get('http://localhost:4000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Fetched user from /auth/me:', meRes.data.data.username);

  } catch (err: any) {
    console.error(err.response?.data || err.message);
  }
}
run();
