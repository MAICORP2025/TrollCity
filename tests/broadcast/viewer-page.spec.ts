import { test, expect, Page } from '@playwright/test';
import { selectors, TEST_USERS, getTestUser } from '../selectors';

const DEV_URL = 'http://localhost:5173';

// Helper: login
async function login(page: Page, user: typeof TEST_USERS[keyof typeof TEST_USERS]) {
  await page.goto(`${DEV_URL}/auth?mode=signin`);
  await page.fill(selectors.auth.emailInput, user.email);
  await page.fill(selectors.auth.passwordInput, user.password);
  await page.click(selectors.auth.signInButton);
  await page.waitForURL('/');
}

// Helper: navigate to a live stream by ID or slug
async function joinStream(page: Page, streamIdOrSlug: string) {
  await page.goto(`${DEV_URL}/broadcast/watch/${streamIdOrSlug}`);
  // Wait for video player to appear
  await page.waitForSelector('video', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

test.describe('ViewerPage - Troll Toe Integration', () => {
  test('viewer sees TrollToeViewerUI when game is active', async ({ page }) => {
    const user = getTestUser('richViewer');
    await login(page, user);
    await joinStream(page, 'trolltoe-active-stream');

    // UI should be visible
    await expect(page.locator(selectors.trollToe.uiContainer).first()).toBeVisible();
  });

  test('viewer can join broadcaster side during filling phase', async ({ page }) => {
    const user = getTestUser('richViewer');
    await login(page, user);
    await joinStream(page, 'trolltoe-active-stream');

    const joinBtn = page.locator(selectors.trollToe.joinBroadcasterButton);
    if (await joinBtn.count() > 0) {
      await joinBtn.first().click();
      await page.waitForTimeout(500);
      const status = page.locator(selectors.trollToe.statusText);
      await expect(status).toBeVisible();
    }
  });

  test('viewer with sufficient coins can use Fog', async ({ page }) => {
    const user = getTestUser('richViewer');
    await login(page, user);
    await joinStream(page, 'trolltoe-active-stream');

    const fogBtn = page.locator(selectors.trollToe.fogButton);
    if (await fogBtn.count() > 0) {
      await fogBtn.first().click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Fog deployed')).toBeVisible();
    }
  });

  test('viewer with insufficient coins cannot use Fog', async ({ page }) => {
    const user = getTestUser('poorViewer');
    await login(page, user);
    await joinStream(page, 'trolltoe-active-stream');

    const fogBtn = page.locator(selectors.trollToe.fogButton);
    if (await fogBtn.count() > 0) {
      await fogBtn.first().click();
      await page.waitForTimeout(1000);
      await expect(page.locator(selectors.chat.paidChatError)).toBeVisible();
    }
  });
});

test.describe('ViewerPage - Chat Features', () => {
  test('viewer can send up to 5 free chat messages', async ({ page }) => {
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

    await page.fill(selectors.chat.input, 'Officer message bypassing paywall');
    await page.press(selectors.chat.input, 'Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Officer message bypassing paywall')).toBeVisible();
  });

  test('jailed user cannot send chat messages', async ({ page }) => {
    const user = getTestUser('jailedUser');
    await login(page, user);
    await joinStream(page, 'any-live-stream');

    const onJailPage = page.url().includes('/jail');
    if (!onJailPage) {
      await page.fill(selectors.chat.input, 'I should not be able to send this');
      await page.press(selectors.chat.input, 'Enter');
      await page.waitForTimeout(1000);
      await expect(page.locator(selectors.status.jailBanner)).toBeVisible();
    }
  });
});

test.describe('ViewerPage - Battle Mode', () => {
  test('viewer sees battle overlay and can send chat during battle', async ({ page }) => {
    const user = getTestUser('richViewer');
    await login(page, user);
    await joinStream(page, 'battle-active-stream');

    await expect(page.locator(selectors.battle.scoreDisplay)).toBeVisible();

    await page.fill(selectors.chat.input, 'Chat during battle');
    await page.press(selectors.chat.input, 'Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Chat during battle')).toBeVisible();
  });
});

test.describe('ViewerPage - Real-time Box Count Sync', () => {
  test('box count updates when broadcaster adds/deducts boxes', async ({ page }) => {
    const user = getTestUser('richViewer');
    await login(page, user);
    await joinStream(page, 'stream-with-box-controls');

    const initialBoxEl = page.locator(selectors.broadcast.boxCountIndicator).first();
    const initialText = await initialBoxEl.textContent();
    const initial = parseInt(initialText || '1', 10);

    // Trigger box count increase via Supabase directly (simulating broadcaster action)
    await page.evaluate(async (streamId, newCount) => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      await supabase.from('streams').update({ box_count: newCount }).eq('id', streamId);
    }, 'seed-test-stream-1', initial + 1);

    await page.waitForTimeout(2000);
    const newText = await initialBoxEl.textContent();
    expect(parseInt(newText || '1', 10)).toBe(initial + 1);
  });
});

