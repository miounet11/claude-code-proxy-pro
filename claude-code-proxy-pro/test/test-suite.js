/**
 * Claude Code Proxy Pro 测试套件
 * 
 * 运行方式: node test/test-suite.js
 */

const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// 测试配置
const TEST_CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY || 'test-api-key',
  baseUrl: 'https://api.anthropic.com/v1',
  proxyPort: 3080,
  model: 'claude-3-opus-20240229'
};

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * 彩色输出
 */
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 测试断言
 */
function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    log(`✓ ${message}`, 'green');
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    log(`✗ ${message}`, 'red');
  }
}

/**
 * 异步测试包装器
 */
async function test(name, fn) {
  log(`\n▶ Testing: ${name}`, 'blue');
  try {
    await fn();
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`${name}: ${error.message}`);
    log(`✗ ${name}: ${error.message}`, 'red');
  }
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试套件
 */
class TestSuite {
  constructor() {
    this.electronApp = null;
  }

  /**
   * 启动Electron应用
   */
  async startApp() {
    return new Promise((resolve, reject) => {
      const appPath = path.join(__dirname, '..');
      this.electronApp = spawn('electron', [appPath, '--test'], {
        env: { ...process.env, NODE_ENV: 'test' }
      });

      this.electronApp.stdout.on('data', (data) => {
        console.log(`App: ${data}`);
      });

      this.electronApp.stderr.on('data', (data) => {
        console.error(`App Error: ${data}`);
      });

      // 等待应用启动
      setTimeout(resolve, 3000);
    });
  }

  /**
   * 停止应用
   */
  stopApp() {
    if (this.electronApp) {
      this.electronApp.kill();
      this.electronApp = null;
    }
  }

  /**
   * 测试配置管理器
   */
  async testConfigManager() {
    await test('ConfigManager - Default Config', async () => {
      const ConfigManager = require('../src/main/config-manager');
      const configManager = new ConfigManager();
      
      const config = configManager.getAll();
      assert(config.api !== undefined, 'API config exists');
      assert(config.proxy !== undefined, 'Proxy config exists');
      assert(config.ui !== undefined, 'UI config exists');
    });

    await test('ConfigManager - Get/Set Values', async () => {
      const ConfigManager = require('../src/main/config-manager');
      const configManager = new ConfigManager();
      
      configManager.set('test.value', 'hello');
      const value = configManager.get('test.value');
      assert(value === 'hello', 'Set and get value correctly');
      
      configManager.set('api.timeout', 10000);
      const timeout = configManager.get('api.timeout');
      assert(timeout === 10000, 'Set nested value correctly');
    });

    await test('ConfigManager - Validation', async () => {
      const ConfigManager = require('../src/main/config-manager');
      const configManager = new ConfigManager();
      
      const invalidConfig = {
        api: { baseUrl: '', apiKey: '' },
        proxy: { port: 99999 }
      };
      
      const validation = configManager.validate(invalidConfig);
      assert(!validation.valid, 'Invalid config detected');
      assert(validation.errors.length > 0, 'Validation errors returned');
    });
  }

