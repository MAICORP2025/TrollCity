import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src', 'pages', 'Profile.tsx');
console.log(`Processing file: ${filePath}`);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const newContent = content.replace(/\s*\/\/ @ts-expect-error Supabase JS types omit abortSignal option\s*\n/g, '\n');

if (content === newContent) {
  console.log('No changes needed.');
} else {
  fs.writeFileSync(filePath, newContent);
  console.log('Updated Profile.tsx');
}
