import { test, expect } from '@playwright/test';

test.describe('Nexa Multi-User Real-Time Interactivity Suite', () => {
  test('Two authenticated users can view real-time chat interface concurrently', async ({ browser }) => {
    const userA = { userId: 601, username: 'alpha_realtime', displayName: 'Alpha User', email: 'alpha@nexa.internal' };
    const userB = { userId: 602, username: 'beta_realtime', displayName: 'Beta User', email: 'beta@nexa.internal' };

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Context A Mocks
    await pageA.route('**/api/auth/refresh', async (r) => {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user: userA, accessToken: 'tok_a' } }) });
    });
    await pageA.route('**/api/auth/me', async (r) => {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: userA }) });
    });
    await pageA.route('**/api/users/suggestions', async (r) => {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [userB] }) });
    });
    await pageA.route('**/api/groups', async (r) => {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await pageA.route('**/api/broadcasts', async (r) => {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    // Context B Mocks
    await pageB.route('**/api/auth/refresh', async (r) => {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user: userB, accessToken: 'tok_b' } }) });
    });
    await pageB.route('**/api/auth/me', async (r) => {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: userB }) });
    });
    await pageB.route('**/api/users/suggestions', async (r) => {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [userA] }) });
    });
    await pageB.route('**/api/groups', async (r) => {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await pageB.route('**/api/broadcasts', async (r) => {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    await pageA.goto('/messages');
    await pageB.goto('/messages');

    // Assert User A sees User B in suggestions
    await expect(pageA.locator(`text=${userB.displayName}`).first()).toBeVisible();

    // Assert User B sees User A in suggestions
    await expect(pageB.locator(`text=${userA.displayName}`).first()).toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});
