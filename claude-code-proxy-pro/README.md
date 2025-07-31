# Claude Code Proxy Pro 🚀

一个为 Claude Code 设计的极简 Electron 桌面应用，提供环境管理和代理服务功能。

## ✨ 特性

- **🔧 环境一键安装** - 自动检测并安装 Node.js、Git、UV、Claude Code
- **🌐 智能代理管理** - 自动端口分配，支持多种 AI 模型
- **🎨 现代化界面** - 深色主题，响应式设计
- **⚡ 极简实现** - 核心代码仅 400+ 行
- **🔒 安全可靠** - 完善的错误处理和日志系统

## 📦 安装

### 下载预构建版本
访问 [Releases](https://github.com/your-username/claude-code-proxy-pro/releases) 页面下载适合您系统的版本。

### 从源码构建

```bash
# 克隆项目
git clone https://github.com/your-username/claude-code-proxy-pro.git
cd claude-code-proxy-pro

# 安装依赖
npm install

# 运行开发版
npm start

# 构建安装包
npm run build
```

## 🚀 使用方法

1. **环境检测**
   - 启动应用后，点击"重新检测"查看环境状态
   - 点击"一键安装全部"安装缺失的组件

2. **配置代理**
   - 填写您的 API 密钥
   - 选择 API 地址（支持第三方）
   - 选择 AI 模型（大/中/小）
   - 设置代理端口（默认 8082）

3. **启动服务**
   - 点击"测试配置"验证设置
   - 点击"启动 Claude Code"开始使用

## 🛠️ 技术栈

- **Electron** - 跨平台桌面应用框架
- **Node.js** - JavaScript 运行环境
- **Express** - Web 服务器框架
- **http-proxy-middleware** - 代理中间件

## 📁 项目结构

```
claude-code-proxy-pro/
├── src/
│   ├── main/              # 主进程
│   │   ├── main.js        # 应用入口
│   │   ├── proxy-manager.js    # 代理管理
│   │   ├── environment.js      # 环境检测
│   │   └── config-manager.js   # 配置管理
│   ├── renderer/          # 渲染进程
│   └── preload/           # 预加载脚本
├── public/                # 静态资源
├── test/                  # 测试文件
└── scripts/               # 构建脚本
```

## 🔧 开发

```bash
# 运行测试
npm test

# 运行开发模式（带开发者工具）
npm run dev

# 生成图标
npm run icons

# 发布新版本
npm run release
```

## 📝 配置说明

应用配置保存在：
- Windows: `%APPDATA%/claude-code-proxy-pro`
- macOS: `~/Library/Application Support/claude-code-proxy-pro`
- Linux: `~/.config/claude-code-proxy-pro`

## 🤝 贡献

欢迎提交 Pull Request 或创建 Issue！

## 📄 许可证

MIT License

## 🙏 致谢

- Claude Code 团队
- Electron 社区
- 所有贡献者

---

**注意**: 使用本应用需要有效的 API 密钥。