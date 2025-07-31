// Test electron-builder configuration
const fs = require('fs');
const path = require('path');

console.log('Checking build prerequisites...\n');

// Check required files
const requiredFiles = [
  'package.json',
  'src/main/main.js',
  'public/index.html',
  'build/icon.ico',
  'build/icon.icns',
  'build/icons/1024x1024.png'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Check package.json configuration
const pkg = require('./package.json');
console.log('\nBuild configuration:');
console.log('- App ID:', pkg.build?.appId || 'NOT SET');
console.log('- Product Name:', pkg.build?.productName || 'NOT SET');
console.log('- Main entry:', pkg.main || 'NOT SET');

// Check if electron-builder is installed
try {
  require.resolve('electron-builder');
  console.log('\n✓ electron-builder is installed');
} catch (e) {
  console.log('\n✗ electron-builder is NOT installed');
  allFilesExist = false;
}

// Check if electron is installed
try {
  require.resolve('electron');
  console.log('✓ electron is installed');
} catch (e) {
  console.log('✗ electron is NOT installed');
  allFilesExist = false;
}

if (!allFilesExist) {
  console.log('\n❌ Some prerequisites are missing!');
  process.exit(1);
} else {
  console.log('\n✅ All prerequisites are met!');
}