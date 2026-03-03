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
  stdio: 'inherit',
  shell: true
});

child.on('error', (err) => {
  console.error('SPAWN ERROR:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log('CHILD EXITED WITH CODE:', code);
  process.exit(code || 0);
});
