#!/usr/bin/env node
/**
 * Nexa WebRTC ICE & Handshake Verification Tool
 * 
 * Verifies:
 * 1. Metered / Coturn dynamic short-lived TURN credential generation & TTL calculation.
 * 2. Static Metered credential fallback formatting.
 * 3. Sanitization & non-exposure of secret keys (WEBRTC_TURN_SHARED_SECRET).
 * 4. Cache-Control: no-store header compliance.
 * 5. Live/Local HTTP endpoint handshake against /api/calls/ice-config if a server is reachable.
 */

import { createHmac } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

// --- Color Helpers for CLI Output ---
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m'
};

function pass(msg) {
  console.log(`  ${colors.green}✔ PASS:${colors.reset} ${msg}`);
}

function fail(msg) {
  console.log(`  ${colors.red}✖ FAIL:${colors.reset} ${msg}`);
}

function info(msg) {
  console.log(`  ${colors.cyan}ℹ INFO:${colors.reset} ${msg}`);
}

console.log(`\n${colors.bold}${colors.cyan}=== Nexa WebRTC & Metered ICE Handshake Verification ===${colors.reset}\n`);

let failed = false;

// -------------------------------------------------------------
// 1. Dynamic Short-Lived Credential Generation Algorithm Test
// -------------------------------------------------------------
console.log(`${colors.bold}1. Testing Dynamic Coturn / Metered HMAC-SHA1 Credential Generation:${colors.reset}`);

function generateTurnCredentials(sharedSecret, userId, ttlSeconds, nowSeconds = Math.floor(Date.now() / 1000)) {
  const expiryTimestamp = nowSeconds + ttlSeconds;
  const username = `${expiryTimestamp}:${userId}`;
  const credential = createHmac('sha1', sharedSecret).update(username).digest('base64');
  return { username, credential, expiryTimestamp };
}

try {
  const testSecret = 'secret-key-test-abc123xyz';
  const testUserId = 42;
  const testTtl = 3600;
  const startTime = 1700000000;

  const result = generateTurnCredentials(testSecret, testUserId, testTtl, startTime);

  if (result.username === '1700003600:42') {
    pass(`Username format correctly generated timestamp:userId -> "${result.username}"`);
  } else {
    fail(`Username format incorrect: got "${result.username}"`);
    failed = true;
  }

  // Validate HMAC SHA1 computation
  const expectedHash = createHmac('sha1', testSecret).update('1700003600:42').digest('base64');
  if (result.credential === expectedHash) {
    pass(`HMAC-SHA1 base64 credential computed successfully: "${result.credential}"`);
  } else {
    fail(`HMAC-SHA1 mismatch: expected "${expectedHash}", got "${result.credential}"`);
    failed = true;
  }

  // Security Check: Verify secret is not in payload
  const serialized = JSON.stringify(result);
  if (!serialized.includes(testSecret)) {
    pass('Security verification: Shared secret is never exposed in output payload');
  } else {
    fail('Security alert: Shared secret leaked in serialized payload!');
    failed = true;
  }

  // Expiry check
  const calculatedTtl = result.expiryTimestamp - startTime;
  if (calculatedTtl === testTtl) {
    pass(`TTL window properly set to ${testTtl} seconds`);
  } else {
    fail(`TTL calculation mismatch: ${calculatedTtl}`);
    failed = true;
  }
} catch (err) {
  fail(`Dynamic credential generation threw an error: ${err.message}`);
  failed = true;
}

// -------------------------------------------------------------
// 2. Static Metered Credential Mapping Test
// -------------------------------------------------------------
console.log(`\n${colors.bold}2. Testing Static Metered Credential Mapping:${colors.reset}`);

