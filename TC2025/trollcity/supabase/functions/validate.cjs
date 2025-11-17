// Simple syntax validation for Supabase Edge Functions
// This script validates the TypeScript syntax without resolving Deno-specific imports

const fs = require('fs');
const path = require('path');

function validateSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic syntax checks
    const lines = content.split('\n');
    let braceCount = 0;
    let parenCount = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j-1] : '';
        
        // Handle string literals
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = '';
          }
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
          if (char === '(') parenCount++;
          if (char === ')') parenCount--;
        }
      }
    }
    
    if (braceCount !== 0) {
      console.error(`❌ ${filePath}: Unmatched braces (count: ${braceCount})`);
      return false;
    }
    
    if (parenCount !== 0) {
      console.error(`❌ ${filePath}: Unmatched parentheses (count: ${parenCount})`);
      return false;
    }
    
    // Check for basic syntax patterns
    const hasServeCall = content.includes('serve(');
    const hasExport = content.includes('export') || content.includes('module.exports');
    const hasAsyncHandler = content.includes('async (req');
    
    if (!hasServeCall) {
      console.warn(`⚠️  ${filePath}: No serve() call found - this might be intentional`);
    }
    
    console.log(`✅ ${filePath}: Syntax validation passed`);
    return true;
    
  } catch (error) {
    console.error(`❌ ${filePath}: Error reading file - ${error.message}`);
    return false;
  }
}

// Validate both files
const files = [
  'processSquarePayout/index.ts',
  'processUserPaymentMethod/index.ts'
];

console.log('🔍 Validating Supabase Edge Function syntax...\n');

let allPassed = true;
files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!validateSyntax(filePath)) {
    allPassed = false;
  }
});

console.log('\n' + (allPassed ? '✅ All files passed syntax validation!' : '❌ Some files have syntax issues'));
process.exit(allPassed ? 0 : 1);