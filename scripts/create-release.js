#!/usr/bin/env node

/**
 * Create GitHub Release
 * 创建 4.0.1 版本的 GitHub Release
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VERSION = '4.0.1';
const RELEASE_TITLE = `Claude Code Proxy Pro v${VERSION} - 全新 VSCode 风格 GUI`;

console.log(`🚀 创建 GitHub Release v${VERSION}...\n`);

// 检查 GitHub CLI 是否安装
try {
    execSync('gh --version', { stdio: 'pipe' });
    console.log('✅ GitHub CLI 已安装');
} catch (error) {
    console.error('❌ 需要安装 GitHub CLI');
    console.log('请访问 https://cli.github.com/ 安装');
    process.exit(1);
}

// 检查是否已登录
try {
    execSync('gh auth status', { stdio: 'pipe' });
    console.log('✅ 已登录 GitHub\n');
} catch (error) {
    console.error('❌ 需要登录 GitHub');
    console.log('运行: gh auth login');
    process.exit(1);
}

// 读取 Release Notes
const releaseNotesPath = path.join(__dirname, '..', 'RELEASE-NOTES-4.0.1.md');
if (!fs.existsSync(releaseNotesPath)) {
    console.error('❌ 找不到 RELEASE-NOTES-4.0.1.md');
    process.exit(1);
}

const releaseNotes = fs.readFileSync(releaseNotesPath, 'utf8');

// 创建 Release
console.log('创建 Release...');
try {
    // 创建 tag 和 release
    const cmd = `gh release create v${VERSION} \
        --title "${RELEASE_TITLE}" \
        --notes "${releaseNotes.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" \
        --draft`;
    
    execSync(cmd, { stdio: 'inherit' });
    console.log('\n✅ Release 草稿已创建');
} catch (error) {
    console.error('❌ 创建 Release 失败:', error.message);
    process.exit(1);
}

// 上传构建产物
console.log('\n上传构建产物...');
const distPath = path.join(__dirname, '..', 'dist');
const files = [
    'Claude Code Proxy Pro-4.0.1-mac-arm64.dmg',
    'Claude Code Proxy Pro-4.0.1-mac-x64.dmg',
    'Claude Code Proxy Pro-4.0.1-mac-arm64.zip',
    'Claude Code Proxy Pro-4.0.1-mac-x64.zip'
];

for (const file of files) {
    const filePath = path.join(distPath, file);
    if (fs.existsSync(filePath)) {
        console.log(`上传 ${file}...`);
        try {
            execSync(`gh release upload v${VERSION} "${filePath}"`, { stdio: 'inherit' });
            console.log(`✅ ${file} 上传成功`);
        } catch (error) {
            console.error(`❌ ${file} 上传失败:`, error.message);
        }
    } else {
        console.log(`⚠️  ${file} 不存在，跳过`);
    }
}

console.log('\n🎉 Release 创建完成！');
console.log(`\n访问 https://github.com/miounet11/claude-code-proxy-pro/releases/tag/v${VERSION} 查看和发布`);
console.log('\n记得在 GitHub 上编辑 Release 并取消草稿状态来正式发布！');