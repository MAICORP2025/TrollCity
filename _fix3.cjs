"use strict";
const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const orig = fs.readFileSync(file, 'utf8');
const L = orig.split('\n');
console.log('Working from', L.length, 'lines');

// ── Slice boundaries ────────────────────────────────────────────────────────
// Keep: lines 0 – 1047  (0-indexed)  → everything up to `        )}`  (line 1048=1-based)
// Replace: lines 1048 – 1128  (0-indexed) → the whole corrupted block
// Keep: lines 1129 onwards  (1130+ = trailing comments after Backup info)
//
// The lost-but-necessary pieces inside the corrupt block are:
//   a) The clean InfoCard() function  (originally at 1-based 1116-1127)
//   b) The // FILE LIST / comment divider (originally at 1-based 1129-1131)
//   c) The outermost JSX closing tags:
//          </section>      // closes <section className="space-y-3">  (line 961)
//          </div>          // closes <div className="overflow-x-auto">   (line 876)
//          </div>          // closes the overflow-hidden wrapper           (line 875)
//          </div>          // closes <div className="min-h-screen …">       (line 777)
//          }               // closes the component function body          (line 1103)

const replacement = [
  // ── (a) restore InfoCard() helper that the original had here ──────────────
  'function InfoCard({ label, items }: { label: string; items: string[] }) {',
  '  return (',
  '    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">',
  '      <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">{label}</h4>',
  '      <ul className="space-y-0.5">',
  '        {items.map((item, i) => (',
  '          <li key={i} className="text-slate-400 leading-tight">{item}</li>',
  '        ))}',
  '      </ul>',
  '    </div>',
  '  )',
  '}',
  '',
  // ── (b) replace the JSX that was corrupted with clean Schema section ───────
  '        {/* ════ SCHEMA DISCOVERY & DATA SOURCES ════ */}',
  '        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
  '          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">',
  '            <div className="flex items-center gap-2">',
  '              <FileText size={16} className="text-cyan-400" />',
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
  // ── (c) close the outermost JSX + function ──────────────────────────────────
  // Indent 8: closes <section className="space-y-3"> around the purchase table
  '        </section>',
  // close <div className="overflow-x-auto"> (line 876)  — same as backup line 1097 (indent 6)
  '      </div>',
  // close <div className="overflow-x-auto">  (indent 4)
  '    </div>',
  // close <div className="min-h-screen … p-4 md:p-6"> (indent 2)
  '        </div>',
  '  }',

  // ── (d) trailing comments kept from original ───────────────────────────────
  '',
  '// End of cohort - total 1vve lanes',

  // ── (e) FILE LIST SECTION divider ──────────────────────────────────────────
  '',
  '// ════════════════════════════════════════════════════════════════════════════',
  '// FILE LIST VIEW (for per-purchase attachments displayed in the table)',
  '// ════════════════════════════════════════════════════════════════════════════',
].join('\n');

const before = L.slice(0, 1048);
const after  = L.slice(1129);
const result = [...before, ...replacement.split('\n'), ...after];
fs.writeFileSync(file, result.join('\n'), 'utf8');

const V = fs.readFileSync(file, 'utf8').split('\n');
console.log('Fixed file is', V.length, 'lines');

// Show boundaries
console.log('--- Lines 1046-1067 ---');
for (let i = 1045; i <= 1067; i++)
  console.log((i + 1).toString().padStart(4) + ' | ' + JSON.stringify(V[i]).slice(0, 120));

console.log('--- Lines 1073-end ---');
for (let i = 1072; i < V.length; i++)
  console.log((i + 1).toString().padStart(4) + ' | ' + JSON.stringify(V[i]).slice(0, 120));

// Verify no corruption markers remain
const badWords = ['=======', 'layer crop', 'navigator.clipboard', 'const query = false',
                  'Source Alignment', 'QR merge', '1vee', '1vve'];
let ok = true;
badWords.forEach(w => {
  for (let i = 1048; i < 1103; i++) {
    if ((V[i] || '').includes(w)) { ok = false; console.log('BAD:', i+1, w); }
  }
});
console.log(ok ? 'No corruption markers in replacement zone' : 'CORRUPTION REMAINS');
