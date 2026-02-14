import { test, expect } from '@playwright/test';
import { attachDiagnostics, getPathname, login, setupDiagnostics, TEST_USERS } from './utils';

test('secretary console loads and cashouts tab accessible', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.secretary.email, TEST_USERS.secretary.password);
  await page.goto('/secretary');

  if (await page.getByRole('heading', { name: 'Access Denied' }).isVisible().catch(() => false)) {
    throw new Error('Secretary role redirected to Access Denied');
  }
  if (getPathname(page) === '/') {
    throw new Error('Secretary role redirected to Home');
  }

  await expect(page.getByRole('heading', { name: 'Secretary Console' })).toBeVisible();
  await page.getByRole('button', { name: /cashouts/i }).click();
  await expect(page.getByText('Payout Schedule')).toBeVisible();

  await attachDiagnostics(testInfo, diagnostics);
});

test('lead officer dashboard loads', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.leadOfficer.email, TEST_USERS.leadOfficer.password);
  await page.goto('/lead-officer');

  if (await page.getByRole('heading', { name: 'Access Denied' }).isVisible().catch(() => false)) {
    throw new Error('Lead officer role redirected to Access Denied');
  }
  if (getPathname(page) === '/') {
    throw new Error('Lead officer role redirected to Home');
  }

  await expect(page.getByRole('heading', { name: 'Troll Officer Command Center' })).toBeVisible();

  await attachDiagnostics(testInfo, diagnostics);
});

test('officer dashboard loads', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.officer.email, TEST_USERS.officer.password);
  await page.goto('/officer/dashboard');

  if (await page.getByRole('heading', { name: 'Access Denied' }).isVisible().catch(() => false)) {
    throw new Error('Officer role redirected to Access Denied');
  }
  if (getPathname(page) === '/') {
    throw new Error('Officer role redirected to Home');
  }

  await expect(page.getByRole('heading', { name: 'Officer Dashboard' })).toBeVisible();

  await attachDiagnostics(testInfo, diagnostics);
});

test('normal user blocked from admin routes', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.user.email, TEST_USERS.user.password);
  await page.goto('/admin');

  await expect(page).toHaveURL(/access-denied/);

  await attachDiagnostics(testInfo, diagnostics);
});

test('normal user blocked from officer dashboard', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.user.email, TEST_USERS.user.password);
  await page.goto('/officer/dashboard');

  await expect(page).toHaveURL(/access-denied/);

  await attachDiagnostics(testInfo, diagnostics);
});

test('normal user blocked from secretary console', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page);

  await login(page, TEST_USERS.user.email, TEST_USERS.user.password);
  await page.goto('/secretary');

  await expect(page.getByRole('heading', { name: 'Secretary Console' })).not.toBeVisible();
  await expect(page).toHaveURL(/access-denied|\/$/);

  await attachDiagnostics(testInfo, diagnostics);
});
