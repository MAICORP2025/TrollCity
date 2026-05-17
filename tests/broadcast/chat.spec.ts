import { test, expect, Page } from '@playwright/test';
import { selectors, getTestUser } from '../selectors';

const DEV_URL = 'http://localhost:5173';

async function login(page: Page, user: ReturnType<typeof getTestUser>) {
  await page.goto(`${DEV_URL}/auth?mode=signin`);
  await page.fill(selectors.auth.emailInput, user.email);
  await page.fill(selectors.auth.passwordInput, user.password);
  await page.click(selectors.auth.signInButton);
  await page.waitForURL('/');
}

async function joinStream(page: Page, streamIdOrSlug: string) {
  await page.goto(`${DEV_URL}/broadcast/watch/${streamIdOrSlug}`);
  await page.waitForSelector('video', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

test.describe('Live Chat & Paid Chat Features', () => {
  test('regular user can send up to 5 free chat messages', async ({ page }) => {
    const user = getTestUser('richViewer');
    await login(page, user);
    await joinStream(page, 'free-chat-stream');

    for (let i = 1; i <= 5; i++) {
      await page.fill(selectors.chat.input, `Free message ${i}`);
      await page.press(selectors.chat.input, 'Enter');
      await page.waitForTimeout(300);
    }

    const count = await page.locator(selectors.chat.messageContainer).count();
    expect(count).toBe(5);
  });

  test('officer can send chat when paid chat is enabled', async ({ page }) => {
    const user = getTestUser('trollOfficer');
    await login(page, user);
    await joinStream(page, 'paid-per-user-stream');

    const paywall = page.locator(selectors.chat.paywallModal);
    await expect(paywall).not.toBeVisible();

    await page.fill(selectors.chat.input, 'Officer message bypassing paywall');
    await page.press(selectors.chat.input, 'Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Officer message bypassing paywall')).toBeVisible();
  });

  test('viewer must pay for per-user paid chat before sending', async ({ page }) => {
    const user = getTestUser('richViewer'); // has coins but hasn't paid
    await login(page, user);
    await joinStream(page, 'paid-per-user-stream');

    await page.fill(selectors.chat.input, 'Trying to chat');
    await page.press(selectors.chat.input, 'Enter');
    await expect(page.locator(selectors.chat.paywallModal)).toBeVisible({ timeout: 5000 });
  });

  test('jailed user cannot send chat messages', async ({ page }) => {
    const user = getTestUser('jailedUser');
    await login(page, user);
    await joinStream(page, 'any-live-stream');

    const onJailPage = page.url().includes('/jail');
    if (!onJailPage) {
      await page.fill(selectors.chat.input, 'I should not chat');
      await page.press(selectors.chat.input, 'Enter');
      await page.waitForTimeout(1000);
      await expect(page.locator(selectors.status.jailBanner)).toBeVisible();
    }
  });

  test('broadcaster can toggle paid chat on/off', async ({ page }) => {
    const user = getTestUser('broadcaster');
    await login(page, user);
    await page.goto(`${DEV_URL}/broadcast/host`);
    await page.waitForTimeout(3000);

    // Open More → Paid Chat
    await page.click(selectors.broadcast.moreMenuButton);
    await page.click(selectors.broadcast.paidChatSettings);

    // Toggle and save
    await page.click('text=Enable Paid Chat');
    await page.click(selectors.broadcast.saveSettingsButton);

    await expect(page.locator('text=Paid chat settings saved')).toBeVisible();
  });
});
