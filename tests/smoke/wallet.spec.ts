import { test, expect } from '@playwright/test';
import { attachDiagnostics, login, setupDiagnostics, TEST_USERS } from './utils';

test('wallet loads and shows balance widgets', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.user.email, TEST_USERS.user.password);
  await page.goto('/wallet');

  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  await expect(page.getByText('Available Coins')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();

  await attachDiagnostics(testInfo, diagnostics);
});
