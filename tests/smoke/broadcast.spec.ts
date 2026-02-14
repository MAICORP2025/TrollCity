import { test, expect } from '@playwright/test';
import { attachDiagnostics, login, setupDiagnostics, TEST_USERS } from './utils';

test('broadcast setup page loads without starting stream', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.user.email, TEST_USERS.user.password);
  await page.goto('/broadcast/setup');

  const goLiveHeading = page.getByRole('heading', { name: 'Go Live' });
  const restrictionHeading = page.getByRole('heading', { name: /Driver's License Required|Account in Cooldown/i });

  await expect(goLiveHeading.or(restrictionHeading)).toBeVisible();

  await attachDiagnostics(testInfo, diagnostics);
});
