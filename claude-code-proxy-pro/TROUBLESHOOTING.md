# Claude Code Proxy Pro - 故障排除指南

## 环境检测和安装问题

### 1. 环境检测功能正常工作
环境检测会检查以下组件：
- ✅ Node.js
- ✅ Git
- ✅ UV (Python包管理器)
- ✅ Claude Code
- ✅ Claude Code Proxy

### 2. 安装按钮无响应？
如果点击安装按钮没有反应，可能是以下原因：

#### macOS 用户
- **需要 Homebrew**：安装 Node.js 和 Git 需要先安装 Homebrew
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```

- **权限问题**：某些安装可能需要管理员权限
  ```bash
  sudo npm install -g @anthropic-ai/claude-code
  ```

#### Windows 用户
- **需要管理员权限**：右键以管理员身份运行应用
- **需要 winget**：Windows 11 默认安装，Windows 10 需要从 Microsoft Store 安装 "应用安装程序"

### 3. 手动安装命令

如果自动安装失败，可以在终端手动执行以下命令：

#### 安装 Node.js
```bash
# macOS
brew install node

# Windows (使用 winget)
winget install OpenJS.NodeJS

# Linux
sudo apt-get install nodejs
```

#### 安装 Git
```bash
# macOS
brew install git

# Windows
winget install Git.Git

# Linux
sudo apt-get install git
```

#### 安装 UV
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

#### 安装 Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

#### 安装 Claude Code Proxy
```bash
# 创建目录
mkdir -p ~/.claude/proxy

# 克隆项目
git clone https://github.com/fuergaosi233/claude-code-proxy ~/.claude/proxy/claude-code-proxy

# 进入目录并同步依赖
cd ~/.claude/proxy/claude-code-proxy
uv sync
```

### 4. 常见错误解决

#### "command not found" 错误
- 确保 PATH 环境变量包含安装目录
- 重启终端或重新加载 shell 配置

#### npm 权限错误
```bash
# 配置 npm 全局目录
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### UV 安装后找不到命令
```bash
# 添加到 PATH
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 5. 验证安装

安装完成后，可以在终端验证：
```bash
node --version
git --version
uv --version
claude --version
```

### 6. 重新检测

安装完成后，点击应用中的"重新检测"按钮刷新状态。

## 其他问题

### API 连接失败
1. 检查 API 密钥是否正确
2. 检查网络连接
3. 如果使用第三方 API，确认地址格式正确

### 代理启动失败
1. 检查端口是否被占用
2. 尝试更改端口号
3. 确保防火墙允许连接

### Claude Code 启动失败
1. 确保代理服务已启动
2. 检查环境变量是否正确设置
3. 尝试在终端手动启动查看错误信息

## 获取帮助

如果问题仍未解决：
1. 查看应用日志：`~/Library/Logs/claude-code-proxy-pro/`
2. 提交 Issue：https://github.com/your-username/claude-code-proxy-pro/issues
3. 附上错误截图和日志信息