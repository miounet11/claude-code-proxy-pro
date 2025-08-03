const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platform = process.argv[2];
if (!platform) {
  console.error('Please specify a platform: win, mac, or linux');
  process.exit(1);
}

console.log(`\n🔨 Building Claude Code Proxy Pro for ${platform}...\n`);

// Ensure dist directory exists
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// Check if electron-builder is available
try {
  execSync('npx electron-builder --version', { stdio: 'pipe' });
  console.log('✓ electron-builder is available');
} catch (error) {
  console.error('✗ electron-builder is not available');
  console.log('Installing electron-builder...');
  execSync('npm install electron-builder --save-dev', { stdio: 'inherit' });
}

// Build command
let buildCmd = 'npx electron-builder';

switch (platform) {
  case 'win':
    buildCmd += ' --win --x64 --ia32';
    break;
  case 'mac':
    buildCmd += ' --mac --x64 --arm64';
    break;
  case 'linux':
    buildCmd += ' --linux --x64';
    break;
  default:
    console.error('Invalid platform:', platform);
    process.exit(1);
}

// Add configuration - use package.json build config
buildCmd += ' --publish never'; // Don't publish automatically

console.log(`\nRunning: ${buildCmd}\n`);

try {
  execSync(buildCmd, { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      DEBUG: 'electron-builder'
    }
  });
  
  console.log('\n✅ Build completed successfully!');
  
  // List built files
  console.log('\n📦 Built files:');
  const files = fs.readdirSync(distPath);
  files.forEach(file => {
    const stats = fs.statSync(path.join(distPath, file));
    if (stats.isFile()) {
      const size = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`  - ${file} (${size} MB)`);
    }
  });
  
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}