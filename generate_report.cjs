const fs = require('fs');
const path = require('path');

// Read the already-parsed data
const data = JSON.parse(fs.readFileSync('migration_extract_clean.json', 'utf-8'));

// The baseline file has issues with the function/policy regex due to its size.
// Let me extract functions from baseline separately using a more targeted approach.
const baselineContent = fs.readFileSync(path.join('supabase', 'migrations', '20230101000000_baseline.sql'), 'utf-8');

// Extract functions from baseline - look for CREATE OR REPLACE FUNCTION "public"."name"
const funcRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"?public"?\."?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
const baselineFuncs = new Set();
let m;
while ((m = funcRegex.exec(baselineContent)) !== null) {
  baselineFuncs.add(m[1]);
}

// Extract triggers from baseline
const trigRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
const baselineTriggers = new Set();
while ((m = trigRegex.exec(baselineContent)) !== null) {
  baselineTriggers.add(m[1]);
}

// Extract views from baseline
const viewRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)/gi;
const baselineViews = new Set();
while ((m = viewRegex.exec(baselineContent)) !== null) {
  baselineViews.add(m[1]);
}

// Extract enums from baseline
const enumRegex = /CREATE\s+TYPE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s+ENUM/gi;
const baselineEnums = new Set();
while ((m = enumRegex.exec(baselineContent)) !== null) {
  baselineEnums.add(m[1]);
}

// Extract extensions from baseline
const extRegex = /CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
const baselineExts = new Set();
while ((m = extRegex.exec(baselineContent)) !== null) {
  baselineExts.add(m[1]);
}

// Extract policies from baseline - these are CREATE POLICY "name"
const polRegex = /CREATE\s+POLICY\s+"([a-zA-Z_][a-zA-Z0-9_]*)"/gi;
const baselinePols = new Set();
while ((m = polRegex.exec(baselineContent)) !== null) {
  baselinePols.add(m[1]);
}

// Extract indexes from baseline
const idxRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
const baselineIdx = new Set();
while ((m = idxRegex.exec(baselineContent)) !== null) {
  baselineIdx.add(m[1]);
}

// Extract sequences from baseline
const seqRegex = /CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
const baselineSeqs = new Set();
while ((m = seqRegex.exec(baselineContent)) !== null) {
  baselineSeqs.add(m[1]);
}

// Now build the report
const report = [];

function addSection(title, items) {
  if (items.length > 0) {
    report.push(`  ${title}:`);
    for (const item of items.sort()) {
      report.push(`    - ${item}`);
    }
  }
}

// Process each file
const fileOrder = Object.keys(data).filter(k => !k.startsWith('_'));

for (const filename of fileOrder) {
  const r = data[filename];
  if (r.error) {
    report.push(`\n## ${filename}`);
    report.push(`  FILE NOT FOUND`);
    continue;
  }

  report.push(`\n## ${filename}`);

  if (filename === '20230101000000_baseline.sql') {
    // Use the more accurate extractions
    addSection('TABLES CREATED', r.tables);
    addSection('FUNCTIONS CREATED', [...baselineFuncs]);
    addSection('TRIGGERS CREATED', [...baselineTriggers]);
    addSection('VIEWS CREATED', [...baselineViews].filter(v => !v.includes('MATERIALIZED')));
    addSection('MATERIALIZED VIEWS CREATED', [...baselineViews]);
    addSection('POLICIES CREATED', [...baselinePols]);
    addSection('INDEXES CREATED', [...baselineIdx]);
    addSection('ENUMS CREATED', [...baselineEnums]);
    addSection('EXTENSIONS ENABLED', [...baselineExts]);
    addSection('SEQUENCES CREATED', [...baselineSeqs]);
    addSection('STORAGE BUCKETS', r.storageBuckets);
    addSection('PUBLICATIONS', r.publications);
  } else {
    addSection('TABLES CREATED', r.tables);
    addSection('VIEWS CREATED', r.views);
    addSection('MATERIALIZED VIEWS CREATED', r.matViews);
    addSection('FUNCTIONS/PROCEDURES CREATED', r.functions);
    addSection('TRIGGERS CREATED', r.triggers);
    addSection('POLICIES CREATED', r.policies);
    addSection('INDEXES CREATED', r.indexes);
    addSection('TYPES CREATED', r.types || []);
    addSection('ENUMS CREATED', r.enums || []);
    addSection('EXTENSIONS ENABLED', r.extensions || []);
    addSection('SEQUENCES CREATED', r.sequences || []);
    addSection('STORAGE BUCKETS', r.storageBuckets || []);
    addSection('PUBLICATIONS', r.publications || []);
    addSection('COLUMNS ADDED', r.columns || []);

    const total = (r.tables||[]).length + (r.views||[]).length + (r.matViews||[]).length + (r.functions||[]).length + (r.triggers||[]).length + (r.policies||[]).length + (r.indexes||[]).length + (r.enums||[]).length + (r.extensions||[]).length + (r.columns||[]).length + (r.storageBuckets||[]).length + (r.publications||[]).length;
    if (total === 0) {
      report.push('  (no DDL objects - data/seed migration only)');
    }
  }
}

// Write report
const reportText = report.join('\n');
fs.writeFileSync('MIGRATION_OBJECTS_REPORT.md', reportText);
console.log('Report written to MIGRATION_OBJECTS_REPORT.md');
console.log('Total lines:', report.length);
