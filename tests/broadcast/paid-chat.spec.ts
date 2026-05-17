import { test, expect, Page } from '@playwright/test';

// Test users seeded by `npm run seed:test-users`
const TEST_USERS = {
  regularViewer: { email: 'viewer1@test.troll', password: 'password123', role: 'viewer' },
  paidUser: { email: 'paiduser@test.troll', password: 'password123', role: 'viewer', coins: 100 },
  officer: { email: 'officer@test.troll', password: 'password123', role: 'troll_officer' },
  leadOfficer: { email: 'lead@test.troll', password: 'password123', role: 'lead_troll_officer' },
  jailedUser: { email: 'jailed@test.troll', password: 'password123', role: 'viewer', jailed: true },
};

const DEV_URL = 'http://localhost:5173';

test.describe('Broadcast Chat Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEV_URL);
    // Clear storage to start fresh
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test('regular user can send up to 5 free chat messages', async ({ page }) => {
    // 1. Login
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.fill('[name="email"]', TEST_USERS.regularViewer.email);
    await page.fill('[name="password"]', TEST_USERS.regularViewer.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');

    // 2. Navigate to a live broadcast (needs seeded stream)
    await page.goto(`${DEV_URL}/broadcast/watch/seed-test-stream-1`);
    await page.waitForTimeout(3000); // wait for stream load

    // 3. Send 5 messages
    for (let i = 1; i <= 5; i++) {
      const chatInput = page.locator('textarea[placeholder*="Say something"]');
      await chatInput.fill(`Test message ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(500);
    }

    // 4. Verify messages appear in chat panel
    const chatMessages = page.locator('[data-testid="chat-message"]');
    await expect(chatMessages).toHaveCount(5);
  });

  test('officer can send unlimited chat even when paid chat is enabled', async ({ page }) => {
    // 1. Login as officer
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.fill('[name="email"]', TEST_USERS.officer.email);
    await page.fill('[name="password"]', TEST_USERS.officer.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');

    // 2. Go to broadcast
    await page.goto(`${DEV_URL}/broadcast/watch/seed-test-stream-1`);
    await page.waitForTimeout(3000);

    // 3. Officer should not see paywall
    const paywall = page.locator('text=Pay to chat');
    await expect(paywall).not.toBeVisible();

    // 4. Send messages freely
    const chatInput = page.locator('textarea[placeholder*="Say something"]');
    await chatInput.fill('Officer message 1');
    await chatInput.press('Enter');
    await page.waitForTimeout(500);

    // 5. Verify message appears
    const lastMessage = page.locator('[data-testid="chat-message"]').last();
    await expect(lastMessage).toContainText('Officer message 1');
  });

  test('viewer must pay for per-user paid chat before sending', async ({ page }) => {
    // 1. Login as paidUser (who has not yet paid for chat on this stream)
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.fill('[name="email"]', TEST_USERS.paidUser.email);
    await page.fill('[name="password"]', TEST_USERS.paidUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');

    // 2. Navigate to a stream with per-user paid chat enabled
    await page.goto(`${DEV_URL}/broadcast/watch/paid-per-user-stream`);
    await page.waitForTimeout(3000);

    // 3. Try to send a message
    const chatInput = page.locator('textarea[placeholder*="Say something"]');
    await chatInput.fill('Trying to chat');
    await chatInput.press('Enter');

    // 4. Should see paywall modal
    const modal = page.locator('text=Pay.*coins.*to chat');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('jailed user cannot send chat messages', async ({ page }) => {
    // 1. Login as jailed user
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.fill('[name="email"]', TEST_USERS.jailedUser.email);
    await page.fill('[name="password"]', TEST_USERS.jailedUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');

    // 2. Navigate to any stream
    await page.goto(`${DEV_URL}/broadcast/watch/seed-test-stream-1`);
    await page.waitForTimeout(3000);

    // 3. Check for jail banner or redirect to /jail
    const onJailPage = page.url().includes('/jail');
    if (!onJailPage) {
      // If not auto-redirected, try to send chat — should fail
      const chatInput = page.locator('textarea[placeholder*="Say something"]');
      await chatInput.fill('I should not be able to send this');
      await chatInput.press('Enter');
      await page.waitForTimeout(1000);

      // Expect toast error
      const errorToast = page.locator('text=You are in jail');
      await expect(errorToast).toBeVisible();
    }
  });

  test('broadcaster can toggle paid chat on/off', async ({ page }) => {
    // 1. Login as broadcaster (host)
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.fill('[name="email"]', 'broadcaster@test.troll');
    await page.fill('[name="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/');

    // 2. Start a stream (or use existing)
    await page.goto(`${DEV_URL}/broadcast/host`);
    await page.waitForTimeout(3000);

    // 3. Open "More" menu → Paid Chat Settings
    const moreBtn = page.getByRole('button', { name: /more/i });
    await moreBtn.click();
    const paidChatOption = page.getByRole('button', { name: /paid chat/i });
    await paidChatOption.click();

    // 4. Toggle enable
    const toggle = page.locator('button:has-text("Enable Paid Chat")').or(page.locator('[role="switch"]'));
    await toggle.click();

    // 5. Save
    await page.getByRole('button', { name: /save settings/i }).click();

    // 6. Verify toast success
    await expect(page.locator('text=Paid chat settings saved')).toBeVisible();
  });
});
