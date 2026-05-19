"use strict";
const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');

// The 3 lines I need to change:
//   L[1074] (l.1075=sp 4)  `    </div>` — keep
//   L[1075] (l.1076=sp 4)  `    </div>` — REMOVE (extra close, no matching open)
//   L[1076] (l.1077=sp 2)  `  </div>` — keep (closes minh-screen at line 778)

// Strike the duplicate div that causes the "unclosed <div>" error.
// Replace by an extra </div> at indent 10 (closes the Data Sources <div> in the Schema block)
// and remove the superflous `    </div>` at indent 4

const edits = {};
edits[1075] = '          </div>';   // extra closing at indent 10 instead of at indent 4

const newLines = L.map((s, i) => {
  const target = edits[i + 1];
  return target !== undefined ? target : s;
});

fs.writeFileSync(f, newLines.join('\n'), 'utf8');
const V = fs.readFileSync(f, 'utf8').split('\n');
console.log('Written', V.length, 'lines');
console.log('--- Lines 1064-1078 ---');
for (let i = 1063; i < 1078; i++) {
  console.log((i+1).toString().padStart(4) + '|sp=' + (V[i].match(/^ */)[0].length).toString().padStart(2) + '|' + JSON.stringify(V[i]).trim().slice(0, 110));
}
