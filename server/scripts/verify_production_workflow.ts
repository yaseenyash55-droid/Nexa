import { io, Socket } from 'socket.io-client';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

export async function runProductionVerification(baseUrl: string): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  
  console.log(`\n======================================================`);
  console.log(`ðŸš€ NEXA PRODUCTION SYSTEM VERIFICATION`);
  console.log(`ðŸŽ¯ Target URL: ${normalizedBase}`);
  console.log(`======================================================\n`);

  let userAToken = '';
  let userBToken = '';
  let userAId = 0;
  let userBId = 0;
  let createdPostId = 0;
  let createdStoryId = 0;
  let createdReelId = 0;
  let createdMessageId = 0;

  const testRunId = Date.now().toString(36);
  const userAUsername = `test_a_${testRunId}`;
  const userAEmail = `test_a_${testRunId}@nexa-test.internal`;
  const userBUsername = `test_b_${testRunId}`;
  const userBEmail = `test_b_${testRunId}@nexa-test.internal`;
  const testPassword = 'Password123!';

  const record = (step: string, success: boolean, details: string) => {
    const status: 'PASS' | 'FAIL' = success ? 'PASS' : 'FAIL';
    results.push({ step, status, details });
    console.log(`${success ? 'âœ… [PASS]' : 'âŒ [FAIL]'} ${step}: ${details}`);
  };

  // 1. PostgreSQL Database Health & Provider
  try {
    const res = await fetch(`${normalizedBase}/api/health`);
    const json = await res.json();
    const isPostgres = json.data?.database?.provider === 'postgres' || json.data?.mode === 'postgres';
    const isReachable = json.data?.database?.reachable === true;

    if (res.status === 200 && isPostgres && isReachable) {
      record('1. Database Health (PostgreSQL)', true, 'PostgreSQL active and reachable');
    } else {
      record('1. Database Health (PostgreSQL)', false, `HTTP ${res.status} - mode: ${json.data?.mode}, reachable: ${json.data?.database?.reachable}`);
    }
  } catch (err: any) {
    record('1. Database Health (PostgreSQL)', false, err.message);
  }

  // 2. User Registration (User A)
  try {
    const res = await fetch(`${normalizedBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: userAUsername,
        email: userAEmail,
        password: testPassword,
        displayName: `Test User A (${testRunId})`
      })
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.accessToken && json.data?.user?.userId) {
      userAToken = json.data.accessToken;
      userAId = json.data.user.userId;
      record('2. User Registration', true, `Created test user A [ID: ${userAId}]`);
    } else {
      record('2. User Registration', false, `HTTP ${res.status}: ${json.error?.message || 'Registration failed'}`);
    }
  } catch (err: any) {
    record('2. User Registration', false, err.message);
  }

  // 3. User Registration (User B)
  try {
    const res = await fetch(`${normalizedBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: userBUsername,
        email: userBEmail,
        password: testPassword,
        displayName: `Test User B (${testRunId})`
      })
    });
    const json = await res.json();
    if (res.status === 201 && json.data?.accessToken && json.data?.user?.userId) {
      userBToken = json.data.accessToken;
      userBId = json.data.user.userId;
      record('3. Secondary User Registration', true, `Created test user B [ID: ${userBId}]`);
    } else {
      record('3. Secondary User Registration', false, `HTTP ${res.status}: ${json.error?.message || 'Registration failed'}`);
    }
  } catch (err: any) {
    record('3. Secondary User Registration', false, err.message);
  }

  // 4. Login & JWT Authentication
  try {
    const res = await fetch(`${normalizedBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrUsername: userAEmail,
        password: testPassword
      })
    });
    const json = await res.json();
    if (res.status === 200 && json.data?.accessToken) {
      userAToken = json.data.accessToken;
      record('4. Login & JWT Authentication', true, 'Valid access token issued and verified');
    } else {
      record('4. Login & JWT Authentication', false, `HTTP ${res.status}: ${json.error?.message || 'Login failed'}`);
    }
  } catch (err: any) {
    record('4. Login & JWT Authentication', false, err.message);
  }

  const headerA = { 'Authorization': `Bearer ${userAToken}`, 'Content-Type': 'application/json' };
  const headerB = { 'Authorization': `Bearer ${userBToken}`, 'Content-Type': 'application/json' };

  // 5. Profiles & Profile Updates
  if (userAToken && userAId) {
    try {
      const getRes = await fetch(`${normalizedBase}/api/users/username/${userAUsername}`, { headers: headerA });
      const updateRes = await fetch(`${normalizedBase}/api/users/${userAId}`, {
        method: 'PUT',
        headers: headerA,
        body: JSON.stringify({ displayName: `Updated User A (${testRunId})`, bio: '[TEST] Automated verification passed' })
      });
      const updateJson = await updateRes.json();

      if (getRes.status === 200 && updateRes.status === 200 && updateJson.data?.bio?.includes('[TEST]')) {
        record('5. Profiles & Profile Updates', true, 'Profile retrieved and bio updated');
      } else {
        record('5. Profiles & Profile Updates', false, `get=${getRes.status}, update=${updateRes.status}`);
      }
    } catch (err: any) {
      record('5. Profiles & Profile Updates', false, err.message);
    }
  } else {
    record('5. Profiles & Profile Updates', false, 'Skipped due to missing authentication token');
  }

  // 6. Posts & Timeline Feed
  if (userAToken) {
    try {
      const postRes = await fetch(`${normalizedBase}/api/posts/create`, {
        method: 'POST',
        headers: headerA,
        body: JSON.stringify({ content: `[TEST] PostgreSQL verification post #${testRunId}` })
      });
      const postJson = await postRes.json();
      if (postRes.status === 201 && postJson.data?.postId) {
        createdPostId = postJson.data.postId;
        const feedRes = await fetch(`${normalizedBase}/api/posts/feed`, { headers: headerA });
        const feedJson = await feedRes.json();
        const foundInFeed = Array.isArray(feedJson.data) && feedJson.data.some((p: any) => p.postId === createdPostId);
        if (feedRes.status === 200 && foundInFeed) {
          record('6. Posts & Feed Creation', true, `Created post [ID: ${createdPostId}] and verified in feed`);
        } else {
          record('6. Posts & Feed Creation', false, `Post created but feed verification failed (HTTP ${feedRes.status})`);
        }
      } else {
        record('6. Posts & Feed Creation', false, `HTTP ${postRes.status}: ${postJson.error?.message || 'Create post failed'}`);
      }
    } catch (err: any) {
      record('6. Posts & Feed Creation', false, err.message);
    }
  } else {
    record('6. Posts & Feed Creation', false, 'Skipped due to missing authentication token');
  }

  // 7. Likes & Comments
  if (userBToken && createdPostId) {
    try {
      const likeRes = await fetch(`${normalizedBase}/api/posts/${createdPostId}/like`, { method: 'POST', headers: headerB });
      const commentRes = await fetch(`${normalizedBase}/api/posts/${createdPostId}/comment`, {
        method: 'POST',
        headers: headerB,
        body: JSON.stringify({ content: `[TEST] Verified comment on post #${createdPostId}` })
      });
      const commentJson = await commentRes.json();

      if (likeRes.status === 200 && commentRes.status === 201 && commentJson.data?.commentId) {
        record('7. Likes & Comments', true, `Liked post #${createdPostId} & created comment [ID: ${commentJson.data.commentId}]`);
      } else {
        record('7. Likes & Comments', false, `like=${likeRes.status}, comment=${commentRes.status}`);
      }
    } catch (err: any) {
      record('7. Likes & Comments', false, err.message);
    }
  } else {
    record('7. Likes & Comments', false, 'Skipped due to missing prerequisite post/token');
  }

  // 8. Follow System & Search
  if (userAToken && userBId) {
    try {
      const followRes = await fetch(`${normalizedBase}/api/users/${userBId}/follow`, { method: 'POST', headers: headerA });
      const searchRes = await fetch(`${normalizedBase}/api/users/search?q=${userBUsername}`, { headers: headerA });
      const searchJson = await searchRes.json();
      const foundInSearch = Array.isArray(searchJson.data) && searchJson.data.some((u: any) => u.userId === userBId);

      if (followRes.status === 200 && searchRes.status === 200 && foundInSearch) {
        record('8. Follow System & User Search', true, `Followed user [ID: ${userBId}] & verified in search index`);
      } else {
        record('8. Follow System & User Search', false, `follow=${followRes.status}, search=${searchRes.status}`);
      }
    } catch (err: any) {
      record('8. Follow System & User Search', false, err.message);
    }
  } else {
    record('8. Follow System & User Search', false, 'Skipped due to missing target user');
  }

  // 9. Stories
  if (userAToken) {
    try {
      const storyRes = await fetch(`${normalizedBase}/api/stories`, {
        method: 'POST',
        headers: headerA,
        body: JSON.stringify({
          mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500',
          caption: `[TEST] Story #${testRunId}`
        })
      });
      const storyJson = await storyRes.json();
      const feedRes = await fetch(`${normalizedBase}/api/stories/feed`, { headers: headerA });

      if (storyRes.status === 201 && storyJson.data?.storyId && feedRes.status === 200) {
        createdStoryId = storyJson.data.storyId;
        record('9. 24-Hour Stories', true, `Created story [ID: ${createdStoryId}] and queried feed`);
      } else {
        record('9. 24-Hour Stories', false, `HTTP ${storyRes.status}: ${storyJson.error?.message || 'Story creation failed'}`);
      }
    } catch (err: any) {
      record('9. 24-Hour Stories', false, err.message);
    }
  } else {
    record('9. 24-Hour Stories', false, 'Skipped due to missing token');
  }

  // 10. Reels
  if (userAToken) {
    try {
      const reelRes = await fetch(`${normalizedBase}/api/reels`, {
        method: 'POST',
        headers: headerA,
        body: JSON.stringify({
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          caption: `[TEST] Reel #${testRunId}`
        })
      });
      const reelJson = await reelRes.json();
      const feedRes = await fetch(`${normalizedBase}/api/reels`, { headers: headerA });

      if (reelRes.status === 201 && reelJson.data?.reelId && feedRes.status === 200) {
        createdReelId = reelJson.data.reelId;
        record('10. Reels & Discovery Feed', true, `Published reel [ID: ${createdReelId}] and queried feed`);
      } else {
        record('10. Reels & Discovery Feed', false, `HTTP ${reelRes.status}: ${reelJson.error?.message || 'Reel creation failed'}`);
      }
    } catch (err: any) {
      record('10. Reels & Discovery Feed', false, err.message);
    }
  } else {
    record('10. Reels & Discovery Feed', false, 'Skipped due to missing token');
  }

  // 11. Notifications
  if (userBToken) {
    try {
      const notifRes = await fetch(`${normalizedBase}/api/notifications`, { headers: headerB });
      const notifJson = await notifRes.json();
      if (notifRes.status === 200 && Array.isArray(notifJson.data)) {
        record('11. Notifications System', true, `Retrieved ${notifJson.data.length} notification(s) for user B`);
      } else {
        record('11. Notifications System', false, `HTTP ${notifRes.status}: ${notifJson.error?.message || 'Notification lookup failed'}`);
      }
    } catch (err: any) {
      record('11. Notifications System', false, err.message);
    }
  } else {
    record('11. Notifications System', false, 'Skipped due to missing token');
  }

  // 12. Direct Messages & Read Receipts
  if (userAToken && userBId) {
    try {
      const sendRes = await fetch(`${normalizedBase}/api/messages`, {
        method: 'POST',
        headers: headerA,
        body: JSON.stringify({ receiverId: userBId, content: `[TEST] Direct message #${testRunId}` })
      });
      const sendJson = await sendRes.json();

      if (sendRes.status === 201 && sendJson.data?.messageId) {
        createdMessageId = sendJson.data.messageId;
        const readRes = await fetch(`${normalizedBase}/api/messages/${createdMessageId}/read`, { method: 'POST', headers: headerB });
        const readJson = await readRes.json();

        if (readRes.status === 200 && readJson.data?.read === true) {
          record('12. Direct Messages & Read Receipts', true, `Sent message [ID: ${createdMessageId}] & marked read`);
        } else {
          record('12. Direct Messages & Read Receipts', false, `Sent message but mark read returned HTTP ${readRes.status}`);
        }
      } else {
        record('12. Direct Messages & Read Receipts', false, `HTTP ${sendRes.status}: ${sendJson.error?.message || 'Send message failed'}`);
      }
    } catch (err: any) {
      record('12. Direct Messages & Read Receipts', false, err.message);
    }
  } else {
    record('12. Direct Messages & Read Receipts', false, 'Skipped due to missing target user');
  }

  // 13. Socket.IO Genuine Live WebSocket Connection Test
  if (userAToken) {
    let socket: Socket | null = null;
    try {
      const connectionPromise = new Promise<{ connected: boolean; socketId?: string; error?: string }>((resolve) => {
        const timeout = setTimeout(() => {
          if (socket) socket.disconnect();
          resolve({ connected: false, error: 'Connection timed out after 8000ms' });
        }, 8000);

        socket = io(normalizedBase, {
          auth: { token: `Bearer ${userAToken}` },
          transports: ['websocket', 'polling'],
          timeout: 8000,
          reconnection: false
        });

        socket.on('connect', () => {
          clearTimeout(timeout);
          const socketId = socket?.id;
          resolve({ connected: true, socketId });
        });

        socket.on('connect_error', (err) => {
          clearTimeout(timeout);
          resolve({ connected: false, error: err.message });
        });
      });

      const outcome = await connectionPromise;

      if (socket) {
        (socket as Socket).disconnect();
      }

      if (outcome.connected) {
        record('13. Socket.IO Realtime Connection', true, `Live WebSocket connected & authenticated [Socket ID: ${outcome.socketId}]`);
      } else {
        record('13. Socket.IO Realtime Connection', false, `Connection failed: ${outcome.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      if (socket) (socket as Socket).disconnect();
      record('13. Socket.IO Realtime Connection', false, err.message);
    }
  } else {
    record('13. Socket.IO Realtime Connection', false, 'Skipped due to missing user token');
  }

  // Final Summary Matrix
  console.log(`\n======================================================`);
  console.log(`ðŸ“Š FINAL PRODUCTION VERIFICATION MATRIX`);
  console.table(results);
  console.log(`======================================================\n`);

  return results;
}

if (process.argv[1]?.endsWith('verify_production_workflow.ts')) {
  const target = process.env.RENDER_BACKEND_URL || process.argv[2] || 'https://nexa-backend-in6s.onrender.com';
  runProductionVerification(target).then((res) => {
    const hasFailures = res.some((r) => r.status === 'FAIL');
    if (hasFailures) {
      process.exitCode = 1;
    }
  });
}
