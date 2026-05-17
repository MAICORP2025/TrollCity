import { Page, Locator, expect } from '@playwright/test';

export class ViewerPage {
  constructor(private page: Page) {}

  // Navigation
  async goto(streamId: string) {
    await this.page.goto(`/broadcast/watch/${streamId}`);
    await this.waitForReady();
  }

  async waitForReady() {
    await this.page.waitForSelector('video', { timeout: 15000 });
    await this.page.waitForTimeout(2000);
  }

  // Chat actions
  getChatInput(): Locator {
    return this.page.locator('textarea[placeholder*="Say something"], textarea[placeholder*="Message"]');
  }

  async sendChat(message: string) {
    const input = this.getChatInput();
    await input.fill(message);
    await input.press('Enter');
    await this.page.waitForTimeout(300);
  }

  async getLastChatMessage(): Promise<string | null> {
    const last = this.page.locator('[data-testid="chat-message"]').last();
    if (await last.count() === 0) return null;
    return await last.textContent();
  }

  async getChatMessageCount(): Promise<number> {
    return await this.page.locator('[data-testid="chat-message"]').count();
  }

  async expectPaywallVisible() {
    await expect(this.page.locator('text=/Pay.*to chat/i')).toBeVisible();
  }

  async expectToastVisible(text: string | RegExp) {
    await expect(this.page.locator('[role="alert"], .toast')).toContainText(text);
  }

  // Troll Toe actions
  isTrollToeUIVisible(): Promise<boolean> {
    return this.page.locator('text=Troll Toe').first().isVisible();
  }

  async joinSide(team: 'broadcaster' | 'challenger'): Promise<Locator> {
    const selector = team === 'broadcaster'
      ? 'button:has-text("Broadcaster")'
      : 'button:has-text("Challenger")';
    const btn = this.page.locator(selector).first();
    await btn.click();
    return btn;
  }

  async clickFog() {
    const btn = this.getFogButton();
    if (await btn.count() > 0 && await btn.isEnabled()) {
      await btn.click();
    }
  }

  getFogButton(): Locator {
    return this.page.locator('button:has-text("FOG")').first();
  }

  async getViewerStatus(): Promise<string> {
    const statusEl = this.page.locator('text=/Queued|In Game|Spectating|Fogged|Winner|Defeated/i').first();
    return await statusEl.textContent() || 'unknown';
  }

  // Battle
  async isBattleOverlayVisible(): Promise<boolean> {
    const a = this.page.locator('text=Team A');
    const b = this.page.locator('text=Team B');
    return Promise.all([a.isVisible(), b.isVisible()]).then(([av, bv]) => av && bv);
  }

  // Box count
  async getBoxCount(): Promise<number> {
    const el = this.page.locator('[data-testid="box-count"]').first();
    const text = await el.textContent();
    return parseInt(text?.trim() || '1', 10);
  }

  async waitForBoxCountChange(expected: number, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, expectedVal) => {
        const el = document.querySelector(sel);
        return el && parseInt(el.textContent || '1', 10) === expectedVal;
      },
      '[data-testid="box-count"]',
      expected,
      { timeout }
    );
  }

  // Helpers
  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `./test-results/${name}.png`, fullPage: false });
  }
}
