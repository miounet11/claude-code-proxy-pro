# Claude Code Proxy Pro v4.2.1 Release Notes

## 🎉 版本亮点

### 🔧 重要修复

#### 1. **API Key 验证更加灵活** 🔑
- 支持多种 API Key 格式（OpenAI、NewAPI、Anthropic 等）
- 移除了严格的 `sk-ant-` 前缀要求
- 只要求基本格式验证（长度 > 20 字符）
- 完美支持第三方代理服务

#### 2. **粘贴功能全面修复** 📋
- 修复了 API Key 输入框无法粘贴的问题
- 支持多种粘贴方式：
  - 粘贴按钮点击
  - Ctrl/Cmd + V 快捷键
  - 右键菜单粘贴
- 使用 Electron 剪贴板 API 确保兼容性

#### 3. **安装流程优化** 🚀
- 修复了 Claude Code 安装包名错误
- 改为使用正确的 npm 包：`@anthropic-ai/claude-code`
- 优化了安装失败处理，不会阻断整体流程
- 改进了环境检测逻辑

#### 4. **配置管理器兼容性** ⚙️
- 添加了缺失的 `getConfig()` 和 `saveConfig()` 方法
- 确保与安装向导的完美兼容
- 修复了配置读取错误

### 🎨 用户体验改进

1. **高级设置默认显示**
   - 代理端口、API Base URL 等核心功能不再隐藏
   - 更直观的配置界面

2. **更好的错误提示**
   - API Key 验证失败时提供具体原因
   - 安装过程中的详细进度反馈

3. **界面滚动问题修复**
   - 修复了安装向导无法滚动的问题
   - 优化了布局结构

## 📦 安装说明

### macOS 用户
- **Apple Silicon (M1/M2/M3)**: 下载 `Claude Code Proxy Pro-4.2.1-mac-arm64.dmg`
- **Intel Mac**: 下载 `Claude Code Proxy Pro-4.2.1-mac-x64.dmg`

### 使用方法
1. 下载对应版本的安装包
2. 双击 DMG 文件
3. 将应用拖入 Applications 文件夹
4. 首次运行时，右键点击应用选择"打开"

## 🔄 升级说明

从旧版本升级的用户：
- 配置文件完全兼容
- 建议重新运行安装向导以确保所有组件正确安装

## 🙏 致谢

感谢所有用户的反馈和支持！特别感谢报告粘贴问题和 API Key 验证问题的用户。

---

如有问题，请在 [GitHub Issues](https://github.com/yourusername/claude-code-proxy-pro/issues) 提交反馈。