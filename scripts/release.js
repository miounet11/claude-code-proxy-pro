#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * 发布脚本
 * 自动化版本发布流程
 */

async function main() {
  console.log('🚀 Claude Code Proxy Pro 发布工具\n');
  
  try {
    // 1. 检查 Git 状态
    console.log('📋 检查 Git 状态...');
    const gitStatus = execSync('git status --porcelain').toString();
    if (gitStatus.trim()) {
      console.error('❌ 工作目录不干净，请先提交或暂存更改');
      process.exit(1);
    }
    
    // 2. 获取当前版本
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const currentVersion = packageJson.version;
    console.log(`📌 当前版本: v${currentVersion}`);
    
    // 3. 询问新版本号
    const newVersion = await askQuestion(`\n请输入新版本号 (当前: ${currentVersion}): `);
    if (!isValidVersion(newVersion)) {
      console.error('❌ 无效的版本号格式');
      process.exit(1);
    }
    
    // 4. 确认发布
    const confirm = await askQuestion(`\n确认发布 v${newVersion}? (y/n): `);
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ 发布已取消');
      process.exit(0);
    }
    
    // 5. 运行测试
    console.log('\n🧪 运行测试...');
    try {
      execSync('npm test', { stdio: 'inherit' });
      console.log('✅ 测试通过');
    } catch (error) {
      console.error('❌ 测试失败');
      process.exit(1);
    }
    
    // 6. 更新版本号
    console.log('\n📝 更新版本号...');
    packageJson.version = newVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    
    // 7. 生成更新日志
    console.log('\n📋 生成更新日志...');
    const changelog = await generateChangelog(currentVersion, newVersion);
    
    // 8. 提交更改
    console.log('\n📤 提交更改...');
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "Release v${newVersion}"`, { stdio: 'inherit' });
    
    // 9. 创建标签
    console.log('\n🏷️  创建标签...');
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}\n\n${changelog}"`, { stdio: 'inherit' });
    
    // 10. 推送到远程
    const pushConfirm = await askQuestion('\n推送到远程仓库? (y/n): ');
    if (pushConfirm.toLowerCase() === 'y') {
      console.log('\n📤 推送到远程...');
      execSync('git push', { stdio: 'inherit' });
      execSync('git push --tags', { stdio: 'inherit' });
      console.log('✅ 推送成功');
    }
    
    // 11. 构建发布包
    const buildConfirm = await askQuestion('\n立即构建发布包? (y/n): ');
    if (buildConfirm.toLowerCase() === 'y') {
      console.log('\n🔨 构建发布包...');
      
      // 运行优化脚本
      execSync('node scripts/optimize-build.js', { stdio: 'inherit' });
      
      // 构建各平台版本
      const platforms = await askQuestion('\n选择构建平台 (all/win/mac/linux): ');
      const buildCommand = platforms === 'all' ? 'npm run build:all' : `npm run build:${platforms}`;
      
      try {
        execSync(buildCommand, { stdio: 'inherit' });
        console.log('✅ 构建成功');
      } catch (error) {
        console.error('❌ 构建失败:', error.message);
      }
    }
    
    console.log('\n🎉 发布流程完成！');
    console.log(`\n📦 版本 v${newVersion} 已准备就绪`);
    console.log('\n下一步:');
    console.log('  1. 在 GitHub 上创建 Release');
    console.log('  2. 上传构建产物到 Release');
    console.log('  3. 更新文档和网站');
    
  } catch (error) {
    console.error('\n❌ 发布失败:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// 询问用户输入
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// 验证版本号格式
function isValidVersion(version) {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(version);
}

// 生成更新日志
async function generateChangelog(oldVersion, newVersion) {
  console.log('获取提交历史...');
  
  try {
    // 获取自上个版本以来的提交
    const commits = execSync(`git log v${oldVersion}..HEAD --pretty=format:"%s"`)
      .toString()
      .split('\n')
      .filter(Boolean);
    
    // 分类提交
    const features = [];
    const fixes = [];
    const others = [];
    
    commits.forEach(commit => {
      if (commit.startsWith('feat:') || commit.startsWith('feature:')) {
        features.push(commit);
      } else if (commit.startsWith('fix:')) {
        fixes.push(commit);
      } else {
        others.push(commit);
      }
    });
    
    // 构建更新日志
    let changelog = `## 更新内容 (v${newVersion})\n\n`;
    
    if (features.length > 0) {
      changelog += '### 新功能\n';
      features.forEach(feat => {
        changelog += `- ${feat}\n`;
      });
      changelog += '\n';
    }
    
    if (fixes.length > 0) {
      changelog += '### 修复\n';
      fixes.forEach(fix => {
        changelog += `- ${fix}\n`;
      });
      changelog += '\n';
    }
    
    if (others.length > 0) {
      changelog += '### 其他更改\n';
      others.forEach(other => {
        changelog += `- ${other}\n`;
      });
    }
    
    return changelog;
  } catch (error) {
    return `版本 ${newVersion} 发布`;
  }
}

// 运行主函数
main();