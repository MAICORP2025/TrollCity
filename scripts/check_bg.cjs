const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await p.goto('http://localhost:5179/universe/dev-preview', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  const r = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const out = { url: location.pathname, canvas: !!c };
    if (c) {
      const x = c.getContext('2d');
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) lit++;
      out.litPixels = lit;
      out.hasArena = document.body.innerText.includes('Universe Battle');
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
