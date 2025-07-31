# GitHub 仓库设置指南

## 1. 创建新仓库

1. 访问 https://github.com/new
2. 填写以下信息：
   - **Repository name**: `claude-code-proxy-pro`
   - **Description**: `高效的 Claude Code 代理工具 | Efficient Claude Code proxy tool`
   - **Public/Private**: 选择 Public（公开）
   - **不要勾选** "Initialize this repository with a README"
   - **不要添加** .gitignore 和 License（我们已经有了）

3. 点击 "Create repository"

## 2. 推送代码

在项目目录中运行：

```bash
./init-git.sh
```

如果遇到权限问题，使用：

```bash
chmod +x init-git.sh
./init-git.sh
```

## 3. 配置 GitHub Secrets（可选）

如果您想要代码签名（特别是 macOS），需要在仓库设置中添加 Secrets：

1. 访问 https://github.com/miounet11/claude-code-proxy-pro/settings/secrets/actions
2. 添加以下 Secrets（如果有的话）：
   - `APPLE_ID`: Apple Developer ID
   - `APPLE_ID_PASS`: Apple ID 专用密码
   - `CSC_LINK`: 代码签名证书（base64 编码）
   - `CSC_KEY_PASSWORD`: 证书密码

## 4. 启用 GitHub Actions

1. 访问 https://github.com/miounet11/claude-code-proxy-pro/actions
2. 如果看到提示，点击 "I understand my workflows, go ahead and enable them"

## 5. 创建发布

### 自动发布（推荐）

推送标签会自动触发构建和发布：

```bash
git tag -a v2.0.2 -m "New release"
git push origin v2.0.2
```

### 手动发布

1. 访问 https://github.com/miounet11/claude-code-proxy-pro/releases/new
2. 选择标签或创建新标签
3. 填写发布说明
4. 等待 GitHub Actions 自动上传构建的文件

## 6. 检查构建状态

访问 https://github.com/miounet11/claude-code-proxy-pro/actions 查看构建进度

## 故障排除

### 推送失败

如果推送失败，可能需要设置 Personal Access Token：

1. 访问 https://github.com/settings/tokens/new
2. 创建新的 token，勾选 `repo` 权限
3. 使用 token 作为密码：
   ```bash
   git remote set-url origin https://miounet11:YOUR_TOKEN@github.com/miounet11/claude-code-proxy-pro.git
   ```

### Actions 构建失败

检查 Actions 日志，常见问题：
- Node.js 版本不兼容
- 缺少依赖
- 构建配置错误

## 联系方式

- GitHub: @miounet11
- Email: 9248293@gmail.com