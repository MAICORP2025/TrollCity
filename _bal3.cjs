const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');

// Match any div/section tag (JSX open or close)
// open: <div or <section followed by non-> space in class=
// close: </div or </section
const divRe = /<div[\s>]|<\/div>/gi;
const secRe = /<section[\s>]|<\/section>/gi;

let openDiv = 0, openSec = 0;
const events = [];

for (let i = 0; i < L.length; i++) {
  const s = L[i];
  let m;
  while ((m = divRe.exec(s)) !== null) {
    const isClose = m[0].startsWith('</');
    const num = isClose ? -1 : +1;
    openDiv += num;
    events.push({ l: i+1, tag: 'div', open: !isClose, raw: m[0] });
  }
  divRe.lastIndex = 0;
  while ((m = secRe.exec(s)) !== null) {
    const isClose = m[0].startsWith('</');
    const num = isClose ? -1 : +1;
    openSec += num;
    events.push({ l: i+1, tag: 'section', open: !isClose, raw: m[0] });
  }
  secRe.lastIndex = 0;
}

console.log('End state: openDiv=', openDiv, 'openSec=', openSec);

// Show balance in target zone
console.log('\nBalance events (lines 855-1092):');
events
  .filter(e => e.l >= 855 && e.l <= 1092)
  .forEach(e => {
    const sp = (L[e.l-1]||'').match(/^ */)[0].length;
    console.log(e.l.toString().padStart(4) + '|sp=' + sp.toString().padStart(2) + '|' + (e.open ? 'OPEN ' : 'close ') + '|raw=' + JSON.stringify(e.raw).slice(0,20));
  });