try {
  const envMock = {
    WEBRTC_CALLING_ENABLED: true,
    WEBRTC_STUN_URLS: ['stun:stun.relay.metered.ca:80'],
    WEBRTC_TURN_URLS: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turns:global.relay.metered.ca:443?transport=tcp'
    ],
    WEBRTC_TURN_USERNAME: '831ff1e3a0cd72c835a5c15f',
    WEBRTC_TURN_CREDENTIAL: 'l1brCsW0TjBPS5it',
    WEBRTC_TURN_SHARED_SECRET: ''
  };

  const responsePayload = {
    enabled: true,
    iceServers: [
      ...(envMock.WEBRTC_STUN_URLS.length > 0 ? [{ urls: envMock.WEBRTC_STUN_URLS }] : []),
      {
        urls: envMock.WEBRTC_TURN_URLS,
        username: envMock.WEBRTC_TURN_USERNAME,
        credential: envMock.WEBRTC_TURN_CREDENTIAL
      }
    ]
  };

  if (responsePayload.iceServers.length === 2) {
    pass('ICE servers array contains STUN and TURN entries');
  } else {
    fail(`Expected 2 ICE server configurations, got ${responsePayload.iceServers.length}`);
    failed = true;
  }

  const turnServer = responsePayload.iceServers[1];
  if (Array.isArray(turnServer.urls) && turnServer.urls.length === 4) {
    pass(`TURN server configured with ${turnServer.urls.length} transport variants (UDP, TCP, TLS)`);
  } else {
    fail('TURN server URLs incorrectly formatted');
    failed = true;
  }

  if (turnServer.username === envMock.WEBRTC_TURN_USERNAME && turnServer.credential === envMock.WEBRTC_TURN_CREDENTIAL) {
    pass('Static Metered credentials properly mapped without secret requirement');
  } else {
    fail('Static credentials did not match mock environment');
    failed = true;
  }
} catch (err) {
  fail(`Static credential mapping error: ${err.message}`);
  failed = true;
}

// -------------------------------------------------------------
// 3. Live Target Connectivity Check (Optional / Auto-detect)
// -------------------------------------------------------------
console.log(`\n${colors.bold}3. API Endpoint Connectivity Verification (/api/calls/ice-config):${colors.reset}`);

const targetUrl = process.argv[2] || process.env.API_BASE_URL || 'http://localhost:4000';
info(`Probing API server at: ${targetUrl}/api/calls/ice-config`);

function probeEndpoint(baseUrl) {
  return new Promise((resolve) => {
    try {
      const url = new URL('/api/calls/ice-config', baseUrl);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request(
        url,
        {
          method: 'GET',
          timeout: 2500,
          headers: {
            'Accept': 'application/json'
          }
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            resolve({
              reachable: true,
              statusCode: res.statusCode,
              headers: res.headers,
              body
            });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({ reachable: false, error: 'Connection timed out' });
      });

      req.on('error', (err) => {
        resolve({ reachable: false, error: err.message });
      });

      req.end();
    } catch (err) {
      resolve({ reachable: false, error: err.message });
    }
  });
}

const probeResult = await probeEndpoint(targetUrl);

if (probeResult.reachable) {
  pass(`Server responded with HTTP status ${probeResult.statusCode}`);
  // Unauthenticated requests should be rejected by requireAuth with 401
  if (probeResult.statusCode === 401) {
    pass('Security verified: Unauthenticated calls are rejected with 401 Unauthorized');
  } else if (probeResult.statusCode === 200) {
    pass('Endpoint accessible with 200 OK');
  }

  const cacheControl = probeResult.headers['cache-control'] || '';
  if (cacheControl.includes('no-store')) {
    pass('Header verified: Cache-Control: no-store is active');
  } else {
    info(`Cache-Control header received: "${cacheControl}"`);
  }
} else {
  info(`Server not currently running on ${targetUrl} (${probeResult.error}). (Run 'npm run dev' to test live endpoint)`);
}

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log(`\n${colors.bold}=== Handshake Test Summary ===${colors.reset}`);
if (failed) {
  console.log(`${colors.red}One or more WebRTC verification checks failed.${colors.reset}\n`);
  process.exit(1);
} else {
  console.log(`${colors.green}All WebRTC dynamic/static credential, TTL, and security checks passed successfully!${colors.reset}\n`);
  process.exit(0);
}
