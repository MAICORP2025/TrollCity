const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:5179/universe/dev-preview', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const wrap = c.parentElement;
    const cs = getComputedStyle(wrap);
    // element from point at top-left corner (should be canvas or content, not black bg)
    const topEl = document.elementFromPoint(5, 5);
    const centerEl = document.elementFromPoint(720, 450);
    return {
      wrapPosition: cs.position,
      wrapZ: cs.zIndex,
      canvasZ: getComputedStyle(c).zIndex,
      rootBg: getComputedStyle(document.querySelector('div.relative')).backgroundColor,
      topLeftElement: topEl ? topEl.tagName + (topEl.className && typeof topEl.className === 'string' ? '.' + topEl.className.split(' ')[0] : '') : null,
      centerElement: centerEl ? centerEl.tagName : null,
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
