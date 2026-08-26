import axios from 'axios';

async function run() {
  try {
    // Attempting login to get token
    const loginRes = await axios.post('http://localhost:4000/api/auth/login', {
      emailOrUsername: 'leon_yash', // Use one of the usernames from the seed
      password: 'password123'
    });
    const token = loginRes.data.data.tokens.accessToken;
    const userId = loginRes.data.data.user.userId;
    console.log('Logged in as:', loginRes.data.data.user.username);
    
    // Attempt to update
    const newUsername = 'leon_updated_' + Math.floor(Math.random() * 1000);
    const putRes = await axios.put(`http://localhost:4000/api/users/${userId}`, {
      username: newUsername,
      displayName: 'Leon Yash'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Update response data:', JSON.stringify(putRes.data, null, 2));
    
  } catch (err: any) {
    console.error('Error:', err.response?.data || err.message);
  }
}
run();
