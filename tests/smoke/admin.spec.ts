import { test, expect } from '@playwright/test';
import { attachDiagnostics, login, setupDiagnostics, TEST_USERS } from './utils';

test('admin dashboard loads and key tiles visible', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Troll City Command Center' })).toBeVisible();
  await expect(page.getByText('Ban Management')).toBeVisible();

  await attachDiagnostics(testInfo, diagnostics);
});

test('admin payouts page loads', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  await page.goto('/admin/payouts');

  await expect(page.getByRole('heading', { name: 'Admin – Payout Requests' })).toBeVisible();

  await attachDiagnostics(testInfo, diagnostics);
});

test('admin payments dashboard loads', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  await page.goto('/admin/payments');

  await expect(page.getByRole('heading', { name: 'Payments Dashboard' })).toBeVisible();

  await attachDiagnostics(testInfo, diagnostics);
});
