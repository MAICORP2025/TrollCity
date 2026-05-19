"use strict";
const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(file, 'utf8').split('\n');

console.log('File has', L.length, 'lines');
console.log('');
console.log('=== LAST 10 LINES ===');
for (let i = L.length-10; i < L.length; i++)
  console.log((i+1).toString().padStart(4)+'|sp='+(L[i].match(/^ */)[0].length).toString().padStart(2)+'|'+JSON.stringify(L[i]).slice(0,130));

console.log('');
console.log('=== WHOLE JSX CONTEXT: 1044-1096 ===');
for (let i = 1043; i <= 1095; i++)
  console.log((i+1).toString().padStart(4)+'|sp='+(L[i].match(/^ */)[0].length).toString().padStart(2)+'|'+JSON.stringify(L[i]).slice(0,120));
