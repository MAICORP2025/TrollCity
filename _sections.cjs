const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');

// Find ALL occurrences of "</section>" and show surrounding context
console.log('=== ALL <section> opens ===');
for (let i = 0; i < L.length; i++) {
  const ev = L[i].match(/<section[\s>/]|<\/section>/g);
  if (ev && ev.length) {
    const ctx = L.slice(Math.max(0,i-2), i+3);
    console.log('  line', (i+1).toString().padStart(4), '|', JSON.stringify(ev.join('|')), '| ctx:', JSON.stringify(ctx.join(' ')).slice(0, 180));
  }
}
