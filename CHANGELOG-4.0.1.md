# Claude Code Proxy Pro v4.0.1 Release Notes

发布日期：2025-01-03

## 🎉 重大更新

这是一个里程碑版本！Claude Code Proxy Pro 现在是一个完整的 VSCode 风格 GUI 应用。

## ✨ 新功能

### 1. 全新 VSCode 风格界面
- 专业的开发者 UI 设计
- 活动栏、侧边栏、编辑器区域布局
- 暗色主题，符合开发者习惯
- 响应式设计，适配不同屏幕尺寸

### 2. 集成终端系统
- 内置多标签终端
- 支持终端分屏
- Claude CLI 自动配置
- 无需外部终端窗口
- 完整的 ANSI 转义序列支持

### 3. Claude 对话界面
- 类似 ChatGPT 的现代化聊天界面
- Markdown 渲染和代码高亮
- 文件上传和预览功能
- 对话历史管理
- 多模型选择支持

### 4. 一键启动功能
- 自动环境检查和配置
- 自动启动代理服务
- 自动设置环境变量
- 智能错误处理和恢复

### 5. 系统环境管理
- 自动检测必要组件
- 一键安装缺失依赖
- 实时状态监控
- 跨平台环境配置

## 🔧 改进

### 用户体验
- 移除所有命令行脚本依赖
- 所有功能集成在 GUI 内
- 快捷键支持（Ctrl/Cmd + J 打开终端等）
- Toast 通知系统
- 平滑的界面动画

### 技术架构
- 基于 Electron 28 的现代化架构
- 使用 xterm.js 提供专业终端体验
- 优化的 IPC 通信机制
- 模块化的代码结构
- 改进的错误处理

### 性能优化
- 减少内存占用
- 优化启动速度
- 改进的资源管理
- 更好的多窗口支持

## 🐛 修复

- 修复代理启动时的端口冲突问题
- 修复终端在某些系统上的兼容性问题
- 修复环境变量设置的持久化问题
- 修复 UI 在高 DPI 屏幕上的显示问题

## 💔 移除

- 移除所有 .sh 脚本文件
- 移除旧版 HTML 界面
- 移除过时的文档和测试文件
- 移除命令行模式（现在是纯 GUI 应用）

## 📦 安装

### 下载预构建版本
访问 [Releases](https://github.com/miounet11/claude-code-proxy-pro/releases/tag/v4.0.1) 页面下载：
- Windows: `Claude-Code-Proxy-Pro-4.0.1-win.exe`
- macOS: `Claude-Code-Proxy-Pro-4.0.1-mac.dmg`
- Linux: `Claude-Code-Proxy-Pro-4.0.1-linux.AppImage`

### 从源码运行
```bash
git clone https://github.com/miounet11/claude-code-proxy-pro.git
cd claude-code-proxy-pro
npm install
npm run dev:vscode
```

## 🚀 快速开始

1. 启动应用
2. 点击侧边栏的「一键启动」
3. 输入你的 Claude API Key
4. 开始在集成终端中使用 Claude CLI

## 📝 注意事项

- 首次启动可能需要下载额外依赖
- 建议使用 Node.js 16.0 或更高版本
- Windows 用户可能需要以管理员身份运行
- macOS 用户首次打开需要在系统偏好设置中允许

## 🙏 致谢

感谢所有贡献者和用户的支持！特别感谢：
- Electron 团队提供的框架
- xterm.js 提供的终端组件
- VSCode 团队的设计灵感

## 📞 反馈

如有问题或建议，请在 [GitHub Issues](https://github.com/miounet11/claude-code-proxy-pro/issues) 提交。

---

享受全新的 Claude Code Proxy Pro 体验！🎊