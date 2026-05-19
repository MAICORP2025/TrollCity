"use strict";
const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(file, 'utf8').split('\n');

console.log('State before:', L.length, 'lines');
console.log('Line 1048:', JSON.stringify(L[1047]));
console.log('Line 1049:', JSON.stringify(L[1048]));

// ── Build the replacement block ─────────────────────────────────────────────
// We replace lines 1049-1076 (0-indexed 1048-1075) inclusive.
//   - Remove all corruption
//   - Insert InfoCard helper (inside component, same scope as original file)
//   - Insert Schema section at indent 8 (results of JSX child of max-w-[1400px] container)
//   - Insert proper closing JSX

const replacement = [
  '',                                           // l
  'function InfoCard({ label, items }: { label: string; items: string[] }) {',  // l
  '  return (',                                 // l
  '    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">', // l
  '      <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">{label}</h4>', // l
  '      <ul className="space-y-0.5">',           // l
  '        {items.map((item, i) => (',            // l
  '          <li key={i} className="text-slate-400 leading-tight">{item}</li>', // l
  '        ))}',                                  // l
  '      </ul>',                                  // l
  '    </div>',                                   // l
  '  )',                                         // l
  '}',                                           // l
  '',                                             // l
  // Schema section at indent 8 = child of <div className="max-w-[1400px] mx-auto space-y-6">
  '        {/* ════ SCHEMA DISCOVERY & DATA SOURCES ════ */}', // l
  '        <section',
  '          className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">', // l
  '          <div className="flex items-center gap-2">', // l
  '            <FileText size={16} className="text-cyan-400" />', // l
  '            <h3 className="text-sm font-bold text-white">Schema Discoveries &amp; Backfill Status</h3>', // l
  '          </div>',                                              // l
  '          <div className="grid grid-cols-3 gap-4 text-xs">',    // l
  '            <InfoCard',                                         // l
  '              label="Schema Validation"',                       // l
  '              items={["Database","Passed (6/6)","Column coverage","Complete"]}', // l
  '            />',                                                // l
  '            <InfoCard',                                         // l
  '              label="Backfill Tracking"',                       // l
  '              items={["EUR receipts","92 / 103","Coin revisions","52 / 280"]}', // l
  '            />',                                                // l
  '            <InfoCard',                                         // l
  '              label="Data Sources"',                            // l
  '              items={["coin_transactions","purchase_ledger","manual_coin_orders"]}', // l
  '            />',                                                // l
  '          </div>',                                              // l
  '        </section>',                                            // l
  '',                                                              // l
  // Close the purchase-table section (opened at line 860)
  '        </section>',
  // Close <div className="overflow-x-auto"> (opened inside table wrapper)
  '      </div>',
  // Close <div className="overflow-hidden ..."> 
  '    </div>',
  // Close <div className="max-w-[1400px]">
  '    </div>',
  // </minh>  <div className="minh-screen">
  '  </div>',            // closes minh-screen `<div>` opened at indent 2
  '}',                    // close component function
].join('\n');

const before = L.slice(0, 1048); // keep lines 1 to 1048
const after = L.slice(1076);     // nothing after line 1076 (it's all tail comments)
const result = [...before, ...replacement.split('\n'), ...after];
fs.writeFileSync(file, result.join('\n'), 'utf8');

const V = fs.readFileSync(file, 'utf8').split('\n');
console.log('New file has', V.length, 'lines');

// Show surrounding area
console.log('--- Lines 1046-1100 ---');
for (let i = 1045; i < Math.min(1100, V.length); i++)
  console.log((i+1).toString().padStart(4)+'|sp='+(V[i].match(/^ */)[0].length).toString().padStart(2)+'|'+JSON.stringify(V[i]).slice(0,110));
