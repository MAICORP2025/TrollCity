const { execFileSync } = require('child_process');
const path = require('path');

describe('adminSupabaseUsage route module', () => {
  it('loads without crashing when executed by Node in CommonJS mode', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const output = execFileSync(process.execPath, ['-e', "require('./server/api/adminSupabaseUsage.js')"], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    }).toString();

    expect(output).toBe('');
  });
});
