const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');

// ── Single-pass scanner: for every line, print key JSX tokens ─────────────
for (let i = 0; i < L.length; i++) {
  const s = L[i];
  const hasDivOpen  = !!(s.match(/<div[\s>]/g));
  const hasDivClose = !!(s.match(/<\/div>/g));
  const hasSecOpen  = !!(s.match(/<section[\s>]/g));
  const hasSecClose = !!(s.match(/<\/section>/g));

  // For open tags: show the indent
  if (hasSecOpen || hasSecClose || (hasDivOpen && i > 770)) {
    const ind = (s.match(/^ */)||['']).join('').length;
    let c = JSON.stringify(s.trimStart().slice(0, 80));
    console.log((i+1).toString().padStart(5)+'| sp='+ind.toString().padStart(2)+'| div='+(hasDivOpen?1:0)+(hasDivClose?'-1':'')+'| sec='+(hasSecOpen?1:0)+(hasSecClose?'-1':'')+'| '+c);
  }
}
