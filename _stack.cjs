const fs = require('fs');
const L = fs.readFileSync('src/pages/admin/CoinPackPurchasesLedger.tsx','utf8').split('\n');
// Build a proper object-by-indent JSX tree up to N, tracking how many <div are open
function scanWhatsOpen(limit) {
  const stack = [];
  for (let i=0; i<limit; i++) {
    const s = L[i];
    const re = /<([A-Za-z][A-Za-z0-9:-]*)\b[^>]*>/g;
    const rc = /<\/([A-Za-z][A-Za-z0-9:-]*)>/g;
    let m;
    // opens
    re.lastIndex=0;
    while ((m=re.exec(s))!==null) {
      // don't push self-closing <.../>
      if (s.slice(m.index).match(/<[A-Za-z][A-Za-z0-9:-]*\b[^>]*\/>/)) continue;
      stack.push({tag:m[1], line:i+1});
    }
    // closes
    rc.lastIndex=0;
    while ((m=rc.exec(s))!==null) {
      if (stack.length && stack[stack.length-1].tag===m[1]) {
        stack.pop();
      }
    }
  }
  return stack;
}
console.log('After line 960 (0..959):', scanWhatsOpen(960).map(x=>x.line+':'+x.tag));
console.log('After line 961,():', scanWhatsOpen(961).map(x=>x.line+':'+x.tag));
