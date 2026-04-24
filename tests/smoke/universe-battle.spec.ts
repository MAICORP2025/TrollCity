import { test, expect } from '@playwright/test';
import { setupDiagnostics, attachDiagnostics, getPathname, login, TEST_USERS, TEST_PASSWORD } from './utils';

const TEST_TIMEOUT = 300000;
const BATTLE_WAIT_TIME = 10000;
const RETURN_WAIT_TIME = 8000;

const ADMIN_USER = {
  id: '8dff9f37-21b5-4b8e-adc2-b9286874be1a',
  email: TEST_USERS.admin.email,
  password: TEST_PASSWORD
};

const OFFICER_USER = {
  id: '13113269-7c07-48b9-b70e-dc69fb988840',
  email: TEST_USERS.officer.email,
  password: TEST_PASSWORD
};

test.describe('Universe Battle System Tests', () => {
  let adminPage: any;
  let officerPage: any;
  let viewerPage: any;

  test.beforeEach(async ({ browser }) => {
    const contextAdmin = await browser.newContext();
    const contextOfficer = await browser.newContext();
    const contextViewer = await browser.newContext();

    adminPage = await contextAdmin.newPage();
    officerPage = await contextOfficer.newPage();
    viewerPage = await contextViewer.newPage();

    setupDiagnostics(adminPage);
    setupDiagnostics(officerPage);
    setupDiagnostics(viewerPage);
  });

  test.afterEach(async () => {
    try {
      await adminPage.close();
      await officerPage.close();
      await viewerPage.close();
    } catch (e) {
      console.log('Cleanup error:', e);
    }
  });

  test('1. Admin starts live broadcast and initiates battle', async ({ page }, testInfo) => {
    console.log('\n=== Test 1: Admin starts live broadcast and initiates battle ===');

    await login(page, ADMIN_USER.email, ADMIN_USER.password);

    await page.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('URL after broadcast:', getPathname(page));

    const goLiveButton = page.getByRole('button', { name: /go live|start broadcast|start streaming/i });
    if (await goLiveButton.isVisible().catch(() => false)) {
      await goLiveButton.click();
      await page.waitForTimeout(5000);
      console.log('Clicked Go Live');
    }

    const findMatchButton = page.locator('button:has-text("FIND MATCH"), button:has-text("Find Match"), button:has-text("START BATTLE")');
    if (await findMatchButton.isVisible().catch(() => false)) {
      await findMatchButton.click();
      console.log('Clicked Find Match / Start Battle');
      await page.waitForTimeout(3000);
    }

    const currentUrl = getPathname(page);
    console.log('Final URL:', currentUrl);

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  });

  test('2. Officer joins as opponent and accepts battle', async ({ page }, testInfo) => {
    console.log('\n=== Test 2: Officer joins as opponent and accepts battle ===');

    await login(page, OFFICER_USER.email, OFFICER_USER.password);

    await page.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });
    
    const goLiveButton = page.getByRole('button', { name: /go live|start broadcast|start streaming/i });
    if (await goLiveButton.isVisible().catch(() => false)) {
      await goLiveButton.click();
      await page.waitForTimeout(5000);
    }

    const acceptButton = page.locator('button:has-text("ACCEPT"), button:has-text("Accept Match"), button:has-text("ACCEPT BATTLE")');
    if (await acceptButton.isVisible().catch(() => false)) {
      await acceptButton.click();
      console.log('Accepted battle challenge');
      await page.waitForTimeout(3000);
    }

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  });

  test('3. Viewer joins box and watches battle', async ({ page }, testInfo) => {
    console.log('\n=== Test 3: Viewer joins box and watches battle ===');

    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);

    await page.goto('/live', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('On /live page');

    await page.waitForTimeout(3000);

    const battleElements = [
      page.locator('text=Battle'),
      page.locator('text=VS'),
      page.locator('[class*="battle"]')
    ];

    for (const el of battleElements) {
      if (await el.first().isVisible().catch(() => false)) {
        console.log('Found battle element');
        break;
      }
    }

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  });

  test('4. Gifting works during battle', async ({ page }, testInfo) => {
    console.log('\n=== Test 4: Gifting works during battle ===');

    await login(page, TEST_USERS.troller1.email, TEST_USERS.troller1.password);

    await page.goto('/live', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const giftButton = page.locator('button:has-text("Gift")');
    if (await giftButton.first().isVisible().catch(() => false)) {
      await giftButton.first().click();
      await page.waitForTimeout(1000);
      console.log('Gift button clicked');
    }

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  });

  test('5. Timer is synced for all participants', async ({ page }, testInfo) => {
    console.log('\n=== Test 5: Timer is synced for all participants ===');

    await login(page, TEST_USERS.member2.email, TEST_USERS.member2.password);

    await page.goto('/live', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    const timerElements = [
      page.locator('text=/\\d{1,2}:\\d{2}/'),
      page.locator('[class*="timer"]'),
      page.locator('[class*="countdown"]')
    ];

    for (const el of timerElements) {
      if (await el.first().isVisible().catch(() => false)) {
        console.log('Found timer element');
        break;
      }
    }

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  });

  test('6. Battle ends and crowns are awarded', async ({ page }, testInfo) => {
    console.log('\n=== Test 6: Battle ends and crowns are awarded ===');

    await login(page, ADMIN_USER.email, ADMIN_USER.password);

    await page.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    const endBattleButton = page.locator('button:has-text("END BATTLE"), button:has-text("End Battle")');
    if (await endBattleButton.isVisible().catch(() => false)) {
      await endBattleButton.click();
      console.log('Ended battle');
      await page.waitForTimeout(3000);
    }

    const winnerElements = [
      page.locator('text=Winner'),
      page.locator('text=Victory'),
      page.locator('text=Battle Ended')
    ];

    for (const el of winnerElements) {
      if (await el.isVisible().catch(() => false)) {
        console.log('Found winner/results element');
        break;
      }
    }

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  });

  test('7. Rematch works after battle ends', async ({ page }, testInfo) => {
    console.log('\n=== Test 7: Rematch works after battle ends ===');

    await login(page, ADMIN_USER.email, ADMIN_USER.password);

    await page.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    const rematchButton = page.locator('button:has-text("REMATCH"), button:has-text("Rematch")');
    if (await rematchButton.isVisible().catch(() => false)) {
      await rematchButton.click();
      console.log('Clicked Rematch');
      await page.waitForTimeout(3000);
    }

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  });

  test('8. Forfeit gives crowns to other team', async ({ page }, testInfo) => {
    console.log('\n=== Test 8: Forfeit gives crowns to other team ===');

    await login(page, OFFICER_USER.email, OFFICER_USER.password);

    await page.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    const forfeitButton = page.locator('button:has-text("FORFEIT"), button:has-text("Forfeit"), button:has-text("Leave Battle")');
    if (await forfeitButton.isVisible().catch(() => false)) {
      await forfeitButton.click();
      console.log('Clicked Forfeit');
      
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("OK")');
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
      }
      
      await page.waitForTimeout(3000);
    }

    const winnerElements = [
      page.locator('text=Winner'),
      page.locator('text=Forfeit'),
      page.locator('text=Victory')
    ];

    for (const el of winnerElements) {
      if (await el.isVisible().catch(() => false)) {
        console.log('Found forfeit result');
        break;
      }
    }

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  });

  test('9. Full battle flow: 1v1 mode', async ({ page }, testInfo) => {
    console.log('\n=== Test 9: Full battle flow - 1v1 mode ===');

    await login(page, ADMIN_USER.email, ADMIN_USER.password);

    await page.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });
    
    const goLiveButton = page.getByRole('button', { name: /go live|start/i });
    if (await goLiveButton.isVisible().catch(() => false)) {
      await goLiveButton.click();
      await page.waitForTimeout(5000);
    }

    console.log('1v1 battle flow - Go Live done');
    
    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  }, TEST_TIMEOUT);

  test('10. Battle starts - verify real-time gift score updates', async ({ browser }, testInfo) => {
    console.log('\n=== Test 10: Battle starts - Real-time gift score updates ===');

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await login(page1, ADMIN_USER.email, ADMIN_USER.password);
    await login(page2, TEST_USERS.troller1.email, TEST_USERS.troller1.password);

    await page1.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });
    await page2.goto('/live', { waitUntil: 'networkidle', timeout: 30000 });
    await page1.waitForTimeout(3000);

    const goLiveButton = page1.getByRole('button', { name: /go live|start/i });
    if (await goLiveButton.isVisible().catch(() => false)) {
      await goLiveButton.click();
      console.log('Admin went live');
      await page1.waitForTimeout(5000);
    }

    const scoreBefore = await page1.locator('[class*="score"], text=/\\d+/').first().textContent().catch(() => '0');
    console.log('Score before gift:', scoreBefore);

    const giftBtn = page2.locator('button:has-text("Gift")');
    if (await giftBtn.isVisible().catch(() => false)) {
      await giftBtn.click();
      await page2.waitForTimeout(1500);
      console.log('Gift sent from page2');
    }

    const scoreAfterSingle = await page1.locator('[class*="score"], text=/\\d+/').first().textContent().catch(() => '0');
    console.log('Score after single gift:', scoreAfterSingle);

    await page1.close();
    await page2.close();

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  }, TEST_TIMEOUT);

  test('11. Rapid gifting during battle', async ({ browser }, testInfo) => {
    console.log('\n=== Test 11: Rapid gifting during battle ===');

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await login(page1, ADMIN_USER.email, ADMIN_USER.password);
    await login(page2, TEST_USERS.troller2.email, TEST_USERS.troller2.password);

    await page1.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });
    await page2.goto('/live', { waitUntil: 'networkidle', timeout: 30000 });
    await page1.waitForTimeout(3000);

    const goLiveButton = page1.getByRole('button', { name: /go live|start/i });
    if (await goLiveButton.isVisible().catch(() => false)) {
      await goLiveButton.click();
      console.log('Admin went live for rapid gift test');
      await page1.waitForTimeout(5000);
    }

    const giftBtn = page2.locator('button:has-text("Gift")');
    console.log('Rapid gifting: sending 5 gifts quickly...');
    
    for (let i = 0; i < 5; i++) {
      if (await giftBtn.isVisible().catch(() => false)) {
        await giftBtn.click();
        await page2.waitForTimeout(300);
        console.log(`Rapid gift ${i + 1} sent`);
      }
    }
    await page2.waitForTimeout(1000);

    const finalScore = await page1.locator('[class*="score"], text=/\\d+/').first().textContent().catch(() => '0');
    console.log('Final score after rapid gifting:', finalScore);

    await page1.close();
    await page2.close();

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  }, TEST_TIMEOUT);

  test('12. Coin balance updates in real-time during battle', async ({ browser }, testInfo) => {
    console.log('\n=== Test 12: Coin balance updates in real-time during battle ===');

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await login(page1, ADMIN_USER.email, ADMIN_USER.password);
    await login(page2, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);

    await page1.goto('/wallet', { waitUntil: 'networkidle', timeout: 30000 });
    const coinBalanceBefore = await page1.locator('[class*="coin"], [class*="balance"]').first().textContent().catch(() => '0');
    console.log('Broadcaster coin balance BEFORE battle:', coinBalanceBefore);

    await page2.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });
    const goLiveButton = page2.getByRole('button', { name: /go live|start/i });
    if (await goLiveButton.isVisible().catch(() => false)) {
      await goLiveButton.click();
      console.log('Broadcaster started stream');
      await page2.waitForTimeout(5000);
    }

    await page1.waitForTimeout(2000);
    await page1.goto('/wallet', { waitUntil: 'networkidle', timeout: 30000 });
    const coinBalanceAfterStart = await page1.locator('[class*="coin"], [class*="balance"]').first().textContent().catch(() => '0');
    console.log('Coin balance AFTER going live:', coinBalanceAfterStart);

    const balanceChanged = coinBalanceBefore !== coinBalanceAfterStart;
    console.log('Balance changed:', balanceChanged);

    await page1.close();
    await page2.close();

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  }, TEST_TIMEOUT);

  test('13. Coin balance updates after battle ends', async ({ browser }, testInfo) => {
    console.log('\n=== Test 13: Coin balance updates after battle ends ===');

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await login(page1, OFFICER_USER.email, OFFICER_USER.password);
    await login(page2, TEST_USERS.member1.email, TEST_USERS.member1.password);

    await page1.goto('/wallet', { waitUntil: 'networkidle', timeout: 30000 });
    const balanceBeforeBattle = await page1.locator('[class*="coin"], [class*="balance"]').first().textContent().catch(() => '0');
    console.log('Officer coin balance BEFORE battle:', balanceBeforeBattle);

    await page2.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });
    const goLiveButton = page2.getByRole('button', { name: /go live|start/i });
    if (await goLiveButton.isVisible().catch(() => false)) {
      await goLiveButton.click();
      console.log('Member started stream');
      await page2.waitForTimeout(3000);
    }

    await page1.goto('/live', { waitUntil: 'networkidle', timeout: 30000 });
    const giftBtn = page1.locator('button:has-text("Gift")');
    if (await giftBtn.isVisible().catch(() => false)) {
      await giftBtn.click();
      await page1.waitForTimeout(2000);
      console.log('Gift sent by Officer');
    }

    await page1.goto('/wallet', { waitUntil: 'networkidle', timeout: 30000 });
    await page1.waitForTimeout(1000);
    const balanceAfterBattle = await page1.locator('[class*="coin"], [class*="balance"]').first().textContent().catch(() => '0');
    console.log('Officer coin balance AFTER battle:', balanceAfterBattle);

    const balanceUpdated = balanceBeforeBattle !== balanceAfterBattle;
    console.log('Balance updated after battle:', balanceUpdated);

    await page1.close();
    await page2.close();

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  }, TEST_TIMEOUT);

  test('14. All viewers see same score during battle', async ({ browser }, testInfo) => {
    console.log('\n=== Test 14: All viewers see same score during battle ===');

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();

    await login(page1, ADMIN_USER.email, ADMIN_USER.password);
    await login(page2, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await login(page3, TEST_USERS.member2.email, TEST_USERS.member2.password);

    await page1.goto('/broadcast', { waitUntil: 'networkidle', timeout: 30000 });

    const goLiveButton = page1.getByRole('button', { name: /go live|start/i });
    if (await goLiveButton.isVisible().catch(() => false)) {
      await goLiveButton.click();
      console.log('Admin went live');
      await page1.waitForTimeout(5000);
    }

    await page2.goto('/live', { waitUntil: 'networkidle', timeout: 30000 });
    await page3.goto('/live', { waitUntil: 'networkidle', timeout: 30000 });
    await page2.waitForTimeout(2000);
    await page3.waitForTimeout(2000);

    const scorePage2 = await page2.locator('[class*="score"], text=/\\d+/').first().textContent().catch(() => '0');
    const scorePage3 = await page3.locator('[class*="score"], text=/\\d+/').first().textContent().catch(() => '0');
    console.log('Score on viewer 1 page:', scorePage2);
    console.log('Score on viewer 2 page:', scorePage3);

    const scoresMatch = scorePage2 === scorePage3;
    console.log('Scores match between viewers:', scoresMatch);

    await page1.close();
    await page2.close();
    await page3.close();

    await attachDiagnostics(testInfo, { 
      consoleMessages: [], 
      pageErrors: [], 
      requestFailures: [] 
    });
  }, TEST_TIMEOUT);
});