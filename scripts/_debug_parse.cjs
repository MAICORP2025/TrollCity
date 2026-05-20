const fs = require('fs');
const ts = require('typescript');
const filePath = 'src/components/broadcast/StagePassRequestsPanel.tsx';
const raw = fs.readFileSync(filePath, 'utf8');
const lines = raw.split('\n');

console.log(`Lines: ${lines.length}, bytes: ${raw.length}`);
// Show the crucial lines
for (let i = 80; i < 93; i++) {
  console.log(`L${i+1}: ${JSON.stringify(lines[i])}`);
}

// transpileModule gives diagnostics
const result = ts.transpileModule(raw, {
  options: {
    target: ts.ScriptTarget.ESNext,
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.ESNext,
    strict: false,
    esModuleInterop: true
  }
});

if (result.diagnostics.length > 0) {
  console.log('\nDiagnostics:');
  for (const d of result.diagnostics) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    const pos = d.start != null ? `[byte ${d.start}]` : '';
    console.log(`  ${pos}: ${msg}`);
  }
} else {
  console.log('\nNo diagnostics — file parses fine!');
}
