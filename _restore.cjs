const fs = require('fs');
console.log('Restoring from backup...');
const content = fs.readFileSync('src/pages/admin/CoinPackPurchasesLedger.tsx.bak', 'utf8');
fs.writeFileSync('src/pages/admin/CoinPackPurchasesLedger.tsx', content);
console.log('Restored. Lines:', content.split('\n').length);
