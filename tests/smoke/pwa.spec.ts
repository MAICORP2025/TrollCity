import { test, expect } from '@playwright/test';
import { attachDiagnostics, assertNoHorizontalOverflow, getPathname, login, setupDiagnostics, TEST_USERS } from './utils';

test('mobile shell layout remains within viewport', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.user.email, TEST_USERS.user.password);
  await page.goto('/mobile');

  const currentPath = getPathname(page);
  if (currentPath === '/login' || currentPath === '/auth') {
    throw new Error(`Mobile shell redirected to ${currentPath}`);
  }

  await expect(page.getByText('Mobile Control Center')).toBeVisible();
  await assertNoHorizontalOverflow(page);

  await attachDiagnostics(testInfo, diagnostics);
});
