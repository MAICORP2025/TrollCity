"use strict";
const fs = require('fs');
const orig = fs.readFileSync('src/pages/admin/CoinPackPurchasesLedger.tsx', 'utf8');
const L = orig.split('\n');

// Build a simple parse: track currently-open tags by reading indent × tag
// Expect structure:
//   777: return (
//   778:   <divclassName="min-h-screen ...">   ← OPEN div-A
//   779:      <divclassName="max-w-[1400px]...">   ← OPEN div-B
//   ...children...
//   ... eventually:  </div> ← CLOSE div-B
//               </div> ← CLOSE div-A
//   )   ← return closer? (written as } on a separate line in the file we're seeing)
//   }

// Actually let's look at the WHOLE return JSX from line 777 to the end
console.log('=== FULL JSX TRAVERSE 777-end ===');
let stack = [];  // [{tag, startLine, indent}]
for (let i = 776; i < L.length; i++) {  // 1-based: i+1, start 777=0-index 776
  const s = L[i].trim();
  const indent = L[i].match(/^ */)[0].length;

  // match open JSX tag
  const openM = s.match(/^<([A-Za-z][A-Za-z0-9:-]*)\b[^>]*>$/);
  // match close JSX tag
  const closeM = s.match(/^<\/([A-Za-z][A-Za-z0-9:-]*)>/);
  // match self-closing tag
  const selfM = s.match(/^<([A-Za-z][A-Za-z0-9:-]*)\b[^>]*\/>/);

  if (openM) {
    stack.push({ tag: openM[1], line: i+1, indent });
  } else if (closeM) {
    const lastTag = stack[stack.length-1];
    if (!lastTag) {
      console.log(`CLOSE at ${i+1} </${closeM[1]}> -- NO OPEN TAG on stack`);
    } else if (lastTag.tag !== closeM[1]) {
      console.log(`MISMATCH at ${i+1}: closed </${closeM.tag}> but expected </${lastTag.tag}> (opened at ${lastTag.line})`);
    }
    stack.pop();
  } else if (!selfM && !s.startsWith('/*') && !s.startsWith('*/') && !s.startsWith('{') && !s.startsWith('}') && !s.startsWith('//') && s) {
    // non-Tag line
  }
}
console.log('Remaining on stack:');
stack.forEach(x => console.log(`  open <${x.tag}> at line ${x.line} indent ${x.indent}`));
