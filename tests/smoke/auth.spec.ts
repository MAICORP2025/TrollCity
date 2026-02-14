import { test, expect } from '@playwright/test';
import { attachDiagnostics, login, logout, setupDiagnostics, TEST_USERS } from './utils';

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(10000);
});

test('login and logout flow works', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.user.email, TEST_USERS.user.password);
  await expect(page.getByRole('heading', { name: 'City Feed' })).toBeVisible();

  await logout(page);
  await expect(page).toHaveURL(/\/auth/);

  await attachDiagnostics(testInfo, diagnostics);
});

test('invalid password shows error', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await page.goto('/auth');
  await page.getByPlaceholder('Email address').fill(TEST_USERS.user.email);
  await page.getByPlaceholder('Password').fill('WrongPassword123!');
  // Use form scoped button to avoid strict mode violation
  await page.locator('form').getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByText(/invalid email or password/i)).toBeVisible();

  await attachDiagnostics(testInfo, diagnostics);
});
