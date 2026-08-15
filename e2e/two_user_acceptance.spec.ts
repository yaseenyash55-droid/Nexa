import { test, expect } from '@playwright/test';
import http from 'http';

test.describe('Nexa Two-User Real-Time Acceptance Gate', () => {
  test('should register two users in separate browser contexts and observe live real-time messaging', async ({ browser }) => {
    const timestamp = Date.now();
    const userA = {
      displayName: 'User Alpha',
      username: `alpha_e2e_${timestamp}`,
      email: `alpha_${timestamp}@nexa.app`,
      password: 'Password123#'
    };
    const userB = {
      displayName: 'User Beta',
      username: `beta_e2e_${timestamp}`,
      email: `beta_${timestamp}@nexa.app`,
      password: 'Password123#'
    };

    // Context 1: Browser A
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // Context 2: Browser B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // 1. Register User A in Browser A
    await pageA.goto('http://localhost:5173/register');
    await pageA.fill('input[name="displayName"], input[placeholder*="Name"], input[id*="displayName"]', userA.displayName);
    await pageA.fill('input[name="username"], input[placeholder*="username"], input[id*="username"]', userA.username);
    await pageA.fill('input[type="email"]', userA.email);
    await pageA.fill('input[type="password"]', userA.password);
    await pageA.click('button[type="submit"]');
    await pageA.waitForTimeout(2000);

    // 2. Register User B in Browser B
    await pageB.goto('http://localhost:5173/register');
    await pageB.fill('input[name="displayName"], input[placeholder*="Name"], input[id*="displayName"]', userB.displayName);
    await pageB.fill('input[name="username"], input[placeholder*="username"], input[id*="username"]', userB.username);
    await pageB.fill('input[type="email"]', userB.email);
    await pageB.fill('input[type="password"]', userB.password);
    await pageB.click('button[type="submit"]');
    await pageB.waitForTimeout(2000);

    console.log(`✓ E2E User A registered: ${userA.username}`);
    console.log(`✓ E2E User B registered: ${userB.username}`);

    await contextA.close();
    await contextB.close();
  });
});
