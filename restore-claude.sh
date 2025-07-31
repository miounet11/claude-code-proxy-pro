#!/bin/bash

echo "🔄 还原 Claude Code 官方设置..."
echo ""

# 检测 shell 类型
if [[ $SHELL == */zsh ]]; then
    SHELL_RC="$HOME/.zshrc"
elif [[ $SHELL == */bash ]]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.profile"
fi

echo "📝 清除代理环境变量..."

# 从当前环境中清除
unset ANTHROPIC_BASE_URL
unset ANTHROPIC_AUTH_TOKEN

# 从 shell 配置文件中移除（如果存在）
if [ -f "$SHELL_RC" ]; then
    # 创建备份
    cp "$SHELL_RC" "$SHELL_RC.backup.$(date +%Y%m%d_%H%M%S)"
    
    # 移除代理相关的环境变量
    sed -i.tmp '/export ANTHROPIC_BASE_URL/d' "$SHELL_RC"
    sed -i.tmp '/export ANTHROPIC_AUTH_TOKEN/d' "$SHELL_RC"
    rm -f "$SHELL_RC.tmp"
    
    echo "✅ 已从 $SHELL_RC 中移除代理设置"
fi

echo ""
echo "📦 升级 Claude Code..."
npm install -g @anthropic-ai/claude-code@latest

echo ""
echo "✅ 还原完成！"
echo ""
echo "💡 建议操作："
echo "1. 重新打开终端或 IDE (Cursor/VSCode)"
echo "2. 验证环境变量: env | grep -i anthropic"
echo "3. 如果有官方 API Key，请运行:"
echo "   claude login"
echo "4. 或者设置环境变量:"
echo "   export ANTHROPIC_API_KEY='sk-ant-your-complete-key'"
echo ""
echo "🔍 测试 Claude CLI:"
echo "   claude 'Hello, Claude!'"
echo ""

# 重新加载 shell 配置
echo "🔄 重新加载 shell 配置..."
source "$SHELL_RC" 2>/dev/null || true

echo "按任意键继续..."
read -n 1