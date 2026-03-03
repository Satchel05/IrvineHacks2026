const { execSync } = require('child_process');

console.log('=== SERVER STARTING ===');
console.log('PORT:', process.env.PORT);
console.log('HOSTNAME:', process.env.HOSTNAME);
console.log('NODE_VERSION:', process.version);
console.log('CWD:', process.cwd());

try {
  const port = process.env.PORT || 3000;
  const host = process.env.HOSTNAME || '0.0.0.0';
  console.log(`Starting next on ${host}:${port}`);
  execSync(`npx next start -p ${port} -H ${host}`, { stdio: 'inherit' });
} catch (err) {
  console.error('STARTUP ERROR:', err);
  process.exit(1);
}
