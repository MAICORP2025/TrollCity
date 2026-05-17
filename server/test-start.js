const { spawn } = require('child_process');

console.log('Starting server...');
const server = spawn('node', ['index.js'], {
  cwd: __dirname,
  stdio: 'pipe',
  shell: true
});

server.stdout.on('data', (data) => {
  const text = data.toString();
  console.log('[SERVER]', text.trim());
  if (text.includes('Server running')) {
    console.log('Server reported running - testing connection...');
    setTimeout(() => {
      const http = require('http');
      const req = http.get('http://localhost:3002/api/health', (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log('\n✅ HTTP', res.statusCode, '-', body.trim());
          server.kill();
          process.exit(0);
        });
      });
      req.on('error', (err) => {
        console.log('\n❌ Connection error:', err.message);
        server.kill();
        process.exit(1);
      });
      req.setTimeout(3000, () => {
        console.log('\n❌ Request timeout');
        req.destroy();
        server.kill();
        process.exit(1);
      });
    }, 1000);
  }
});

server.stderr.on('data', (data) => {
  console.error('[SERVER-ERR]', data.toString().trim());
});

server.on('exit', (code) => {
  console.log('\nServer exited with code:', code);
});
