const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

// Find exact start and end indices for the corrupted block
// Start: line 1048 (index 1047, empty line before the corrupt content)
// Actually we want to delete lines 1049-1099 (the corrupt content)
// and then keep lines 1100+
// But lines 1066-1099 are JSX-ish content whose closing tags are at 1097-1103
// We need to keep only:  supplementary section + file list comment + rest of file

const part1_lines = lines.slice(0, 1048);   // everything up to and incl the empty line 1048
const tail_lines = lines.slice(1129, );       // from "// FILE LIST VIEW" line 1130 onwards

console.log('Part 1 lines:', part1_lines.length, '(original 0-1048)');

const new_section = [
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

const final_content = part1_lines.join('\n') + '\n' + new_section + '\n' + tail_lines.join('\n') + '\n';

// Write to a temp file first for inspection
fs.writeFileSync('_fixed_preview.txt', final_content);

// Verify last 20 lines
const final_lines = final_content.split('\n');
console.log('Total lines:', final_lines.length);
console.log('Last 20 lines:');
for (let i = final_lines.length - 20; i < final_lines.length; i++) {
  console.log((i + 1).toString().padStart(5) + ' | ' + JSON.stringify(final_lines[i]).slice(0, 100));
}