test.describe('Paid Chat - Officer Bypass', () => {
  test('lead_troll_officer bypasses per-user paywall', async ({ page }) => {
    const user = getTestUser('leadOfficer');
    await login(page, user);
    await joinStream(page, 'paid-per-user-stream');

    await page.fill(selectors.chat.input, 'Lead officer chat');
    await page.press(selectors.chat.input, 'Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Lead officer chat')).toBeVisible();
  });

  test('troll_officer bypasses per-message paywall', async ({ page }) => {
    const user = getTestUser('trollOfficer');
    await login(page, user);
    await joinStream(page, 'paid-per-message-stream');

    for (let i = 1; i <= 3; i++) {
      await page.fill(selectors.chat.input, `Officer msg ${i}`);
      await page.press(selectors.chat.input, 'Enter');
      await page.waitForTimeout(300);
    }

    const count = await page.locator(selectors.chat.messageContainer).count();
    expect(count).toBe(3);
  });
});

test.describe('Chat Rate Limiting', () => {
  test('user is limited to 5 messages within time window', async ({ page }) => {
    const user = getTestUser('richViewer');
    await login(page, user);
    await joinStream(page, 'free-chat-stream');

    for (let i = 1; i <= 5; i++) {
      await page.fill(selectors.chat.input, `Spam msg ${i}`);
      await page.press(selectors.chat.input, 'Enter');
      await page.waitForTimeout(100);
    }

    // 6th message should be blocked
    await page.fill(selectors.chat.input, 'Spam msg 6');
    await page.press(selectors.chat.input, 'Enter');
    await page.waitForTimeout(1000);
    await expect(page.locator(selectors.chat.rateLimitError)).toBeVisible();

    const count = await page.locator(selectors.chat.messageContainer).count();
    expect(count).toBe(5);
  });
});


  test('viewer can join broadcaster side during filling phase', async ({ page }) => {
    await login(page, TEST_USERS.richViewer);
    await joinStream(page, 'trolltoe-active-stream');

    // Ensure side selection is open
    const joinButton = page.locator('button:has-text("Broadcaster")').or(page.locator('[data-testid="join-broadcaster-side"]'));
    if (await joinButton.count() > 0) {
      await joinButton.first().click();
      await page.waitForTimeout(500);
      // Should see status change to "Queued" or "In Game!"
      const status = page.locator('text=/queued|in game/i');
      await expect(status).toBeVisible();
    }
  });

  test('viewer with sufficient coins can use Fog', async ({ page }) => {
    await login(page, TEST_USERS.richViewer);
    await joinStream(page, 'trolltoe-active-stream');

    // Game must be live and fog enabled
    const fogButton = page.locator('button:has-text("FOG")').first();
    if (await fogButton.count() > 0) {
      await fogButton.first().click();
      await page.waitForTimeout(1000);
      // Should see success toast
      await expect(page.locator('text=Fog deployed')).toBeVisible();
    }
  });

  test('viewer with insufficient coins cannot use Fog', async ({ page }) => {
    await login(page, TEST_USERS.poorViewer);
    await joinStream(page, 'trolltoe-active-stream');

    const fogButton = page.locator('button:has-text("FOG")').first();
    if (await fogButton.count() > 0) {
      await fogButton.first().click();
      await page.waitForTimeout(1000);
      // Should see error toast about not enough coins
      await expect(page.locator('text=/not enough|insufficient/i')).toBeVisible();
    }
  });
});

