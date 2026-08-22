import { env } from '../src/config/env.js';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  details: string;
}

export async function runProductionVerification(baseUrl: string) {
  const results: TestResult[] = [];
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  console.log(`\n======================================================`);
  console.log(`🚀 NEXA LIVE PRODUCTION VERIFICATION SUITE`);
  console.log(`🎯 Target URL: ${normalizedBase}`);
  console.log(`======================================================\n`);

  let authToken = '';
  let testUserId = 0;
  const uniqueSuffix = Date.now().toString().slice(-6);
  const testUsername = `pgtest_${uniqueSuffix}`;
  const testEmail = `pgtest_${uniqueSuffix}@nexa.social`;

  // Step 1: Health Probe
  try {
    const res = await fetch(`${normalizedBase}/api/health`);
    const data = await res.json();
    if (res.status === 200 && data.data?.database?.provider === 'postgres') {
      results.push({ step: 'Database Health (PostgreSQL Reachable)', status: 'PASS', details: JSON.stringify(data.data.database) });
      console.log(`✅ [PASS] Health Check: Database is reachable via PostgreSQL`);
    } else {
      results.push({ step: 'Database Health (PostgreSQL Reachable)', status: 'FAIL', details: `Status ${res.status}: ${JSON.stringify(data)}` });
      console.log(`❌ [FAIL] Health Check: ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    results.push({ step: 'Database Health (PostgreSQL Reachable)', status: 'FAIL', details: err.message });
    console.log(`❌ [FAIL] Health Check: ${err.message}`);
  }

  // Step 2: Registration
  try {
    const res = await fetch(`${normalizedBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        email: testEmail,
        password: 'Password123!',
        displayName: `PG Tester ${uniqueSuffix}`
      })
    });
    const data = await res.json();
    if (res.status === 201 && data.data?.accessToken) {
      authToken = data.data.accessToken;
      testUserId = data.data.user.userId;
      results.push({ step: 'User Registration', status: 'PASS', details: `Created userId=${testUserId}` });
      console.log(`✅ [PASS] Registration: User created successfully (ID: ${testUserId})`);
    } else {
      results.push({ step: 'User Registration', status: 'FAIL', details: JSON.stringify(data) });
      console.log(`❌ [FAIL] Registration: ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    results.push({ step: 'User Registration', status: 'FAIL', details: err.message });
    console.log(`❌ [FAIL] Registration: ${err.message}`);
  }

  // Step 3: Login
  try {
    const res = await fetch(`${normalizedBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrUsername: testEmail,
        password: 'Password123!'
      })
    });
    const data = await res.json();
    if (res.status === 200 && data.data?.accessToken) {
      authToken = data.data.accessToken;
      results.push({ step: 'User Login & JWT', status: 'PASS', details: 'JWT issued successfully' });
      console.log(`✅ [PASS] Login: Authenticated and received fresh JWT`);
    } else {
      results.push({ step: 'User Login & JWT', status: 'FAIL', details: JSON.stringify(data) });
      console.log(`❌ [FAIL] Login: ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    results.push({ step: 'User Login & JWT', status: 'FAIL', details: err.message });
    console.log(`❌ [FAIL] Login: ${err.message}`);
  }

  const authHeader = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };

  // Step 4: Profile Lookup & Update
  if (authToken && testUserId) {
    try {
      const res = await fetch(`${normalizedBase}/api/users/username/${testUsername}`, { headers: authHeader });
      const data = await res.json();
      if (res.status === 200 && data.data?.username === testUsername) {
        results.push({ step: 'Profile Fetch', status: 'PASS', details: `Fetched profile ${testUsername}` });
        console.log(`✅ [PASS] Profile Lookup: Fetched profile`);
      } else {
        results.push({ step: 'Profile Fetch', status: 'FAIL', details: JSON.stringify(data) });
        console.log(`❌ [FAIL] Profile Lookup: ${JSON.stringify(data)}`);
      }
    } catch (err: any) {
      results.push({ step: 'Profile Fetch', status: 'FAIL', details: err.message });
    }
  }

  // Summary
  console.log(`\n======================================================`);
  console.log(`📊 SUMMARY OF PRODUCTION SUITE`);
  console.table(results);
  console.log(`======================================================\n`);
  return results;
}

if (process.argv[1]?.endsWith('verify_production_workflow.ts')) {
  const target = process.env.RENDER_BACKEND_URL || process.argv[2] || 'https://nexa-backend-in6s.onrender.com';
  runProductionVerification(target);
}
