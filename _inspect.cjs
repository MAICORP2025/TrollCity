const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

console.log('File lines:', lines.length);
console.log('Lines 1048-1150 specific:');
for(let i=1047; i<=1110; i++){
  const s = lines[i]||'';
  const ind = s.match(/^ */)[0].length;
  console.log((i+1).toString().padStart(4)+'| ind='+ind.toString().padStart(2)+' | '+JSON.stringify(s.trim()).slice(0,100));
}
console.log('--- END ---');
