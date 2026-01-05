import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src', 'pages', 'Profile.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const newContent = content.replace(/\s*\/\/ @ts-expect-error Supabase JS types omit abortSignal option\s*\n/g, '\n');

fs.writeFileSync(filePath, newContent);
console.log('Updated Profile.tsx');
