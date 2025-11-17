// Targeted syntax fixer for processUserPaymentMethod
const fs = require('fs');
const path = require('path');

function analyzeAndFix(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log('Analyzing file structure...');
  console.log(`Total lines: ${lines.length}`);
  
  // Count specific patterns
  const serveMatches = content.match(/serve\(/g) || [];
  const responseMatches = content.match(/new Response\(/g) || [];
  const fetchMatches = content.match(/await fetch\(/g) || [];
  const createClientMatches = content.match(/createClient\(/g) || [];
  
  console.log(`serve() calls: ${serveMatches.length}`);
  console.log(`new Response() calls: ${responseMatches.length}`);
  console.log(`await fetch() calls: ${fetchMatches.length}`);
  console.log(`createClient() calls: ${createClientMatches.length}`);
  
  // Check the last few lines
  console.log('\nLast 10 lines:');
  lines.slice(-10).forEach((line, i) => {
    console.log(`${lines.length - 9 + i}: ${line}`);
  });
  
  // Count parentheses in a more targeted way
  let parenCount = 0;
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i-1] : '';
    
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
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
  }
  
  console.log(`\nFinal counts:`);
  console.log(`Parentheses: ${parenCount} (should be 0)`);
  console.log(`Braces: ${braceCount} (should be 0)`);
  
  // Check for specific patterns that might be causing issues
  const problematicPatterns = [
    { pattern: /console\.error\([^)]*$/, name: 'Incomplete console.error' },
    { pattern: /new Response\([^)]*$/, name: 'Incomplete new Response' },
    { pattern: /JSON\.stringify\([^)]*$/, name: 'Incomplete JSON.stringify' },
  ];
  
  console.log('\nChecking for incomplete patterns:');
  problematicPatterns.forEach(({ pattern, name }) => {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`Found: ${name}`);
    }
  });
  
  return {
    parenCount,
    braceCount,
    isValid: parenCount === 0 && braceCount === 0
  };
}

const filePath = path.join(__dirname, 'processUserPaymentMethod/index.ts');
const result = analyzeAndFix(filePath);

console.log('\n' + '='.repeat(50));
if (result.isValid) {
  console.log('✅ File structure appears valid');
} else {
  console.log('❌ File has structural issues');
  console.log('The parentheses/braces mismatch needs to be fixed.');
}
console.log('='.repeat(50));