#!/bin/bash

echo "🚀 初始化 Git 仓库并推送到 GitHub..."

# 设置用户信息
git config user.name "miounet11"
git config user.email "9248293@gmail.com"

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 创建初始提交
git commit -m "Initial commit: Claude Code Proxy Pro v2.0.1

- 🌐 Multi-language support (zh-CN, en, ja, zh-TW)
- 🚀 Cross-platform Electron app
- 🔧 Environment auto-detection
- 📦 Multi-profile management
- 🎨 Modern dark theme UI"

# 添加远程仓库
git remote add origin https://github.com/miounet11/claude-code-proxy-pro.git

# 推送到主分支
echo "正在推送到 GitHub..."
git branch -M main
git push -u origin main

# 创建标签
git tag -a v2.0.1 -m "Release v2.0.1 - Multi-language support"
git push origin v2.0.1

echo "✅ 完成！"
echo ""
echo "📋 后续步骤："
echo "1. 访问 https://github.com/miounet11/claude-code-proxy-pro"
echo "2. 检查 Actions 标签页查看自动构建进度"
echo "3. 构建完成后，在 Releases 页面查看发布的安装包"
echo ""
echo "💡 提示："
echo "- 如果推送失败，请确保您已经在 GitHub 上创建了仓库"
echo "- 仓库名称: claude-code-proxy-pro"
echo "- 仓库地址: https://github.com/miounet11/claude-code-proxy-pro"