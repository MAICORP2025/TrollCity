"use strict";
const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
console.log('Starting from', lines.length, 'lines');

// Remove corrupted lines 1049-1129 (0-indexed 1048-1128)
// Replace with fresh section
const newInsert = [
  '',
  '        {/* ════ SCHEMA DISCOVERY & DATA SOURCES ════ */}',
  '        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
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

// Replace lines 1049-1129 (inclusive) with newInsert
// That is: keep [0..1048), insert newInsert, then keep [1129..end)
const before = lines.slice(0, 1048);   // 0-indexed 0 to 1047
const after  = lines.slice(1129);       // 0-indexed 1129 onward (index 1129 is line 1130)

const result = [...before, ...newInsert.split('\n'), ...after];
fs.writeFileSync(file, result.join('\n'), 'utf8');

// Quick validation
const v = fs.readFileSync(file, 'utf8').split('\n');
console.log('New file length:', v.length);

// Show boundary
console.log('--- Lines 1046-1056 after fix ---');
for (let i = 1045; i <= 1055; i++) {
  console.log((i + 1).toString().padStart(4) + ' | ' + JSON.stringify(v[i]).slice(0, 110));
}
console.log('--- Last 10 lines ---');
for (let i = v.length - 10; i < v.length; i++) {
  console.log((i + 1).toString().padStart(4) + ' | ' + JSON.stringify(v[i]).slice(0, 110));
}
