const { execSync } = require('child_process');
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit', cwd: '/Users/shaunak/.openclaw/workspace/product-studio-v2' });
  console.log('OK');
} catch (e) {
  console.log('Failed');
}
