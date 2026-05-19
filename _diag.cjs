const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(file, 'utf8').split('\n');

console.log('Currently', L.length, 'lines');
// Find all occurrences of corruption markers and get their line ranges
const badWords = ['=======', 'navigator.clipboard.writeText', 'ESCAPE', 'ESCAPE', 'ESCAPE', 'const query = false', 'ESCAPE', 'ESCAPE', 'ESCAPE', 'R merge pass', '1vee', '1vve', 'const rawMethod', '= square', '= cashapp', 'navigator.clipboard'];
const badLines = [];
for (let i = 0; i < L.length; i++) {
  for (const w of badWords) {
    if ((L[i]||'').includes(w) || 
        (w === 'const query = false' && (L[i]||'').trim() === 'const query = false') ||
        (w === 'ESCAPE' && false)) {
      badLines.push(i);
      break;
    }
  }
}
console.log('Corrupted lines found at indices:', badLines);
if (badLines.length > 0) {
  console.log('First:', badLines[0], 'Last:', badLines[badLines.length-1]);
}

// Search for the // FILE LIST VIEW comment and // INFO CARD - these are legitimate markers
const fileListMarker = L.findIndex(l => l.includes('FILE LIST VIEW'));
const infoCardMarker = L.findIndex(l => l.trim() === 'function InfoCard({ label, items }');

console.log('\nINFO CARD HELPER at line:', infoCardMarker+1, 'starting at', JSON.stringify(L[infoCardMarker]?.slice(0,60)));
console.log('FILE LIST comment at:', fileListMarker+1, JSON.stringify(L[fileListMarker]?.slice(0,60)));

console.log('\n=== Lines 1040 to end of file ===');
for (let i = 1039; i < L.length; i++) {
  const s = (L[i]||'').trim();
  console.log((i+1).toString().padStart(4)+'|sp='+(L[i].match(/^ */)[0].length).toString().padStart(2)+'|'+JSON.stringify(s).slice(0,100));
  if (s.startsWith('</div>') || s.startsWith('</section>'))
    console.log('        ^ CLOSE');
}
