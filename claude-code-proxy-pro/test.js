// Simple test file for CI
console.log('Running basic tests...');

// Basic sanity checks
try {
  // Check package.json
  const pkg = require('./package.json');
  console.log(`✓ Package name: ${pkg.name}`);
  console.log(`✓ Version: ${pkg.version}`);
  
  // Check if main files exist
  const fs = require('fs');
  const path = require('path');
  
  const filesToCheck = [
    'src/main/main.js',
    'src/main/proxy-manager.js',
    'src/main/environment.js',
    'src/preload/preload.js',
    'public/index.html'
  ];
  
  filesToCheck.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`✓ File exists: ${file}`);
    } else {
      throw new Error(`Missing file: ${file}`);
    }
  });
  
  console.log('\nAll basic tests passed!');
  process.exit(0);
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}