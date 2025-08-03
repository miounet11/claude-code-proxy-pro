# 发布 4.0.1 版本指南

## 🎉 恭喜！构建已完成

### 构建产物
已生成以下文件（在 `dist/` 目录中）：
- `Claude Code Proxy Pro-4.0.1-mac-arm64.dmg` (87.1 MB) - macOS Apple Silicon
- `Claude Code Proxy Pro-4.0.1-mac-x64.dmg` (91.5 MB) - macOS Intel
- `Claude Code Proxy Pro-4.0.1-mac-arm64.zip` (91.9 MB) - macOS Apple Silicon (ZIP)
- `Claude Code Proxy Pro-4.0.1-mac-x64.zip` (64.0 MB) - macOS Intel (ZIP)

### 手动发布步骤

1. **访问 GitHub Releases 页面**
   ```
   https://github.com/miounet11/claude-code-proxy-pro/releases/new
   ```

2. **填写发布信息**
   - **Choose a tag**: 选择 `v4.0.1`
   - **Release title**: `Claude Code Proxy Pro v4.0.1 - 全新 VSCode 风格 GUI`
   - **Release notes**: 复制 `RELEASE-NOTES-4.0.1.md` 的内容

3. **上传构建文件**
   将 `dist/` 目录中的 4 个文件拖拽到 "Attach binaries" 区域

4. **发布选项**
   - ☑️ This is a pre-release（如果想先测试）
   - 或直接点击 "Publish release" 正式发布

### 使用 GitHub CLI（如果已安装）

```bash
# 安装 GitHub CLI (macOS)
brew install gh

# 登录
gh auth login

# 创建 Release
gh release create v4.0.1 \
  --title "Claude Code Proxy Pro v4.0.1 - 全新 VSCode 风格 GUI" \
  --notes-file RELEASE-NOTES-4.0.1.md \
  --draft \
  "dist/Claude Code Proxy Pro-4.0.1-mac-arm64.dmg" \
  "dist/Claude Code Proxy Pro-4.0.1-mac-x64.dmg" \
  "dist/Claude Code Proxy Pro-4.0.1-mac-arm64.zip" \
  "dist/Claude Code Proxy Pro-4.0.1-mac-x64.zip"
```

### 发布后续工作

1. **测试下载链接**
   确保所有文件都能正常下载

2. **更新 README**
   在主 README 中添加最新版本的下载链接

3. **通知用户**
   - 在相关社区发布更新公告
   - 更新项目主页

## 🎊 完成！

恭喜发布 Claude Code Proxy Pro v4.0.1！这是一个重要的里程碑版本。