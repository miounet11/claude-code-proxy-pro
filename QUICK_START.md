# Claude Code Proxy Pro - 快速启动指南

## 🚀 一键启动（推荐）

```bash
./auto-start.sh
```

这个脚本会自动：
- ✅ 检查 Node.js 环境
- ✅ 安装项目依赖
- ✅ 清理旧进程
- ✅ 启动应用程序
- ✅ 等待您配置代理
- ✅ 自动设置环境变量
- ✅ 验证连接状态

## 📋 使用前准备

### 1. 获取 Anthropic API Key
- 访问 [Anthropic Console](https://console.anthropic.com/)
- 创建或获取您的 API Key

### 2. 安装 Claude CLI（可选）
```bash
npm install -g @anthropic-ai/claude-cli
```

## 🎯 使用方法

### 方式一：使用自动启动脚本

1. **运行一键启动脚本**
   ```bash
   ./auto-start.sh
   ```

2. **在应用中配置**
   - 输入您的 Anthropic API Key
   - 选择模型（推荐 Claude 3 Haiku）
   - 点击【启动代理】按钮

3. **使用 Claude CLI**
   脚本会自动配置环境变量，直接使用：
   ```bash
   claude "你好，帮我写一个Python函数"
   ```

### 方式二：手动启动

1. **启动应用**
   ```bash
   ./start-proxy.sh
   ```

2. **设置环境变量**（新终端需要）
   ```bash
   export ANTHROPIC_BASE_URL="http://localhost:8082/v1"
   export ANTHROPIC_API_KEY="proxy-key"
   ```

3. **使用 Claude CLI**
   ```bash
   claude "你的问题"
   ```

## 🛠️ 其他脚本

### 停止服务
```bash
./stop-proxy.sh
```

### 配置 Claude CLI 权限（macOS）
```bash
./setup-claude-cli.sh
```

## ❓ 常见问题

### 1. Claude CLI 提示文件夹权限问题

**解决方案：**
- 运行 `./setup-claude-cli.sh` 配置权限
- 在提示中选择 "Yes, proceed"
- 使用受信任的工作目录：`~/claude-workspace`

### 2. 端口 8082 被占用

**解决方案：**
```bash
# 查看占用端口的进程
lsof -i :8082

# 停止所有相关服务
./stop-proxy.sh
```

### 3. 环境变量未生效

**解决方案：**
- 使用 `./auto-start.sh`（自动配置）
- 或手动设置：
  ```bash
  export ANTHROPIC_BASE_URL="http://localhost:8082/v1"
  export ANTHROPIC_API_KEY="proxy-key"
  ```

### 4. API Key 无效错误

**解决方案：**
- 确保在应用中输入了正确的 Anthropic API Key
- 检查代理服务器是否正在运行
- 查看日志：`tail -f proxy.log`

## 💡 使用技巧

### 1. 创建别名（推荐）

在 `~/.bashrc` 或 `~/.zshrc` 中添加：
```bash
alias claude-proxy='export ANTHROPIC_BASE_URL="http://localhost:8082/v1" && export ANTHROPIC_API_KEY="proxy-key" && claude'
```

使用：
```bash
claude-proxy "你的问题"
```

### 2. 使用快捷命令

运行 `./setup-claude-cli.sh` 后，可以使用：
```bash
~/.claude_proxy "你的问题"
```

### 3. 在 VSCode/Cursor 中使用

1. 启动代理服务
2. 在编辑器设置中配置：
   - API Base URL: `http://localhost:8082/v1`
   - API Key: `proxy-key`

## 📊 功能特点

- ✅ **多模型支持** - Claude 3 全系列模型
- ✅ **Token 计数** - 实时显示使用量
- ✅ **请求日志** - 详细的调试信息
- ✅ **错误处理** - 友好的错误提示
- ✅ **自动重试** - 网络问题自动重试

## 🔧 高级配置

### 修改代理端口

编辑启动脚本中的 `PROXY_PORT` 变量：
```bash
PROXY_PORT=8082  # 改为你想要的端口
```

### 查看详细日志

```bash
# 实时查看日志
tail -f proxy.log

# 查看最近 100 行
tail -n 100 proxy.log
```

## 📞 获取帮助

- 查看项目文档：[README.md](README.md)
- 提交问题：[GitHub Issues](https://github.com/your-repo/issues)
- 联系作者：通过项目主页

---

**提示：** 使用 `./auto-start.sh` 可以获得最佳体验！