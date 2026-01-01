import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:5175';
const path = process.env.PATH_TO_OPEN || `/live/test-stream?start=1`;
const url = `${base}${path.startsWith('/') ? path : '/' + path}`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', (msg) => {
    try {
      logs.push({ type: msg.type(), text: msg.text() });
      console.log(`[PAGE:${msg.type()}] ${msg.text()}`);
    } catch (e) {
      console.log('[PAGE:console] (error reading message)');
    }
  });

  page.on('pageerror', (err) => {
    console.log('[PAGE:pageerror]', err && err.message ? err.message : String(err));
    logs.push({ type: 'pageerror', text: err && err.message ? err.message : String(err) });
  });

  console.log('Opening', url);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.log('[NAV_ERROR]', e && e.message ? e.message : String(e));
  }

  // Wait some time to let the app initialize and emit logs (adjust as needed)
  await page.waitForTimeout(8000);

  // Take a screenshot for debugging
  try {
    await page.screenshot({ path: 'tmp-livepage-screenshot.png', fullPage: true });
    console.log('Saved screenshot tmp-livepage-screenshot.png');
  } catch {}

  await browser.close();

  // Summarize important logs
  console.log('\n--- COLLECTED LOGS (trimmed) ---');
  logs.slice(-200).forEach((l) => console.log(`[${l.type}] ${l.text}`));
  console.log('--- END LOGS ---');

  // Also write logs to a file for inspection
  try {
    const fs = await import('fs');
    fs.writeFileSync('tmp-livepage-console.json', JSON.stringify(logs, null, 2));
    console.log('Wrote tmp-livepage-console.json');
  } catch (e) {
    console.log('Failed to write logs file', e && e.message ? e.message : e);
  }

  process.exit(0);
})();
