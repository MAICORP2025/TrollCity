"use strict";
const fs = require('fs');
const orig = fs.readFileSync('src/pages/admin/CoinPackPurchasesLedger.tsx', 'utf8');
const L = orig.split('\n');

function show(start, end) {
  for (let i = start; i <= end; i++)
    console.log((i+1).toString().padStart(4)+'|sp='+(L[i].match(/^ */)[0].length).toString().padStart(2)+'|'+JSON.stringify(L[i]).slice(0,130));
}

console.log('== 1044-1051 (before file upload = ) ==');
show(1043,1051);
console.log('== 1044-1048 context ==');
show(1043,1050);
console.log('== 1044-1060 ==');
show(1043,1060);
