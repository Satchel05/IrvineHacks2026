
const { spawn } = require('child_process');

console.log('=== SERVER STARTING ===');
console.log('PORT:', process.env.PORT);
console.log('HOSTNAME:', process.env.HOSTNAME);
console.log('NODE_VERSION:', process.version);
console.log('CWD:', process.cwd());

const port = process.env.PORT || 3000;
const host = process.env.HOSTNAME || '0.0.0.0';
console.log(`Starting next on ${host}:${port}`);

const child = spawn('npx', ['next', 'start', '-p', port, '-H', host], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

child.stdout.on('data', (data) => {
  process.stdout.write(`[NEXT STDOUT] ${data}`);
});

child.stderr.on('data', (data) => {
  process.stderr.write(`[NEXT STDERR] ${data}`);
});

child.on('error', (err) => {
  console.error('SPAWN ERROR:', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  console.log(`CHILD EXITED WITH CODE: ${code}, SIGNAL: ${signal}`);
  if (code !== 0) {
    console.error('Next.js failed to start. Check build output and dependencies.');
  }
  process.exit(code || 1);
});
