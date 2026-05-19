"use strict";
const fs = require('fs');
const backup = 'src/pages/admin/CoinPackPurchasesLedger.tsx.bak';
const orig = fs.readFileSync(backup, 'utf8');
const L = orig.split('\n');

console.log('Backup is', L.length, 'lines');
console.log('=== Lines 1046-1077 (key boundary area of bak) ===');
for (let i = 1045; i <= 1076; i++)
  console.log((i+1).toString().padStart(4)+'|sp='+(L[i].match(/^ */)[0].length).toString().padStart(2)+'|'+JSON.stringify(L[i]).slice(0,120));

console.log('=== Lines 1109-end ===');
for (let i = 1108; i < L.length; i++)
  console.log((i+1).toString().padStart(4)+'|sp='+(L[i].match(/^ */)[0].length).toString().padStart(2)+'|'+JSON.stringify(L[i]).slice(0,120));
