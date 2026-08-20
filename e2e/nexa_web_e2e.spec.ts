import { test, expect } from '@playwright/test';

test.describe('Nexa Comprehensive E2E Web Acceptance Suite', () => {

  test('1. Registration Client Validation & Success Flow', async ({ page }) => {
    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'User registered successfully',
          data: {
            user: {
              userId: 101,
              username: 'new_automation_user',
              email: 'automation@nexa.internal',
              displayName: 'Automation Tester'
            },
            accessToken: 'mock_jwt_token_for_e2e'
          }
        })
      });
    });

    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: {
              userId: 101,
              username: 'new_automation_user',
              email: 'automation@nexa.internal',
              displayName: 'Automation Tester'
            },
            accessToken: 'mock_jwt_token_for_e2e'
          }
        })
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            userId: 101,
            username: 'new_automation_user',
            email: 'automation@nexa.internal',
            displayName: 'Automation Tester'
          }
        })
      });
    });

    await page.route('**/api/posts/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { hasMore: false } })
      });
    });

    await page.goto('/register');
    await expect(page.locator('h1')).toContainText(/Create your Nexa Account/i);

    // Client validation on invalid submit
    const submitBtn = page.getByRole('button', { name: /Create Account/i });
    await submitBtn.click();
    await expect(page.locator('text=Username must be at least 3 characters')).toBeVisible();

    // Fill valid registration fields
    await page.locator('#register-displayName').fill('Automation Tester');
    await page.locator('#register-username').fill('new_automation_user');
    await page.locator('#register-email').fill('automation@nexa.internal');
    await page.locator('#register-password').fill('SecurePassword123#');

    await submitBtn.click();

    // Observable navigation to home
    await expect(page).toHaveURL('/');
  });

  test('2. Registration Duplicate 409 Conflict Error Display', async ({ page }) => {
    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: 'Username or email already in use'
          }
        })
      });
    });

    await page.goto('/register');
    await page.locator('#register-displayName').fill('Duplicate User');
    await page.locator('#register-username').fill('existing_user');
    await page.locator('#register-email').fill('existing@nexa.internal');
    await page.locator('#register-password').fill('SecurePassword123#');

    await page.getByRole('button', { name: /Create Account/i }).click();

    // Assert exact 409 alert outcome
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Username or email already in use');
  });

  test('3. Login, Authenticated Session State and Sign Out Flow', async ({ page }) => {
    const mockUser = {
      userId: 42,
      username: 'sarah_dev',
      email: 'sarah@nexa.internal',
      displayName: 'Sarah Developer'
    };

    let isLoggedIn = false;

    await page.route('**/api/auth/refresh', async (route) => {
      if (isLoggedIn) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user: mockUser,
              accessToken: 'mock_valid_access_token'
            }
          })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'No session' } })
        });
      }
    });

    await page.route('**/api/auth/me', async (route) => {
      if (isLoggedIn) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockUser })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'No session' } })
        });
      }
    });

    await page.route('**/api/auth/login', async (route) => {
      isLoggedIn = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Login successful',
          data: {
            user: mockUser,
            accessToken: 'mock_valid_access_token'
          }
        })
      });
    });

    await page.route('**/api/auth/logout', async (route) => {
      isLoggedIn = false;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Logged out successfully' })
      });
    });

    await page.route('**/api/posts/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { hasMore: false } })
      });
    });

    await page.goto('/login');
    await expect(page.locator('h1')).toContainText(/Sign in to Nexa/i);

    // Fill credentials
    await page.locator('input[name="emailOrUsername"]').fill('sarah@nexa.internal');
    await page.locator('input[name="password"]').fill('ValidPassword123#');

    await page.getByRole('button', { name: /Sign In/i }).click();

    // Authenticated redirect to home
    await expect(page).toHaveURL('/');

    // Perform sign out via sidebar navigation
    const signOutBtn = page.locator('button[title="Log out"]').first();
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Assert return to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('4. Search and User Discovery Result Content', async ({ page }) => {
    const mockSearchResults = [
      {
        userId: 201,
        username: 'sarah_creator',
        displayName: 'Sarah Connor',
        bio: 'Leading high-tech innovation',
        profileImageUrl: null
      }
    ];

    await page.route('**/api/users/search?q=sarah', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockSearchResults })
      });
    });

    await page.goto('/search?q=sarah');
    await expect(page.locator('h2')).toContainText('Search Results for "sarah"');
    await expect(page.locator('text=Sarah Connor')).toBeVisible();
    await expect(page.locator('text=@sarah_creator')).toBeVisible();
    await expect(page.locator('text=Leading high-tech innovation')).toBeVisible();
  });

  test('5. Post Feed Interactions: Like and Bookmark Persistence', async ({ page }) => {
    const mockUser = {
      userId: 10,
      username: 'alex_lead',
      displayName: 'Alex Lead',
      email: 'alex@nexa.internal'
    };

    const mockPost = {
      postId: 777,
      content: 'E2E Testing Nexa on Oracle DB with full test validation',
      author: {
        userId: 10,
        username: 'alex_lead',
        displayName: 'Alex Lead',
        profileImageUrl: null
      },
      likesCount: 15,
      commentsCount: 3,
      isLiked: false,
      isBookmarked: false,
      createdAt: new Date().toISOString()
    };

    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: mockUser,
            accessToken: 'mock_jwt_token_for_e2e'
          }
        })
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockUser })
      });
    });

    await page.route('**/api/posts/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [mockPost], meta: { hasMore: false } })
      });
    });

    await page.route('**/api/posts/777/like', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { liked: true, likesCount: 16 } })
      });
    });

    await page.route('**/api/posts/777/bookmark', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { bookmarked: true } })
      });
    });

    await page.goto('/');
    await expect(page.locator('text=E2E Testing Nexa on Oracle DB')).toBeVisible();

    // Like button interaction
    const likeBtn = page.getByRole('button', { name: '15' });
    await expect(likeBtn).toBeVisible();
    await likeBtn.click();
    await expect(page.getByRole('button', { name: '16' })).toBeVisible();

    // Bookmark button interaction
    const bookmarkBtn = page.locator('button[title="Bookmark post"]');
    await expect(bookmarkBtn).toBeVisible();
    await bookmarkBtn.click();
    await expect(bookmarkBtn.locator('svg')).toHaveClass(/fill-current/);
  });

  test('6. Two-User Multi-Context Direct Messaging View', async ({ browser }) => {
    const userA = { userId: 501, username: 'alpha_user', displayName: 'Alpha User', email: 'alpha@nexa.internal' };
    const userB = { userId: 502, username: 'beta_user', displayName: 'Beta User', email: 'beta@nexa.internal' };

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Setup User A
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

    // Setup User B
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

    // Both contexts render the messaging interface and contact list
    await expect(pageA.locator(`text=${userB.displayName}`).first()).toBeVisible();
    await expect(pageB.locator(`text=${userA.displayName}`).first()).toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test('7. Resilient Error Handling on Server 500 Degradation', async ({ page }) => {
    await page.route('**/api/posts/feed*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Database query execution failed'
          }
        })
      });
    });

    await page.goto('/');

    // Assert exact error component and retry trigger
    await expect(page.locator('text=Failed to load feed')).toBeVisible();
    await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible();
  });

});
