const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase/migrations');
const backupDir = path.join(__dirname, 'supabase/migrations_backup');

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

const files = fs.readdirSync(migrationsDir);
const cutoff = '20270218000000_remove_sav_vived_columns.sql';

files.forEach(file => {
    if (file.endsWith('.sql') && file < cutoff) {
        const oldPath = path.join(migrationsDir, file);
        const newPath = path.join(backupDir, file);
        console.log(`Moving ${file}`);
        fs.renameSync(oldPath, newPath);
    }
});

console.log('Done moving old migrations.');
