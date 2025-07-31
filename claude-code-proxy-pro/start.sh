#!/bin/bash

# Claude Code Proxy Pro 启动脚本
# 使用稳定的配置启动应用

echo "🚀 启动 Claude Code Proxy Pro..."

# 设置环境变量以提高稳定性
export ELECTRON_DISABLE_SECURITY_WARNINGS=true
export ELECTRON_NO_ATTACH_CONSOLE=true

# 使用 no-sandbox 模式避免权限问题
npm start -- --no-sandbox --disable-gpu-sandbox

# 如果崩溃，提供有用的信息
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 应用启动失败"
    echo ""
    echo "可能的解决方案："
    echo "1. 尝试运行: npm install"
    echo "2. 删除 node_modules 文件夹后重新安装"
    echo "3. 确保 Node.js 版本 >= 14.0"
    echo ""
fi