const fs = require('fs');
const ts = require('../node_modules/typescript');
const path = require('path');
const filePath = path.resolve(__dirname, '../src/components/admin/RTCAdminMonitor.tsx');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split(/\r?\n/);
const targetLine = 1728;
const offset = lines.slice(0, targetLine).reduce((sum, l) => sum + l.length + 1, 0);
const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, text, undefined, ts.ScriptKind.TSX);
const start = Math.max(0, offset - 100);
const end = offset + 100;
let tok;
while ((tok = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
  const tokenPos = scanner.getTokenPos();
  const tokenEnd = scanner.getTextPos();
  if (tokenPos >= start && tokenPos <= end) {
    console.log(ts.SyntaxKind[tok], JSON.stringify(text.slice(tokenPos, tokenEnd)), 'pos', tokenPos, 'end', tokenEnd);
  }
}
