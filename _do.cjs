const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const orig = fs.readFileSync(f, 'utf8');
const L = orig.split('\n');
console.log('Current:', L.length, 'lines');

// ── Replace lines 1049–1096 (1-based) ───────────────────────────────────────
// 0-indexed target indices: 1048 … 1095
// Keep everything before index 1048 → slice(0, 1048)
// Keep nothing after index 1095 → slice(1096) — but currently the file only goes to ~1096

const beforeSig = [
  // Schema section: Indent 10, JSX sibling inside <div className="max-w-[1400px]">
  '        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
  '          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">',
  '            <div className="flex items-center gap-2">',
  '              <ShieldCheck size={16} className="text-green-400" />',
  '              <h3 className="text-sm font-bold text-white">Schema Discovery &amp; Backfill Status</h3>',
  '            </div>',
  '            <div className="grid grid-cols-3 gap-4 text-xs">',
  '              <InfoCard',
  '                label="Schema Validation"',
  '                items={["Database","Passed (6/6)","Column coverage","Complete"]}',
  '              />',
  '              <InfoCard',
  '                label="Backfill Tracking"',
  '                items={["EUR receipts","92 / 103","Coin revisions","52 / 280"]}',
  '              />',
  '              <InfoCard label="Data Sources"',
  '                items={["coin_transactions","purchase_ledger","manual_coin_orders"]}',
  '              />',
  '            </div>',
  '          </section>',
  '        </div>',
  '',
  // ── Close JSX: close purchase-table section + all wrapper divs ────
  '        </section>',
  '      </div>',
  '    </div>',
  '        </div>',
  '  }',
  '',
  '// ════════════════════════════════════════════════════════════════════════════',
  '// FILE LIST VIEW (for per-purchase attachments displayed in the table)',
  '// ════════════════════════════════════════════════════════════════════════════',
];

const before = L.slice(0, 1048);   // 0..1047 → 1048 items
const final = [...before, ...beforeSig];
fs.writeFileSync(f, final.join('\n'), 'utf8');

const V = fs.readFileSync(f, 'utf8').split('\n');
console.log('Written', V.length, 'lines');
console.log('Lines 1091-end:');
for (let i = 1090; i < V.length; i++)
  console.log((i+1).toString().padStart(4) + '  ' + JSON.stringify(V[i]).slice(0,100));
