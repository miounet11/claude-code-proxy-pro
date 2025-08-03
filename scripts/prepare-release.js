/**
 * 准备发布脚本
 * 自动化发布流程
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 准备发布 Claude Code Proxy Pro v4.0.1...\n');

// 步骤 1: 清理
console.log('📦 步骤 1: 清理旧文件...');
try {
    execSync('npm run build:clean', { stdio: 'inherit' });
    console.log('✅ 清理完成\n');
} catch (error) {
    console.error('❌ 清理失败:', error.message);
    process.exit(1);
}

// 步骤 2: 安装依赖
console.log('📦 步骤 2: 安装依赖...');
try {
    // 先删除可能有问题的依赖
    if (fs.existsSync('node_modules/node-pty')) {
        console.log('删除旧的 node-pty...');
        execSync('rm -rf node_modules/node-pty', { stdio: 'inherit' });
    }
    
    // 重新安装
    console.log('重新安装依赖...');
    execSync('npm install', { stdio: 'inherit' });
    
    // 重建原生模块
    console.log('重建 Electron 原生模块...');
    execSync('npm run postinstall', { stdio: 'inherit' });
    
    console.log('✅ 依赖安装完成\n');
} catch (error) {
    console.error('❌ 依赖安装失败:', error.message);
    console.log('\n💡 提示: 如果 node-pty 编译失败，可以尝试:');
    console.log('1. 更新 Xcode Command Line Tools: xcode-select --install');
    console.log('2. 使用 Python 3: npm config set python python3');
    console.log('3. 清理缓存: npm cache clean --force\n');
}

// 步骤 3: 构建测试
console.log('📦 步骤 3: 构建测试...');
try {
    // 测试主要文件是否存在
    const mainFile = path.join(__dirname, '../src/main/main-vscode-style.js');
    const htmlFile = path.join(__dirname, '../public/index-vscode-style.html');
    
    if (!fs.existsSync(mainFile)) {
        throw new Error('主进程文件不存在: ' + mainFile);
    }
    if (!fs.existsSync(htmlFile)) {
        throw new Error('主界面文件不存在: ' + htmlFile);
    }
    
    console.log('✅ 文件检查通过\n');
} catch (error) {
    console.error('❌ 构建测试失败:', error.message);
    process.exit(1);
}

// 步骤 4: 更新版本信息
console.log('📦 步骤 4: 更新版本信息...');
const packageJson = require('../package.json');
console.log(`当前版本: ${packageJson.version}`);
console.log('✅ 版本信息确认\n');

// 步骤 5: 构建选项
console.log('📦 步骤 5: 选择构建平台...');
console.log('请运行以下命令进行构建:');
console.log('');
console.log('  构建当前平台:     npm run build');
console.log('  构建 Windows:     npm run build:win');
console.log('  构建 macOS:       npm run build:mac');
console.log('  构建 Linux:       npm run build:linux');
console.log('  构建所有平台:     npm run build:all');
console.log('');
console.log('  发布到 GitHub:    npm run release:publish');
console.log('');

// 步骤 6: 发布前检查清单
console.log('📋 发布前检查清单:');
console.log('  [ ] 测试 VSCode 风格界面');
console.log('  [ ] 测试集成终端功能');
console.log('  [ ] 测试 Claude 对话功能');
console.log('  [ ] 测试一键启动功能');
console.log('  [ ] 检查多平台兼容性');
console.log('  [ ] 更新 GitHub Release Notes');
console.log('  [ ] 准备发布公告');
console.log('');

console.log('🎉 准备工作完成！');
console.log('');
console.log('⚠️  注意事项:');
console.log('1. 如果 node-pty 构建失败，可以临时注释掉终端功能');
console.log('2. 确保有 GitHub token 用于发布');
console.log('3. 建议先在本地测试构建的应用');
console.log('4. Windows 构建需要代码签名证书');
console.log('');