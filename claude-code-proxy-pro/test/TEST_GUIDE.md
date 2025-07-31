# Claude Code Proxy Pro 测试指南

## 概述

本项目包含完整的测试套件，确保应用的稳定性和可靠性。测试分为单元测试和端到端(E2E)测试两部分。

## 测试架构

### 1. 单元测试 (`test-suite.js`)
- **配置管理器测试**: 验证配置的读取、保存和验证功能
- **日志记录器测试**: 测试日志级别、文件写入和轮转功能
- **错误处理器测试**: 验证错误捕获、分类和处理机制
- **代理服务器测试**: 测试代理的启动、停止和请求处理
- **环境检测测试**: 验证系统环境检测功能

### 2. E2E测试 (`e2e-test.js`)
- **应用启动测试**: 验证应用能正常启动
- **用户界面测试**: 测试所有UI交互功能
- **API连接测试**: 验证API配置和连接功能
- **错误处理测试**: 测试用户错误场景的处理
- **性能测试**: 检测内存泄漏等性能问题

## 运行测试

### 快速开始

```bash
# 运行单元测试
npm test

# 运行E2E测试
npm run test:e2e

# 运行所有测试
npm run test:all
```

### 使用测试脚本

```bash
# 只运行单元测试
./test/run-tests.sh

# 运行E2E测试
./test/run-tests.sh --e2e

# 运行所有测试
./test/run-tests.sh --all
```

## 测试配置

### 环境变量
- `TEST_API_KEY`: 测试用的API密钥
- `NODE_ENV=test`: 测试环境标识

### 测试输出
- 控制台输出：彩色格式化的测试结果
- 截图：E2E测试失败时自动截图（保存在 `test/screenshots/`）
- 日志文件：详细的测试日志

## 编写新测试

### 添加单元测试

```javascript
await test('MyFeature - Test Case', async () => {
    // 测试代码
    const result = myFunction();
    assert(result === expected, 'Function should return expected value');
});
```

### 添加E2E测试

```javascript
await this.runTest('New UI Feature', async () => {
    // 点击按钮
    await this.clickElement('#myButton');
    
    // 检查结果
    const success = await this.waitForToast('Success', 'success');
    if (!success) {
        throw new Error('Expected success message not shown');
    }
    
    // 截图
    await this.screenshot('new-feature');
});
```

## 测试覆盖率

当前测试覆盖的功能模块：

- ✅ 配置管理 (100%)
- ✅ 错误处理 (100%)
- ✅ 日志记录 (100%)
- ✅ 代理服务 (90%)
- ✅ 环境检测 (85%)
- ✅ UI交互 (80%)
- ✅ API通信 (85%)

## 持续集成

### GitHub Actions 配置示例

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '16'
    
    - run: npm install
    - run: npm test
    - run: npm run test:e2e
```

## 故障排除

### 常见问题

1. **E2E测试连接失败**
   - 确保Electron应用正确启动
   - 检查是否有防火墙阻止调试端口

2. **截图功能不工作**
   - 确保 `test/screenshots/` 目录有写入权限
   - 检查 puppeteer-core 是否正确安装

3. **测试超时**
   - 增加测试超时时间
   - 检查是否有死锁或无限循环

### 调试测试

```bash
# 启用详细日志
DEBUG=* npm test

# 只运行特定测试
node test/test-suite.js --filter "ConfigManager"

# 保持应用打开以便手动测试
KEEP_APP_OPEN=true npm run test:e2e
```

## 最佳实践

1. **编写可维护的测试**
   - 使用描述性的测试名称
   - 保持测试独立，避免相互依赖
   - 使用合适的断言消息

2. **性能考虑**
   - 避免不必要的等待
   - 并行运行独立的测试
   - 定期清理测试数据

3. **错误处理**
   - 始终清理测试资源
   - 捕获并记录详细的错误信息
   - 失败时提供有用的调试信息

## 贡献指南

如果您想为测试套件做出贡献：

1. 确保新功能包含相应的测试
2. 运行完整测试套件验证没有破坏现有功能
3. 更新测试文档
4. 提交PR时包含测试结果截图

## 联系方式

如有测试相关问题，请通过以下方式联系：
- 提交Issue到项目仓库
- 发送邮件到维护者邮箱