  /**
   * 测试日志记录器
   */
  async testLogger() {
    await test('Logger - Log Levels', async () => {
      const { Logger, LogLevel } = require('../src/main/logger');
      const logger = new Logger({ 
        enableFile: false,
        level: LogLevel.DEBUG 
      });
      
      // 测试不同级别的日志
      logger.error('Test', 'Error message');
      logger.warn('Test', 'Warning message');
      logger.info('Test', 'Info message');
      logger.debug('Test', 'Debug message');
      
      assert(true, 'All log levels work without errors');
    });

    await test('Logger - File Logging', async () => {
      const { Logger } = require('../src/main/logger');
      const testLogDir = path.join(__dirname, 'test-logs');
      
      const logger = new Logger({
        enableFile: true,
        logDir: testLogDir
      });
      
      logger.info('Test', 'Test message to file');
      
      // 检查日志文件是否创建
      const logFiles = logger.getLogFiles();
      assert(logFiles.length > 0, 'Log file created');
      
      // 清理测试日志
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }
    });
  }

  /**
   * 测试错误处理器
   */
  async testErrorHandler() {
    await test('ErrorHandler - Error Types', async () => {
      const { AppError, ErrorType } = require('../src/main/error-handler');
      
      const networkError = new AppError('Network failed', ErrorType.NETWORK);
      assert(networkError.type === ErrorType.NETWORK, 'Network error type correct');
      
      const apiError = new AppError('API failed', ErrorType.API, { status: 401 });
      assert(apiError.details.status === 401, 'Error details preserved');
    });

    await test('ErrorHandler - Async Wrapper', async () => {
      const { errorHandler, ErrorType } = require('../src/main/error-handler');
      
      const failingFunction = async () => {
        throw new Error('Test error');
      };
      
      const wrapped = errorHandler.wrapAsync(failingFunction, ErrorType.TEST);
      
      try {
        await wrapped();
        assert(false, 'Should have thrown error');
      } catch (error) {
        assert(error.type === ErrorType.TEST, 'Error type preserved in wrapper');
      }
    });
  }

  /**
   * 测试代理服务器
   */
  async testProxyServer() {
    await test('ProxyManager - Start/Stop', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      const proxyManager = new ProxyManager();
      
      // 启动代理
      const startResult = await proxyManager.start({
        port: TEST_CONFIG.proxyPort + 1, // 使用不同端口避免冲突
        apiKey: TEST_CONFIG.apiKey,
        baseUrl: TEST_CONFIG.baseUrl
      });
      
      assert(startResult.success, 'Proxy started successfully');
      
      // 检查状态
      const status = proxyManager.getStatus();
      assert(status.running, 'Proxy is running');
      assert(status.port === TEST_CONFIG.proxyPort + 1, 'Proxy port correct');
      
      // 停止代理
      const stopResult = proxyManager.stop();
      assert(stopResult.success, 'Proxy stopped successfully');
    });

    await test('ProxyManager - Request Handling', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      const proxyManager = new ProxyManager();
      
      // 启动代理
      await proxyManager.start({
        port: TEST_CONFIG.proxyPort + 2,
        apiKey: TEST_CONFIG.apiKey,
        baseUrl: TEST_CONFIG.baseUrl
      });
      
      try {
        // 发送测试请求到代理
        const response = await axios.get(`http://localhost:${TEST_CONFIG.proxyPort + 2}/health`);
        assert(response.status === 200, 'Health check endpoint works');
        assert(response.data.status === 'healthy', 'Proxy is healthy');
      } catch (error) {
        assert(false, `Proxy request failed: ${error.message}`);
      } finally {
        proxyManager.stop();
      }
    });
  }

  /**
   * 测试环境检测
   */
  async testEnvironmentCheck() {
    await test('Environment - Check All', async () => {
      const { checkAllEnvironments } = require('../src/main/environment');
      
      const environments = await checkAllEnvironments();
      assert(environments !== null, 'Environment check returns results');
      assert(typeof environments === 'object', 'Environment check returns object');
      
      // 检查基本环境
      for (const [key, env] of Object.entries(environments)) {
        assert(env.hasOwnProperty('installed'), `${key} has installed property`);
        assert(env.hasOwnProperty('version'), `${key} has version property`);
      }
    });
  }

  /**
   * 集成测试
   */
  async testIntegration() {
    await test('Integration - Config + Proxy', async () => {
      const ConfigManager = require('../src/main/config-manager');
      const ProxyManager = require('../src/main/proxy-manager');
      
      const configManager = new ConfigManager();
      const proxyManager = new ProxyManager();
      
      // 设置配置
      configManager.set('api.apiKey', TEST_CONFIG.apiKey);
      configManager.set('api.baseUrl', TEST_CONFIG.baseUrl);
      configManager.set('proxy.port', TEST_CONFIG.proxyPort + 3);
      
      // 从配置启动代理
      const config = configManager.getAll();
      const result = await proxyManager.start({
        port: config.proxy.port,
        apiKey: config.api.apiKey,
        baseUrl: config.api.baseUrl
      });
      
      assert(result.success, 'Proxy started with config');
      
      proxyManager.stop();
    });

    await test('Integration - Error Recovery', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      const proxyManager = new ProxyManager();
      
      // 尝试使用无效配置启动代理
      const result = await proxyManager.start({
        port: -1, // 无效端口
        apiKey: '',
        baseUrl: ''
      });
      
      assert(!result.success, 'Invalid config rejected');
      assert(result.error !== undefined, 'Error message provided');
    });
  }

  /**
   * 运行所有测试
   */
  async runAll() {
    log('\n🧪 Claude Code Proxy Pro Test Suite\n', 'yellow');
    
    try {
      // 单元测试
      await this.testConfigManager();
      await this.testLogger();
      await this.testErrorHandler();
      await this.testProxyServer();
      await this.testEnvironmentCheck();
      
      // 集成测试
      await this.testIntegration();
      
      // 打印结果
      this.printResults();
      
    } catch (error) {
      log(`\n❌ Test suite failed: ${error.message}`, 'red');
      console.error(error);
    }
  }

  /**
   * 打印测试结果
   */
  printResults() {
    log('\n📊 Test Results:', 'yellow');
    log(`✅ Passed: ${testResults.passed}`, 'green');
    log(`❌ Failed: ${testResults.failed}`, 'red');
    
    if (testResults.errors.length > 0) {
      log('\n🚨 Errors:', 'red');
      testResults.errors.forEach(error => {
        log(`  - ${error}`, 'red');
      });
    }
    
    const total = testResults.passed + testResults.failed;
    const percentage = total > 0 ? (testResults.passed / total * 100).toFixed(1) : 0;
    
    log(`\n📈 Success Rate: ${percentage}%`, 
      percentage >= 80 ? 'green' : percentage >= 60 ? 'yellow' : 'red'
    );
    
    // 退出码
    process.exit(testResults.failed > 0 ? 1 : 0);
  }
}

// 运行测试
if (require.main === module) {
  const suite = new TestSuite();
  suite.runAll().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = TestSuite;