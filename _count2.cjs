"use strict";
const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');
console.log('Input', L.length, 'lines');

const openDivs = [];
L.forEach((s, i) => {
  const opens = (s.match(/<div /gi) || []).length;   // <div  (NOT word-boundary div)
  const closes = (s.match(/<\/div>/gi) || []).length;
  if (opens) openDivs.push([i+1, opens]);
  if (closes) openDivs.push([i+1, -closes]);
});
console.log('\nDiv opens/closes summary (target range 860-1086):');
let running = 0;
for (const [line, delta] of openDivs) {
  running += delta;
  if (line >= 855 && line <= 1090) {
    console.log('  line=' + line + ' delta=' + (delta > 0 ? ('+'+delta) : delta) + ' running=' + running);
  }
}
console.log('\nNet gap:', running);
