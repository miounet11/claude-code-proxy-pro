const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 构建后处理脚本
 * 在 electron-builder 构建完成后执行
 */

console.log('📦 执行构建后处理...\n');

const distDir = path.join(__dirname, '..', 'dist');

// 检查 dist 目录
if (!fs.existsSync(distDir)) {
  console.error('❌ dist 目录不存在');
  process.exit(1);
}

// 1. 生成文件校验和
console.log('🔐 生成文件校验和...');
const checksums = {};
const files = getAllFiles(distDir);

files.forEach(file => {
  if (file.endsWith('.yml') || file.endsWith('.yaml') || file.endsWith('.json')) {
    return; // 跳过配置文件
  }
  
  const relativePath = path.relative(distDir, file);
  const content = fs.readFileSync(file);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  checksums[relativePath] = hash;
  
  console.log(`  ✓ ${relativePath}`);
});

// 保存校验和文件
const checksumsFile = path.join(distDir, 'checksums.json');
fs.writeFileSync(checksumsFile, JSON.stringify(checksums, null, 2));
console.log(`\n✅ 校验和已保存到: ${checksumsFile}`);

// 2. 生成安装说明
console.log('\n📝 生成安装说明...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = packageJson.version;

const installGuide = `# Claude Code Proxy Pro v${version} 安装指南

## Windows 安装

1. 下载对应您系统架构的安装包：
   - 64位系统: Claude Code Proxy Pro-${version}-win-x64.exe
   - 32位系统: Claude Code Proxy Pro-${version}-win-ia32.exe

2. 双击运行安装程序，按照向导完成安装

3. 安装完成后，可以从开始菜单或桌面快捷方式启动应用

## macOS 安装

1. 下载对应您系统架构的安装包：
   - Intel Mac: Claude Code Proxy Pro-${version}-mac-x64.dmg
   - Apple Silicon (M1/M2): Claude Code Proxy Pro-${version}-mac-arm64.dmg

2. 双击打开 DMG 文件

3. 将 Claude Code Proxy Pro 拖拽到 Applications 文件夹

4. 首次运行时，可能需要在"系统偏好设置 > 安全性与隐私"中允许运行

## Linux 安装

### AppImage (推荐)
1. 下载 Claude Code Proxy Pro-${version}-linux-x64.AppImage

2. 添加执行权限：
   \`\`\`bash
   chmod +x Claude Code Proxy Pro-${version}-linux-x64.AppImage
   \`\`\`

3. 直接运行：
   \`\`\`bash
   ./Claude Code Proxy Pro-${version}-linux-x64.AppImage
   \`\`\`

### DEB 包 (Debian/Ubuntu)
1. 下载 Claude Code Proxy Pro-${version}-linux-x64.deb

2. 安装：
   \`\`\`bash
   sudo dpkg -i Claude Code Proxy Pro-${version}-linux-x64.deb
   sudo apt-get install -f  # 安装依赖
   \`\`\`

### RPM 包 (RedHat/CentOS/Fedora)
1. 下载 Claude Code Proxy Pro-${version}-linux-x64.rpm

2. 安装：
   \`\`\`bash
   sudo rpm -i Claude Code Proxy Pro-${version}-linux-x64.rpm
   \`\`\`

## 验证安装

使用提供的 checksums.json 文件验证下载文件的完整性。

## 问题反馈

如果遇到安装问题，请访问: https://github.com/yourusername/claude-code-proxy-pro/issues
`;

fs.writeFileSync(path.join(distDir, 'INSTALL.md'), installGuide);
console.log('✅ 安装说明已生成');

// 3. 生成版本信息文件
console.log('\n📋 生成版本信息...');
const releaseInfo = {
  version: version,
  releaseDate: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  electron: packageJson.devDependencies.electron,
  files: Object.keys(checksums).map(file => ({
    name: path.basename(file),
    path: file,
    size: fs.statSync(path.join(distDir, file)).size,
    checksum: checksums[file]
  }))
};

fs.writeFileSync(path.join(distDir, 'release-info.json'), JSON.stringify(releaseInfo, null, 2));
console.log('✅ 版本信息已生成');

// 4. 创建便携版配置（如果是便携版）
const portableExe = files.find(f => f.includes('Portable') && f.endsWith('.exe'));
if (portableExe) {
  console.log('\n🎒 配置便携版...');
  const portableDir = path.dirname(portableExe);
  const portableConfig = {
    portable: true,
    dataDir: './data',
    configDir: './config'
  };
  
  fs.writeFileSync(
    path.join(portableDir, 'portable.json'),
    JSON.stringify(portableConfig, null, 2)
  );
  console.log('✅ 便携版配置已创建');
}

// 5. 压缩源代码（用于合规）
console.log('\n📦 打包源代码...');
try {
  const sourceArchive = path.join(distDir, `source-${version}.tar.gz`);
  const excludes = [
    '--exclude=node_modules',
    '--exclude=dist',
    '--exclude=.git',
    '--exclude=*.log'
  ].join(' ');
  
  require('child_process').execSync(
    `tar -czf "${sourceArchive}" ${excludes} -C "${path.join(__dirname, '..')}" .`,
    { stdio: 'inherit' }
  );
  console.log('✅ 源代码已打包');
} catch (error) {
  console.warn('⚠️  源代码打包失败:', error.message);
}

console.log('\n🎉 构建后处理完成！');

// 输出构建摘要
console.log('\n📊 构建摘要:');
const totalSize = files.reduce((sum, file) => {
  const stat = fs.statSync(file);
  return sum + (stat.isFile() ? stat.size : 0);
}, 0);

console.log(`  - 总文件数: ${files.length}`);
console.log(`  - 总大小: ${formatBytes(totalSize)}`);
console.log(`  - 版本: ${version}`);
console.log(`  - 构建时间: ${new Date().toLocaleString()}`);

// 工具函数
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}