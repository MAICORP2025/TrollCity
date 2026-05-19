const fs = require('fs');
const orig = fs.readFileSync('src/pages/admin/CoinPackPurchasesLedger.tsx.bak', 'utf8');
const bom = Buffer.from(orig.slice(0,3));
if (bom[0] === 0xEF && bom[1] === 0xBB && bom[2] === 0xBF) {
  console.log('WARNING: BOM at start');
}
// write it back raw
fs.writeFileSync('src/pages/admin/CoinPackPurchasesLedger.tsx', orig);
console.log('Copied BAK to live file, size:', orig.length);
// verify first line that TS didn't choke on an encoding issue
const firstLine = orig.split('\n')[0];
console.log('First non-empty line:', firstLine);
