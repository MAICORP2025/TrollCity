const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const content = fs.readFileSync(file, 'utf8');
const orig_lines = content.split('\n');

// lineNums are 1-based
// We replace everything from line 1049 (index 1048) to line 1129 (index 1128)
// Keep: lines [0, 1048]  and lines [1129, end]

const before = orig_lines.slice(0, 1048);
const after  = orig_lines.slice(1129);

const replacementBlock = [
    '',
    '        {/* ════ SUPPLIER USE CASES ════ */}',
    '        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
    '          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">',
    '            <div className="flex items-center gap-2">',
    '              <ShieldCheck size={16} className="text-green-400" />',
    '              <h3 className="text-sm font-bold text-white">Supplier Use Cases</h3>',
    '            </div>',
    '            <p className="text-xs text-slate-400 leading-relaxed">',
    '              Each supplier slot runs exactly once — sourced items flow through a single',
    '              validated path. Passes over simplified quantities without needing to re-fetch',
    '              audit rows from stale tables.',
    '            </p>',
    '          </section>',
    '          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">',
    '            <div className="flex items-center gap-2">',
    '              <FileText size={16} className="text-cyan-400" />',
    '              <h3 className="text-sm font-bold text-white">Schema Discovery &amp; Backfill Status</h3>',
    '            </div>',
    '            <div className="grid grid-cols-3 gap-4 text-xs mt-2">',
    '              <InfoCard',
    '                label="Schema Validation"',
    '                items={["Database","Passed (6/6)","Column coverage","Complete"]}',
    '              />',
    '              <InfoCard',
    '                label="Backfill Tracking"',
    '                items={["EUR receipts","92 / 103","Coin revisions","52 / 280"]}',
    '              />',
    '              <InfoCard',
    '                label="Data Sources"',
    '                items={["coin_transactions","purchase_ledger","manual_coin_orders"]}',
    '              />',
    '            </div>',
    '          </section>',
    '        </div>',
    '',
    '        {/* ════ FILE LIST VIEW (for per-purchase attachments displayed in the table) ════ */}',
];

const finalLines = [...before, ...replacementBlock, ...after];
fs.writeFileSync(file, finalLines.join('\n'), 'utf8');

// Verify
const verify = fs.readFileSync(file, 'utf8').split('\n');
console.log('Written lines:', verify.length);
console.log('Lines 1046-1049 after fix:');
for (let i = 1045; i <= 1052; i++) console.log((i + 1).toString().padStart(4) + ' | ' + JSON.stringify(verify[i]).slice(0, 100));
console.log('Lines 1138-end:');
for (let i = 1137; i < Math.min(1148, verify.length); i++)
  console.log((i + 1).toString().padStart(4) + ' | ' + JSON.stringify(verify[i]).slice(0, 100));

// Check for parseable nature (no double-closing tags at start of replacement)
let problems = 0;
for (let i = 1047; i <= 1100; i++) {
  const s = (verify[i] || '').trim();
  if (s === '=======' || s.startsWith('// QR') || s.startsWith('// End of')) {
    console.log('STILL HAS CORRUPTED LINE:', i + 1, JSON.stringify(s));
    problems++;
  }
}
console.log(problems === 0 ? 'OK: no corruption markers remain in replacement zone' : 'WARN: corruption markers still present');
