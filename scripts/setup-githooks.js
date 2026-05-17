/**
 * Setup Git hooks path to use repository's .githooks directory
 * This ensures all developers have the pre-commit protection active.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const HOOKS_DIR = '.githooks';
const HOOK_CONFIG = 'core.hooksPath';

function run() {
  try {
    // Check if we're in a git repository
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    } catch {
      console.log('⚠️  Not in a Git repository - skipping hooks setup');
      process.exit(0);
    }

    // Check if hooks path is already set
    try {
      const currentPath = execSync(`git config ${HOOK_CONFIG}`, { encoding: 'utf-8' }).trim();
      if (currentPath === HOOKS_DIR) {
        console.log('✅ Git hooks path already configured.');
        return;
      } else if (currentPath) {
        console.log(`⚠️  Git hooks path already set to "${currentPath}". Overwriting with "${HOOKS_DIR}"...`);
      }
    } catch {
      // Config not set, proceed
    }

    // Set the hooks path
    execSync(`git config ${HOOK_CONFIG} ${HOOKS_DIR}`, { stdio: 'pipe' });
    console.log(`✅ Git hooks configured: ${HOOK_CONFIG}=${HOOKS_DIR}`);

    // Verify the pre-commit hook exists
    const preCommitPath = resolve(HOOKS_DIR, 'pre-commit');
    if (!existsSync(preCommitPath)) {
      console.error(`❌ Pre-commit hook not found at ${preCommitPath}`);
      process.exit(1);
    }

    console.log('✅ Pre-commit protection active.');
    console.log('\n📋 Protected files:');
    console.log('   - src/pages/broadcast/SetupPage.tsx');
    console.log('   - src/pages/broadcast/BroadcastPage.tsx');
    console.log('   - src/lib/courtSessions.ts');
    console.log('   - server/index.js');
    console.log('   - server/api/broadcasts.js');
    console.log('   - server/routes/broadcasts.ts');
    console.log('   - server/services/muxService.js');
    console.log('   - supabase/functions/live/index.ts');
    console.log('\n⚠️  Any changes to these files will require explicit confirmation during commit.');
  } catch (err) {
    console.error('❌ Failed to setup Git hooks:', err.message);
    process.exit(1);
  }
}

run();
