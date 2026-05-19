"use strict";
const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const orig = fs.readFileSync(file, 'utf8');
const L = orig.split('\n');

// Verify the EXACT beginning of line 1049 (1-based)
// (was the double-indent "function InfoCard" messing up the parse?)
console.log('Lines 1046-1060:');
for (let i = 1045; i <= 1060; i++)
  console.log((i + 1) + '|ind=' + (L[i].match(/^ */)[0].length) + '|' + JSON.stringify(L[i]));
