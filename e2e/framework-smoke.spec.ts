import { expect, test } from '@playwright/test';

test('login hydrates and protects dashboard navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Email')).toBeVisible();
  expect(errors).toEqual([]);
});

test('public share route resolves its asynchronous route parameter', async ({ page }) => {
  let requestedToken = false;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://placeholder.supabase.co/rest/v1/projects*', async route => {
    requestedToken = route.request().url().includes('public_share_token=eq.missing-fixture');
    await route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'No rows' }) });
  });
  await page.goto('/share/missing-fixture');
  await expect(page.getByText(/not found/i)).toBeVisible();
  expect(requestedToken).toBe(true);
  expect(errors).toEqual([]);
});

test('server dynamic params render and admin API rejects unauthenticated access', async ({ request }) => {
  const response = await request.get('/test/release-smoke');
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('release-smoke');
  for (const path of ['/api/admin/analytics', '/api/admin/users', '/api/admin/boards']) {
    const api = await request.get(path);
    expect(api.status(), path).toBe(401);
  }
});
