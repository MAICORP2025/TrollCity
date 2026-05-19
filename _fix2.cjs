const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const content = fs.readFileSync(file, 'utf8');
const orig_lines = content.split('\n');
console.log('Input file lines:', orig_lines.length);

const before = orig_lines.slice(0, 1048);
const after  = orig_lines.slice(1129);

const replacementBlock = [
    '        {/* ════ DATA SOURCES ════ */}',
    '        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
    '          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">',
    '            <div className="flex items-center gap-2">',
    '              <ShieldCheck size={16} className="text-green-400" />',
    '              <h3 className="text-sm font-bold text-white">Schema Discovery &amp; Backfill Status</h3>',
    '            </div>',
    '            <div className="grid grid-cols-3 gap-4 text-xs">',
    '              <InfoCard',
    '                label="Schema Validation"',
    '                items={["Database", "Passed (6/6)", "Column coverage", "Complete"]}',
    '              />',
    '              <InfoCard',
    '                label="Backfill Tracking"',
    '                items={["EUR receipts", "92 / 103", "Coin revisions", "52 / 280"]}',
    '              />',
    '              <InfoCard',
    '                label="Data Sources"',
    '                items={["coin_transactions", "purchase_ledger", "manual_coin_orders"]}',
    '              />',
    '            </div>',
    '          </section>',
    '        </div>',
    '',
    '        {/* ════ FILE LIST VIEW (for per-purchase attachments displayed in the table) ════ */}',
].join('\n');

const finalLines = [...before, replacementBlock, ...after];
console.log('before.length:', before.length);
console.log('after.length:', after.length);
console.log('replacementBlock lines:', replacementBlock.split('\n').length);
console.log('Final total lines:', finalLines.length);

fs.writeFileSync(file, finalLines.join('\n'), 'utf8');

// Verify
const verify = fs.readFileSync(file, 'utf8').split('\n');
console.log('Verify lines:', verify.length);

// Check no corruption markers remain
const markers = ['=======', 'layer crop', 'const query = false', 'navigator.clipboard', 'Source Alignment', 'QR merge'];
let hasProblem = false;
markers.forEach(m => {
  for(let i = 1048; i <= 1100; i++) {
    if((verify[i]||'').includes(m)) {
      console.log('PROBLEM:', i+1, JSON.stringify(verify[i]));
      hasProblem = true;
    }
  }
});
console.log(hasProblem ? 'PROBLEMS FOUND' : 'Clean: no corruption markers in replacement zone');

// Verify tag balance
let openTags = 0, closeTags = 0;
for(let i = 1048; i < 1103; i++) {
  const s = verify[i] || '';
  openTags += (s.match(/<section|<div/g)||[]).length;
  closeTags += (s.match(/<\/section|<\/div/g)||[]).length;
}
console.log('JSX tags in zone: open='+openTags+' close='+closeTags+(openTags===closeTags?' BALANCED':' MISMATCH!'));
