# Claude Code Proxy Pro - 快速启动指南

## 🚀 一键启动

```bash
# 安装依赖（首次运行）
npm install

# 启动 VSCode 风格 GUI
npm run dev:vscode
```

## 📱 应用功能

启动后，您将看到一个类似 VSCode 的专业界面：

1. **左侧活动栏** - 点击图标切换功能
   - 💬 聊天 - Claude 对话界面
   - 🖥️ 终端 - 集成终端
   - ⚙️ 设置 - 配置管理
   - 📁 项目 - 项目管理

2. **一键启动** - 点击侧边栏的「一键启动」按钮
   - 自动检查环境
   - 自动启动代理
   - 自动配置 Claude CLI
   - 所有操作在应用内完成

3. **使用终端** - 点击终端图标或按 `Ctrl/Cmd + J`
   - 支持多标签
   - Claude CLI 已配置好
   - 直接输入 `claude "你的问题"`

4. **Claude 对话** - 点击聊天图标
   - 现代化聊天界面
   - 支持 Markdown 和代码高亮
   - 文件上传功能

## ✨ 特色

- **无需外部脚本** - 所有功能集成在 GUI 中
- **自动环境配置** - 一键完成所有设置
- **专业界面** - VSCode 风格，开发者友好
- **实时状态** - 底部状态栏显示所有服务状态

## 🔧 故障排除

如果遇到问题：
1. 确保 Node.js 版本 >= 16.0
2. 删除 node_modules 并重新安装：`rm -rf node_modules && npm install`
3. 查看开发者工具：`Ctrl/Cmd + Shift + I`

享受您的 Claude Code 开发体验！