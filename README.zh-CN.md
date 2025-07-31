# Claude Code Proxy Pro

简体中文 | [English](README.md) | [日本語](README.ja.md) | [繁體中文](README.zh-TW.md)

Claude Code Proxy Pro 是一个高效的 Claude Code 代理工具，帮助开发者轻松配置和管理 Claude API 代理，支持多种模型和配置文件。

## 功能特性

- 🚀 **一键启动**：简洁界面，快速启动代理服务
- 🔧 **多配置管理**：支持最多 10 个配置文件，轻松切换
- 🌐 **多语言支持**：支持简体中文、英文、日文、繁体中文
- 🎨 **现代化界面**：精美的深色主题界面，流畅的交互体验
- 🔒 **安全可靠**：加密存储敏感信息，完善的错误处理
- 🖥️ **跨平台支持**：支持 Windows、macOS 和 Linux
- 🔄 **自动更新**：内置自动更新机制
- 📊 **环境检测**：自动检测并安装所需组件

## 系统要求

- Node.js 16.0 或更高版本
- Git
- 操作系统：Windows 10+、macOS 10.15+ 或 Linux

## 安装

### 下载预构建版本

访问 [Releases](https://github.com/miounet11/claude-code-proxy-pro/releases) 页面下载适合您平台的安装包：

- Windows：`.exe` 安装程序
- macOS：`.dmg` 安装程序
- Linux：`.AppImage` 或 `.deb` 安装包

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/miounet11/claude-code-proxy-pro.git
cd claude-code-proxy-pro

# 安装依赖
npm install

# 启动开发版本
npm start

# 构建安装包
npm run build
```

## 使用方法

1. **首次启动**
   - 应用会自动检查环境
   - 如需要会安装缺失的组件

2. **配置代理**
   - 点击"添加配置"创建新的配置
   - 输入 API 地址、API 密钥并选择模型
   - 保存配置

3. **启动代理**
   - 选择一个配置文件
   - 点击"启动代理"按钮
   - 代理将在默认端口 8082 运行

4. **启动 Claude Code**
   - 代理运行后，点击"启动 Claude Code"
   - 使用环境变量连接到代理

## 配置

### 环境变量

应用会自动设置以下环境变量：

```bash
export ANTHROPIC_BASE_URL=http://localhost:8082/v1
export ANTHROPIC_API_KEY=your-api-key
```

### 配置文件位置

配置文件存储在：
- Windows：`%APPDATA%/claude-code-proxy-pro`
- macOS：`~/Library/Application Support/claude-code-proxy-pro`
- Linux：`~/.config/claude-code-proxy-pro`

## 开发

### 项目结构

```
claude-code-proxy-pro/
├── src/
│   ├── main/          # 主进程模块
│   ├── renderer/      # 渲染进程
│   └── preload/       # 预加载脚本
├── public/            # 静态资源
├── locales/           # 语言文件
├── test/              # 测试文件
└── scripts/           # 构建脚本
```

### 开发命令

```bash
# 启动开发模式
npm run dev

# 运行测试
npm test

# 构建所有平台
npm run build:all

# 生成图标
npm run icons
```

## 贡献

欢迎贡献！请随时提交 Pull Request。

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 致谢

- 基于 [Electron](https://www.electronjs.org/) 构建
- UI 设计灵感来自现代开发者工具
- 感谢所有贡献者和用户

## 支持

如果您遇到问题或有建议：
- 在 [GitHub Issues](https://github.com/miounet11/claude-code-proxy-pro/issues) 提交问题
- 联系邮箱：support@claude-code-proxy.com