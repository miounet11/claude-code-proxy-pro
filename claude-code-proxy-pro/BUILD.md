# Claude Code Proxy Pro 构建指南

## 前置要求

### 基础环境
- Node.js >= 16.0.0
- npm >= 7.0.0
- Git

### 平台特定要求

#### macOS
- Xcode Command Line Tools
- 代码签名证书（用于发布）

#### Windows
- Visual Studio 2019 或更高版本（带有 C++ 工具）
- Windows SDK
- 代码签名证书（用于发布）

#### Linux
- build-essential
- libnss3-dev
- libatk-bridge2.0-0
- libgtk-3-0

## 快速开始

### 1. 克隆仓库
```bash
git clone https://github.com/yourusername/claude-code-proxy-pro.git
cd claude-code-proxy-pro
```

### 2. 安装依赖
```bash
npm install
```

### 3. 开发模式运行
```bash
npm run dev
```

## 构建应用

### 构建当前平台
```bash
npm run build
```

### 构建特定平台
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# 所有平台
npm run build:all
```

## 构建配置

### 应用图标
1. 准备一个 1024x1024 的 PNG 图标，放置在 `assets/icon.png`
2. 运行图标生成脚本：
   ```bash
   npm run icons
   ```

### 优化构建
构建前会自动运行优化脚本：
- 清理不必要的文件
- 优化依赖
- 生成构建信息

### 自定义配置
编辑 `package.json` 中的 `build` 部分：
```json
{
  "build": {
    "appId": "com.yourcompany.appname",
    "productName": "Your App Name",
    // 更多配置...
  }
}
```

## 发布流程

### 1. 准备发布
```bash
npm run release
```
此命令会：
- 检查 Git 状态
- 运行测试
- 更新版本号
- 创建 Git 标签
- 生成更新日志

### 2. 构建发布包
```bash
npm run build:all
```

### 3. 上传到 GitHub Release
构建完成后，GitHub Actions 会自动：
- 创建 Release
- 上传构建产物
- 发布更新

## CI/CD

### GitHub Actions
项目配置了两个工作流：

1. **CI 工作流** (`.github/workflows/ci.yml`)
   - 在每次推送和 PR 时运行
   - 运行测试
   - 检查代码质量
   - 构建验证

2. **发布工作流** (`.github/workflows/build-release.yml`)
   - 在创建标签时触发
   - 构建所有平台
   - 创建 GitHub Release
   - 上传构建产物

### 环境变量
在 GitHub 仓库设置以下 Secrets：

- `MAC_CERTS`: macOS 代码签名证书（base64）
- `MAC_CERTS_PASSWORD`: 证书密码
- `APPLE_ID`: Apple ID（用于公证）
- `APPLE_ID_PASS`: Apple ID 密码
- `WIN_CERTS`: Windows 代码签名证书（base64）
- `WIN_CERTS_PASSWORD`: 证书密码

## 构建产物

构建完成后，在 `dist` 目录下会生成：

### Windows
- `.exe` - NSIS 安装程序
- `.exe` - 便携版

### macOS
- `.dmg` - 磁盘镜像
- `.zip` - 压缩包

### Linux
- `.AppImage` - AppImage 格式
- `.deb` - Debian 包
- `.rpm` - RPM 包

## 故障排查

### 构建失败
1. 确保所有依赖已正确安装：
   ```bash
   npm ci
   ```

2. 清理缓存和重试：
   ```bash
   npm run build:clean
   npm cache clean --force
   npm install
   ```

### 签名问题
- macOS: 确保在钥匙串中有有效的开发者证书
- Windows: 确保证书路径和密码正确

### 图标问题
- 确保源图标是 1024x1024 PNG
- macOS 需要 ImageMagick 和 iconutil
- Windows 需要 ImageMagick

## 性能优化

### 减小包体积
1. 使用 `asar` 打包
2. 启用 `compression: maximum`
3. 排除不必要的文件

### 构建速度
1. 使用 `npm ci` 而不是 `npm install`
2. 启用并行构建
3. 使用构建缓存

## 更多信息

- [Electron Builder 文档](https://www.electron.build/)
- [Electron 文档](https://www.electronjs.org/)
- [项目 Wiki](https://github.com/yourusername/claude-code-proxy-pro/wiki)