# Claude Code Proxy Pro

简体中文 | [English](README.md) | [日本語](README.ja.md) | [繁體中文](README.zh-TW.md)

Claude Code Proxy Pro 是一个专业的 VSCode 风格 GUI 应用，集成了 Claude API 代理、对话界面和终端功能，提供完整的一站式开发体验。

## ✨ 核心特性

- 🎨 **VSCode 风格界面** - 专业的开发者 UI，熟悉的操作体验
- 🖥️ **集成终端** - 内置多标签终端，支持 Claude CLI 直接运行
- 💬 **对话界面** - 类似 ChatGPT 的现代化聊天界面
- 🚀 **一键启动** - 自动配置环境，无需命令行操作
- 🔄 **智能路由** - 根据请求复杂度自动选择模型
- 🛡️ **完全本地** - 所有功能集成在应用内，数据安全

## 📸 界面预览

应用采用专业的 VSCode 风格设计，包含：
- 活动栏：快速访问核心功能
- 侧边栏：管理配置和项目
- 编辑器区域：Claude 对话界面
- 集成终端：多标签终端支持

## 🚀 快速开始

### 系统要求

- Node.js 16.0 或更高版本
- Git
- 操作系统：Windows 10+、macOS 10.15+ 或 Linux

### 安装运行

```bash
# 克隆项目
git clone https://github.com/miounet11/claude-code-proxy-pro.git
cd claude-code-proxy-pro

# 安装依赖
npm install

# 启动 VSCode 风格 GUI
npm run dev:vscode

# 或使用 Electron 直接启动
electron src/main/main-vscode-style.js
```

## 📖 使用指南

### 首次使用

1. **启动应用** - 运行 `npm run dev:vscode`
2. **环境检查** - 应用会自动检查并安装必要组件
3. **配置 API** - 在设置页面输入您的 Claude API 密钥
4. **一键启动** - 点击「一键启动」自动配置所有服务

### 核心功能

#### 集成终端
- 支持多标签终端
- 自动配置 Claude CLI 环境
- 无需外部终端窗口
- 支持常用终端操作

#### Claude 对话
- Markdown 渲染和代码高亮
- 文件上传和预览
- 对话历史管理
- 多模型选择

#### 代理管理
- 自动启动和配置代理
- 实时状态监控
- 多配置文件支持
- 智能模型路由

## 🎯 界面功能

### 活动栏
- 💬 **聊天** - Claude 对话界面
- 🖥️ **终端** - 集成终端
- ⚙️ **设置** - 应用配置
- 📁 **项目** - 项目管理

### 状态栏
- 实时显示代理状态
- 环境状态监控
- 快速操作按钮

### 快捷键
- `Ctrl/Cmd + J` - 切换终端
- `Ctrl/Cmd + N` - 新建对话
- `Ctrl/Cmd + ,` - 打开设置
- `Ctrl/Cmd + B` - 切换侧边栏

## 🔧 高级配置

### 环境变量（自动配置）
```bash
ANTHROPIC_BASE_URL=http://localhost:8082/v1
ANTHROPIC_API_KEY=proxy-key
```

### 配置文件位置
- Windows：`%APPDATA%/claude-code-proxy-pro`
- macOS：`~/Library/Application Support/claude-code-proxy-pro`
- Linux：`~/.config/claude-code-proxy-pro`

## 🛠️ 开发

### 项目结构
```
claude-code-proxy-pro/
├── src/
│   ├── main/              # 主进程代码
│   │   ├── main-vscode-style.js   # VSCode 风格主进程
│   │   ├── terminal-service.js    # 终端服务
│   │   └── claude-api-manager.js  # Claude API 管理
│   └── preload/           # 预加载脚本
├── public/                # 前端资源
│   ├── index-vscode-style.html    # 主界面
│   ├── vscode-style.css           # VSCode 风格样式
│   └── vscode-style-app.js        # 应用逻辑
└── locales/               # 国际化文件
```

### 开发命令
```bash
# 开发模式
npm run dev:vscode

# 构建生产版本
npm run build

# 运行测试
npm test
```

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md) 了解详情。

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- 基于 [Electron](https://www.electronjs.org/) 构建
- 终端功能使用 [xterm.js](https://xtermjs.org/)
- UI 设计灵感来自 [Visual Studio Code](https://code.visualstudio.com/)

## 📞 支持

如果您遇到问题或有建议：
- 在 [GitHub Issues](https://github.com/miounet11/claude-code-proxy-pro/issues) 提交问题
- 查看 [常见问题](FAQ.md)