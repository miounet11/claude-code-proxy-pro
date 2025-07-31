# Proxy Manager 使用说明

## 功能特性

- ✅ 端口自动管理（从8082开始，被占用时自动递增）
- ✅ 环境变量配置支持
- ✅ 进程生命周期管理
- ✅ 错误处理和状态监控
- ✅ 使用 http-proxy-middleware 实现高效代理

## 核心API

### 在主进程中使用

```javascript
const ProxyManager = require('./proxy-manager');
const proxyManager = new ProxyManager();

// 启动代理
const result = await proxyManager.start({
  apiKey: 'your-api-key',
  model: 'claude-3-opus-20240229'
});

// 获取状态
const status = proxyManager.getStatus();

// 停止代理
proxyManager.stop();
```

### 在渲染进程中使用

```javascript
// 启动代理
const result = await window.electronAPI.startProxy({
  apiKey: 'your-api-key',
  model: 'claude-3-opus-20240229'
});

// 获取状态
const status = await window.electronAPI.getProxyStatus();

// 停止代理
await window.electronAPI.stopProxy();
```

## 环境变量配置

创建 `.env` 文件并设置：

```bash
ANTHROPIC_API_KEY=your-api-key
CLAUDE_MODEL=claude-3-opus-20240229
```

## 测试运行

```bash
# 测试代理管理器
node src/main/test-proxy.js

# 启动 Electron 应用
npm start
```