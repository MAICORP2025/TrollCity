const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, 'supabase/migrations_backup');
const files = fs.readdirSync(backupDir);

const versions = [...new Set(files
    .filter(f => f.endsWith('.sql'))
    .map(f => f.split('_')[0])
)].sort();

const command = `npx supabase migration repair --status reverted ${versions.join(' ')}`;

console.log(command);