test.describe('ViewerPage - Chat Features', () => {
  test('viewer can send up to 5 free chat messages', async ({ page }) => {
    await login(page, TEST_USERS.richViewer);
    await joinStream(page, 'free-chat-stream');

    const chatInput = page.locator('textarea[placeholder*="Say something"]').first();
    for (let i = 1; i <= 5; i++) {
      await chatInput.fill(`Free message ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(300);
    }

    // All 5 messages should appear
    const messages = page.locator('[data-testid="chat-message"]');
    await expect(messages).toHaveCount(5);
  });

  test('officer can send chat when paid chat is enabled', async ({ page }) => {
    await login(page, TEST_USERS.trollOfficer);
    await joinStream(page, 'paid-per-user-stream');

    const chatInput = page.locator('textarea[placeholder*="Say something"]').first();
    await chatInput.fill('Officer message bypassing paywall');
    await chatInput.press('Enter');
    await page.waitForTimeout(500);

    // Officer should NOT see paywall and message should appear
    await expect(page.locator('text=Officer message bypassing paywall')).toBeVisible();
  });

  test('jailed user is blocked from sending chat', async ({ page }) => {
    await login(page, TEST_USERS.jailedUser);
    await joinStream(page, 'any-live-stream');

    // Either auto-redirected to /jail
    if (page.url().includes('/jail')) {
      await expect(page.locator('text=/jail|in jail/i')).toBeVisible();
    } else {
      // Or blocked with toast when trying
      const chatInput = page.locator('textarea[placeholder*="Say something"]').first();
      await chatInput.fill('I should not chat');
      await chatInput.press('Enter');
      await page.waitForTimeout(1000);
      await expect(page.locator('text=/cannot chat|restricted/i')).toBeVisible();
    }
  });
});

test.describe('ViewerPage - Battle Mode', () => {
  test('viewer sees battle overlay and can send chat during battle', async ({ page }) => {
    await login(page, TEST_USERS.richViewer);
    await joinStream(page, 'battle-active-stream');

    // Battle overlay should be visible (score + timer)
    const battleScore = page.locator('text=/Team A|Team B/i');
    await expect(battleScore).toBeVisible();

    // Chat should still work
    const chatInput = page.locator('textarea[placeholder*="Say something"]').first();
    await chatInput.fill('Chat during battle');
    await chatInput.press('Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Chat during battle')).toBeVisible();
  });
});

test.describe('ViewerPage - Real-time Box Count Sync', () => {
  test('box count updates when broadcaster adds/deducts boxes', async ({ page }) => {
    await login(page, TEST_USERS.richViewer);
    await joinStream(page, 'stream-with-box-controls');

    // Get initial box count from grid (e.g., "1" by default)
    const initialBoxCount = page.locator('[data-testid="box-count"]').first();
    const initialText = await initialBoxCount.textContent();
    const initial = parseInt(initialText || '1', 10);

    // Simulate broadcaster adding a box via API or UI (need broadcaster token)
    // For this test, we'll use a seeded action that triggers the update
    await page.evaluate(async () => {
      const { data, error } = await (await import('@supabase/supabase-js')).createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      ).from('streams').update({ box_count: initial + 1 }).eq('id', 'seed-test-stream-1');
      console.log('Box count update result:', { data, error });
    });

    // Wait for real-time broadcast
    await page.waitForTimeout(2000);

    // Verify UI updates
    const newText = await initialBoxCount.textContent();
    expect(parseInt(newText || '1', 10)).toBe(initial + 1);
  });
});

test.describe('Paid Chat - Officer Bypass', () => {
  test('lead_troll_officer bypasses per-user paywall', async ({ page }) => {
    await login(page, TEST_USERS.leadOfficer);
    await joinStream(page, 'paid-per-user-stream');

    const chatInput = page.locator('textarea[placeholder*="Say something"]').first();
    await chatInput.fill('Lead officer chat');
    await chatInput.press('Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Lead officer chat')).toBeVisible();
  });

  test('troll_officer bypasses per-message paywall', async ({ page }) => {
    await login(page, TEST_USERS.trollOfficer);
    await joinStream(page, 'paid-per-message-stream');

    // Send multiple messages, none should trigger payment
    for (let i = 1; i <= 3; i++) {
      const chatInput = page.locator('textarea[placeholder*="Say something"]').first();
      await chatInput.fill(`Officer msg ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(300);
    }

    const messages = page.locator('[data-testid="chat-message"]');
    await expect(messages).toHaveCount(3);
  });
});

test.describe('Chat Rate Limiting', () => {
  test('user is limited to 5 messages within time window', async ({ page }) => {
    await login(page, TEST_USERS.richViewer);
    await joinStream(page, 'free-chat-stream');

    const chatInput = page.locator('textarea[placeholder*="Say something"]').first();

    // Send 5 messages quickly
    for (let i = 1; i <= 5; i++) {
      await chatInput.fill(`Spam msg ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(100);
    }

    // 6th message should be blocked
    await chatInput.fill('Spam msg 6');
    await chatInput.press('Enter');
    await page.waitForTimeout(1000);

    // Should see rate-limit warning toast
    await expect(page.locator('text=/too fast|rate limit|autoclicker/i')).toBeVisible();

    // Should still have only 5 messages sent
    const messages = page.locator('[data-testid="chat-message"]');
    await expect(messages).toHaveCount(5);
  });
});
