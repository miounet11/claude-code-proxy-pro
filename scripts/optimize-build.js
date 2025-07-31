const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 构建优化脚本
 * 用于优化应用程序的构建体积和性能
 */

console.log('🚀 开始构建优化...\n');

// 1. 清理不必要的文件
console.log('📦 清理构建文件...');
const cleanPatterns = [
  'dist',
  'node_modules/.cache',
  '**/*.log',
  '**/.DS_Store',
  '**/Thumbs.db'
];

cleanPatterns.forEach(pattern => {
  try {
    execSync(`rm -rf ${pattern}`, { stdio: 'inherit' });
  } catch (error) {
    // 忽略不存在的文件
  }
});

// 2. 优化 package.json
console.log('\n📋 优化 package.json...');
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// 创建生产环境的 package.json
const prodPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  main: packageJson.main,
  author: packageJson.author,
  license: packageJson.license,
  dependencies: packageJson.dependencies
};

// 3. 安装生产依赖
console.log('\n📥 安装生产依赖...');
fs.writeFileSync(
  path.join(__dirname, '..', 'package.prod.json'),
  JSON.stringify(prodPackageJson, null, 2)
);

try {
  execSync('npm ci --production --no-audit --prefer-offline', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('依赖安装失败:', error.message);
}

// 4. 压缩源代码（可选）
console.log('\n🗜️  准备源代码压缩...');
try {
  // 安装 terser 如果需要
  const terserInstalled = fs.existsSync(path.join(__dirname, '..', 'node_modules', 'terser'));
  if (!terserInstalled) {
    console.log('安装代码压缩工具...');
    execSync('npm install --save-dev terser', { stdio: 'inherit' });
  }
  
  // 压缩主进程代码
  const srcDir = path.join(__dirname, '..', 'src');
  const jsFiles = findJsFiles(srcDir);
  
  console.log(`找到 ${jsFiles.length} 个 JavaScript 文件`);
  
  // 注意：在生产环境中可以启用压缩
  // jsFiles.forEach(file => {
  //   const command = `npx terser ${file} -o ${file} -c -m`;
  //   execSync(command);
  // });
  
} catch (error) {
  console.warn('代码压缩跳过:', error.message);
}

// 5. 创建构建信息文件
console.log('\n📝 生成构建信息...');
const buildInfo = {
  version: packageJson.version,
  buildTime: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  env: process.env.NODE_ENV || 'production'
};

fs.writeFileSync(
  path.join(__dirname, '..', 'build-info.json'),
  JSON.stringify(buildInfo, null, 2)
);

// 6. 优化 Electron 构建配置
console.log('\n⚡ 检查 Electron 构建配置...');
const electronBuilderConfig = packageJson.build;

// 检查必要的配置
const requiredConfigs = [
  'compression',
  'asar',
  'asarUnpack',
  'files'
];

requiredConfigs.forEach(config => {
  if (!electronBuilderConfig[config]) {
    console.warn(`⚠️  缺少配置: ${config}`);
  }
});

// 7. 生成构建报告
console.log('\n📊 生成构建报告...');
const report = {
  timestamp: new Date().toISOString(),
  packageSize: getDirectorySize(path.join(__dirname, '..', 'node_modules')),
  sourceSize: getDirectorySize(path.join(__dirname, '..', 'src')),
  dependencies: Object.keys(packageJson.dependencies || {}).length,
  devDependencies: Object.keys(packageJson.devDependencies || {}).length,
  optimizations: {
    asar: electronBuilderConfig.asar || false,
    compression: electronBuilderConfig.compression || 'normal',
    filesExcluded: electronBuilderConfig.files?.filter(f => f.startsWith('!')).length || 0
  }
};

fs.writeFileSync(
  path.join(__dirname, '..', 'build-report.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n✅ 构建优化完成！');
console.log('\n📊 构建报告:');
console.log(`  - 依赖包大小: ${formatBytes(report.packageSize)}`);
console.log(`  - 源代码大小: ${formatBytes(report.sourceSize)}`);
console.log(`  - 生产依赖数: ${report.dependencies}`);
console.log(`  - 开发依赖数: ${report.devDependencies}`);
console.log(`  - ASAR 打包: ${report.optimizations.asar ? '✓' : '✗'}`);
console.log(`  - 压缩级别: ${report.optimizations.compression}`);

// 工具函数
function findJsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files.push(...findJsFiles(fullPath));
    } else if (stat.isFile() && item.endsWith('.js')) {
      files.push(fullPath);
    }
  });
  
  return files;
}

function getDirectorySize(dir) {
  let size = 0;
  
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        size += getDirectorySize(filePath);
      } else {
        size += stat.size;
      }
    });
  } catch (error) {
    // 忽略错误
  }
  
  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}