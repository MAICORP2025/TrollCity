const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');

// ── Count openings and closings using exact 1-to-1 parsing ─────────────────
/**
 * Creates structural scans of the first limit lines:
 * - decodes open <div or <section followed by non-div character
 * - decodes </section> and </div> closes
 */
function scan(limit) {
  let divOpen = 0, divClose = 0, secOpen = 0, secClose = 0;
  for (let i = 0; i < limit; i++) {
    const s = L[i];
    // Count <div
    let p = 0;
    while ((p = s.indexOf('<div', p)) !== -1) {
      const after = s[p + 4] || '';
      if (/[\s>]/.test(after)) { divOpen++; }
      p += 4;
    }
    // Count </div>
    p = 0;
    while ((p = s.indexOf('</div>', p)) !== -1) { divClose++; p += 6; }
    // Count <section
    p = 0;
    while ((p = s.indexOf('<section', p)) !== -1) {
      const after = s[p + 8] || '';
      if (/[\s>]/.test(after)) { secOpen++; }
      p += 8;
    }
    // Count </section>
    p = 0;
    while ((p = s.indexOf('</section>', p)) !== -1) { secClose++; p += 10; }
  }
  return { divOpen, divClose, divNet: divOpen - divClose,
           secOpen, secClose, secNet: secOpen - secClose };
}

console.log('=== Balance for different cut points ===');
for (let cut = 955; cut <= 970; cut++) {
  const x = scan(cut);
  console.log('keep=' + cut.toString().padStart(4) +
    ' | dOpen=' + x.divOpen + ' dClose=' + x.divClose +
    ' divBal=' + x.divNet +
    ' | sOpen=' + x.secOpen + ' sClose=' + x.secClose +
    ' secBal=' + x.secNet);
}
