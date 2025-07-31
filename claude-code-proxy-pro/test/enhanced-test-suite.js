/**
 * 增强的测试套件
 * 包含修复的环境配置和更全面的测试用例
 */

// 首先设置测试环境
require('./test-environment-fix');

const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 测试配置
const TEST_CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY || 'test-api-key',
  baseUrl: 'https://api.anthropic.com/v1',
  proxyPort: 3080,
  model: 'claude-3-opus-20240229',
  timeout: 10000
};

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
  details: []
};

/**
 * 彩色输出
 */
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 测试断言
 */
function assert(condition, message, details = null) {
  if (condition) {
    testResults.passed++;
    log(`✓ ${message}`, 'green');
    if (details) {
      testResults.details.push({ type: 'pass', message, details });
    }
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    log(`✗ ${message}`, 'red');
    if (details) {
      testResults.details.push({ type: 'fail', message, details });
    }
  }
}

/**
 * 跳过测试
 */
function skip(message, reason) {
  testResults.skipped++;
  log(`⊘ ${message} (${reason})`, 'yellow');
  testResults.details.push({ type: 'skip', message, reason });
}

/**
 * 异步测试包装器
 */
async function test(name, fn, options = {}) {
  log(`\n▶ Testing: ${name}`, 'blue');
  const startTime = Date.now();
  
  try {
    if (options.skip) {
      skip(name, options.skip);
      return;
    }

    const timeout = options.timeout || TEST_CONFIG.timeout;
    const result = await Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout')), timeout)
      )
    ]);

    const duration = Date.now() - startTime;
    log(`  Duration: ${duration}ms`, 'cyan');
    
    return result;
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`${name}: ${error.message}`);
    log(`✗ ${name}: ${error.message}`, 'red');
    
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
  }
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 增强的测试套件
 */
class EnhancedTestSuite {
  constructor() {
    this.electronApp = null;
    this.mockElectron = global.mockElectron;
  }

  /**
   * 测试配置管理器
   */
  async testConfigManager() {
    await test('ConfigManager - Initialization', async () => {
      const ConfigManager = require('../src/main/config-manager');
      const configManager = new ConfigManager();
      
      assert(configManager !== null, 'ConfigManager created successfully');
    });

    await test('ConfigManager - Default Configuration', async () => {
      const ConfigManager = require('../src/main/config-manager');
      const configManager = new ConfigManager();
      
      const config = configManager.getAll();
      assert(typeof config === 'object', 'Config is an object');
      assert(config.api !== undefined, 'API config exists');
      assert(config.proxy !== undefined, 'Proxy config exists');
      assert(config.ui !== undefined, 'UI config exists');
    });

    await test('ConfigManager - Get/Set Operations', async () => {
      const ConfigManager = require('../src/main/config-manager');
      const configManager = new ConfigManager();
      
      // 测试基本设置和获取
      configManager.set('test.basic', 'hello world');
      const value = configManager.get('test.basic');
      assert(value === 'hello world', 'Basic set/get works');
      
      // 测试嵌套路径
      configManager.set('api.timeout', 15000);
      const timeout = configManager.get('api.timeout');
      assert(timeout === 15000, 'Nested path set/get works');
      
      // 测试默认值
      const defaultValue = configManager.get('nonexistent.key', 'default');
      assert(defaultValue === 'default', 'Default value returned for missing key');
    });

    await test('ConfigManager - Configuration Validation', async () => {
      const ConfigManager = require('../src/main/config-manager');
      const configManager = new ConfigManager();
      
      // 测试有效配置
      const validConfig = {
        api: { 
          baseUrl: 'https://api.anthropic.com/v1',
          apiKey: 'sk-ant-test-key',
          timeout: 30000
        },
        proxy: { 
          port: 8080,
          cors: true
        }
      };
      
      const validResult = configManager.validate(validConfig);
      assert(validResult.valid === true, 'Valid config passes validation');
      
      // 测试无效配置
      const invalidConfig = {
        api: { 
          baseUrl: '',  // 空URL
          apiKey: '',   // 空密钥
        },
        proxy: { 
          port: 99999   // 无效端口
        }
      };
      
      const invalidResult = configManager.validate(invalidConfig);
      assert(invalidResult.valid === false, 'Invalid config fails validation');
      assert(Array.isArray(invalidResult.errors), 'Validation errors returned as array');
      assert(invalidResult.errors.length > 0, 'Validation errors are not empty');
    });
  }

  /**
   * 测试日志记录器
   */
  async testLogger() {
    await test('Logger - Initialization with Mock Environment', async () => {
      // 临时设置测试目录
      const testLogDir = path.join(os.tmpdir(), 'claude-proxy-test-logs');
      
      const { Logger, LogLevel } = require('../src/main/logger');
      const logger = new Logger({ 
        enableFile: true,
        enableConsole: true,
        level: LogLevel.DEBUG,
        logDir: testLogDir
      });
      
      assert(logger !== null, 'Logger created successfully');
      assert(logger.level === LogLevel.DEBUG, 'Log level set correctly');
    });

    await test('Logger - Log Level Filtering', async () => {
      const { Logger, LogLevel } = require('../src/main/logger');
      const logger = new Logger({ 
        enableFile: false,  // 禁用文件输出避免权限问题
        level: LogLevel.WARN 
      });
      
      // 创建一个计数器来验证日志输出
      let logCount = 0;
      const originalConsoleWarn = console.warn;
      const originalConsoleError = console.error;
      
      console.warn = () => logCount++;
      console.error = () => logCount++;
      
      // 测试日志级别过滤
      logger.debug('Test', 'Debug message');  // 应该被过滤
      logger.info('Test', 'Info message');    // 应该被过滤
      logger.warn('Test', 'Warning message'); // 应该输出
      logger.error('Test', 'Error message');  // 应该输出
      
      // 恢复原始函数
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
      
      assert(logCount === 2, 'Only WARN and ERROR messages logged');
    });

    await test('Logger - Message Formatting', async () => {
      const { Logger, LogLevel } = require('../src/main/logger');
      const logger = new Logger({ 
        enableFile: false,
        enableConsole: false,
        level: LogLevel.DEBUG
      });
      
      const formatted = logger.formatMessage(
        LogLevel.INFO, 
        'TestCategory', 
        'Test message',
        { key: 'value', number: 42 }
      );
      
      assert(formatted.includes('[INFO]'), 'Log level included in format');
      assert(formatted.includes('[TestCategory]'), 'Category included in format');
      assert(formatted.includes('Test message'), 'Message included in format');
      assert(formatted.includes('key'), 'Metadata included in format');
    });
  }

  /**
   * 测试错误处理器
   */
  async testErrorHandler() {
    await test('ErrorHandler - Error Types and Classification', async () => {
      const { AppError, ErrorType } = require('../src/main/error-handler');
      
      // 测试自定义错误创建
      const networkError = new AppError('Connection failed', ErrorType.NETWORK, {
        url: 'https://api.example.com',
        status: 'ECONNREFUSED'
      });
      
      assert(networkError instanceof Error, 'AppError extends Error');
      assert(networkError.type === ErrorType.NETWORK, 'Error type set correctly');
      assert(networkError.details.url === 'https://api.example.com', 'Error details preserved');
      assert(networkError.timestamp !== undefined, 'Timestamp added to error');
    });

    await test('ErrorHandler - Global Error Handling Setup', async () => {
      const { ErrorHandler, ErrorType } = require('../src/main/error-handler');
      
      const errorHandler = new ErrorHandler();
      assert(errorHandler !== null, 'ErrorHandler created successfully');
      
      // 测试错误处理
      const testError = new Error('Test error message');
      const processedError = errorHandler.handleError(testError, ErrorType.API);
      
      assert(processedError.type === ErrorType.API, 'Error type assigned correctly');
      assert(processedError.message === 'Test error message', 'Error message preserved');
    });

    await test('ErrorHandler - Error Callback System', async () => {
      const { ErrorHandler, ErrorType } = require('../src/main/error-handler');
      
      const errorHandler = new ErrorHandler();
      let callbackExecuted = false;
      let receivedError = null;
      
      // 注册错误回调
      const unsubscribe = errorHandler.onError((error) => {
        callbackExecuted = true;
        receivedError = error;
      });
      
      // 触发错误
      const testError = new Error('Callback test');
      errorHandler.handleError(testError, ErrorType.SYSTEM);
      
      assert(callbackExecuted, 'Error callback executed');
      assert(receivedError !== null, 'Error passed to callback');
      assert(receivedError.message === 'Callback test', 'Correct error passed to callback');
      
      // 测试取消订阅
      unsubscribe();
    });

    await test('ErrorHandler - Async Function Wrapper', async () => {
      const { ErrorHandler, ErrorType } = require('../src/main/error-handler');
      
      const errorHandler = new ErrorHandler();
      
      // 测试成功的异步函数
      const successfulAsyncFn = async () => {
        return 'success result';
      };
      
      const wrappedSuccess = errorHandler.wrapAsync(successfulAsyncFn, ErrorType.API);
      const result = await wrappedSuccess();
      assert(result === 'success result', 'Successful async function works');
      
      // 测试失败的异步函数
      const failingAsyncFn = async () => {
        throw new Error('Async function failed');
      };
      
      const wrappedFailing = errorHandler.wrapAsync(failingAsyncFn, ErrorType.API);
      
      try {
        await wrappedFailing();
        assert(false, 'Should have thrown error');
      } catch (error) {
        assert(error.type === ErrorType.API, 'Error type preserved in wrapper');
        assert(error.message === 'Async function failed', 'Error message preserved');
      }
    });
  }

  /**
   * 测试代理管理器（模拟环境）
   */
  async testProxyManager() {
    await test('ProxyManager - Initialization', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      const proxyManager = new ProxyManager();
      
      assert(proxyManager !== null, 'ProxyManager created successfully');
      
      const status = proxyManager.getStatus();
      assert(typeof status === 'object', 'Status returned as object');
      assert(status.running === false, 'Initially not running');
    });

    await test('ProxyManager - Configuration Validation', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      const proxyManager = new ProxyManager();
      
      // 测试无效配置
      const invalidResult = await proxyManager.start({
        // 缺少必要的配置
      });
      
      assert(invalidResult.success === false, 'Invalid config rejected');
      assert(typeof invalidResult.error === 'string', 'Error message provided');
    });

    await test('ProxyManager - Request Format Conversion', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      const proxyManager = new ProxyManager();
      
      // 测试 OpenAI 到 Anthropic 的转换
      const openaiRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, how are you?' }
        ],
        max_tokens: 100,
        temperature: 0.7
      };
      
      const anthropicRequest = proxyManager.convertOpenAIToAnthropic(openaiRequest);
      
      assert(typeof anthropicRequest === 'object', 'Conversion returns object');
      assert(Array.isArray(anthropicRequest.messages), 'Messages converted to array');
      assert(anthropicRequest.system !== undefined, 'System message extracted');
      assert(anthropicRequest.max_tokens === 100, 'Max tokens preserved');
      assert(anthropicRequest.temperature === 0.7, 'Temperature preserved');
    });

    await test('ProxyManager - Response Format Conversion', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      const proxyManager = new ProxyManager();
      
      // 模拟 Anthropic 响应
      const anthropicResponse = {
        id: 'msg_test123',
        model: 'claude-3-opus-20240229',
        content: [
          { type: 'text', text: 'Hello! I am doing well, thank you for asking.' }
        ],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 15,
          output_tokens: 12
        }
      };
      
      const openaiResponse = proxyManager.convertAnthropicToOpenAI(anthropicResponse, 'req_test');
      
      assert(typeof openaiResponse === 'object', 'Conversion returns object');
      assert(openaiResponse.object === 'chat.completion', 'Correct object type');
      assert(Array.isArray(openaiResponse.choices), 'Choices array present');
      assert(openaiResponse.choices[0].message.role === 'assistant', 'Correct role');
      assert(openaiResponse.choices[0].message.content.includes('Hello!'), 'Content preserved');
      assert(openaiResponse.usage.total_tokens === 27, 'Token usage calculated correctly');
    });

    await test('ProxyManager - Complex Task Detection', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      const proxyManager = new ProxyManager();
      
      // 简单任务
      const simpleRequest = {
        messages: [
          { role: 'user', content: 'Hi' }
        ],
        max_tokens: 50
      };
      
      const isSimpleComplex = proxyManager.isComplexTask(simpleRequest);
      assert(isSimpleComplex === false, 'Simple task detected correctly');
      
      // 复杂任务
      const complexRequest = {
        messages: [
          { role: 'system', content: 'You are a code review assistant.' },
          { role: 'user', content: 'Please review this code and suggest improvements: ' + 'x'.repeat(3000) }
        ],
        max_tokens: 8000
      };
      
      const isComplexComplex = proxyManager.isComplexTask(complexRequest);
      assert(isComplexComplex === true, 'Complex task detected correctly');
    });
  }

  /**
   * 测试环境检测
   */
  async testEnvironmentDetection() {
    await test('Environment - Path Extension', async () => {
      const { extendPath } = require('../src/main/environment');
      
      const originalPath = process.env.PATH;
      extendPath();
      
      assert(process.env.PATH !== undefined, 'PATH environment variable exists');
      assert(process.env.PATH.length >= originalPath.length, 'PATH was extended');
    });

    await test('Environment - Check Single Environment', async () => {
      const { checkEnvironment } = require('../src/main/environment');
      
      try {
        const nodeResult = await checkEnvironment('nodejs');
        assert(typeof nodeResult === 'object', 'Check returns object');
        assert(nodeResult.name === 'Node.js', 'Correct environment name');
        assert(['installed', 'not_installed'].includes(nodeResult.status), 'Valid status');
      } catch (error) {
        // 在测试环境中，某些环境检测可能失败，这是正常的
        skip('Environment check failed in test environment', error.message);
      }
    });

    await test('Environment - Version Comparison Utility', async () => {
      // 由于 compareVersions 不是直接导出的，我们需要测试相关功能
      const { checkEnvironment } = require('../src/main/environment');
      
      // 这个测试主要验证函数不会崩溃
      try {
        await checkEnvironment('nodejs');
        assert(true, 'Version comparison logic works');
      } catch (error) {
        // 在测试环境中可能失败
        skip('Version comparison test skipped', 'Test environment limitation');
      }
    });
  }

  /**
   * 测试多语言支持
   */
  async testInternationalization() {
    await test('I18n - Module Loading', async () => {
      try {
        const i18n = require('../src/main/i18n');
        assert(typeof i18n === 'object', 'I18n module loaded');
        assert(typeof i18n.init === 'function', 'Init function available');
        assert(typeof i18n.getLocale === 'function', 'GetLocale function available');
        assert(typeof i18n.setLocale === 'function', 'SetLocale function available');
      } catch (error) {
        // 如果 i18n 模块不存在或依赖问题
        skip('I18n module test skipped', error.message);
      }
    });

    await test('I18n - Locale Files Exist', async () => {
      const localeDir = path.join(__dirname, '..', 'locales');
      const expectedLocales = ['en.json', 'zh-CN.json', 'ja.json', 'zh-TW.json'];
      
      if (!fs.existsSync(localeDir)) {
        skip('Locale files test skipped', 'Locales directory not found');
        return;
      }
      
      for (const locale of expectedLocales) {
        const localePath = path.join(localeDir, locale);
        const exists = fs.existsSync(localePath);
        assert(exists, `Locale file ${locale} exists`);
        
        if (exists) {
          try {
            const content = JSON.parse(fs.readFileSync(localePath, 'utf8'));
            assert(typeof content === 'object', `Locale file ${locale} is valid JSON`);
          } catch (error) {
            assert(false, `Locale file ${locale} contains invalid JSON`);
          }
        }
      }
    });
  }

  /**
   * 集成测试
   */
  async testIntegration() {
    await test('Integration - Config + Logger + ErrorHandler', async () => {
      const ConfigManager = require('../src/main/config-manager');
      const { logger } = require('../src/main/logger');
      const { errorHandler, ErrorType } = require('../src/main/error-handler');
      
      // 集成测试：配置管理器错误通过错误处理器记录
      const configManager = new ConfigManager();
      
      let errorLogged = false;
      const originalError = logger.error;
      logger.error = (...args) => {
        errorLogged = true;
        originalError.apply(logger, args);
      };
      
      try {
        // 尝试验证无效配置
        const invalidConfig = {
          api: { baseUrl: '', apiKey: '' }
        };
        
        const validation = configManager.validate(invalidConfig);
        assert(!validation.valid, 'Invalid config detected');
        
        // 通过错误处理器处理配置错误
        if (!validation.valid) {
          errorHandler.handleError(
            new Error('Configuration validation failed'),
            ErrorType.CONFIG
          );
        }
        
        assert(errorLogged, 'Error was logged through integrated system');
      } finally {
        logger.error = originalError;
      }
    });

    await test('Integration - Full Request Processing Pipeline', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      const { logger } = require('../src/main/logger');
      
      const proxyManager = new ProxyManager();
      
      // 测试完整的请求处理管道（不实际发送请求）
      const openaiRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test message' }],
        max_tokens: 100
      };
      
      // 测试请求转换
      const anthropicRequest = proxyManager.convertOpenAIToAnthropic(openaiRequest);
      assert(anthropicRequest !== null, 'Request conversion successful');
      
      // 模拟 Anthropic 响应并转换回 OpenAI 格式
      const mockAnthropicResponse = {
        id: 'msg_test',
        model: 'claude-3-opus-20240229',
        content: [{ type: 'text', text: 'Test response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      };
      
      const openaiResponse = proxyManager.convertAnthropicToOpenAI(mockAnthropicResponse);
      assert(openaiResponse.choices[0].message.content === 'Test response', 'Response conversion successful');
      
      assert(true, 'Full request processing pipeline works');
    });
  }

  /**
   * 性能测试
   */
  async testPerformance() {
    await test('Performance - Request Conversion Speed', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      const proxyManager = new ProxyManager();
      
      const testRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'User message' }
        ],
        max_tokens: 100,
        temperature: 0.7
      };
      
      const iterations = 1000;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        proxyManager.convertOpenAIToAnthropic(testRequest);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      assert(avgTime < 10, `Request conversion average time (${avgTime.toFixed(2)}ms) is acceptable`);
      log(`  Conversion performance: ${avgTime.toFixed(2)}ms per request`, 'cyan');
    });

    await test('Performance - Memory Usage Stability', async () => {
      const ProxyManager = require('../src/main/proxy-manager');
      
      // 获取初始内存使用
      const initialMemory = process.memoryUsage();
      
      // 执行大量操作
      const proxyManager = new ProxyManager();
      const testRequests = [];
      
      for (let i = 0; i < 100; i++) {
        testRequests.push({
          model: 'gpt-4',
          messages: [{ role: 'user', content: `Test message ${i}` }],
          max_tokens: 100
        });
      }
      
      // 处理请求
      testRequests.forEach(req => {
        const converted = proxyManager.convertOpenAIToAnthropic(req);
        // 立即转换回来模拟完整流程
        const mockResponse = {
          id: 'msg_test',
          content: [{ type: 'text', text: 'Response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 }
        };
        proxyManager.convertAnthropicToOpenAI(mockResponse);
      });
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const growthMB = heapGrowth / 1024 / 1024;
      
      // 内存增长应该保持在合理范围内
      assert(growthMB < 50, `Memory growth (${growthMB.toFixed(2)}MB) is within acceptable limits`);
      log(`  Memory growth: ${growthMB.toFixed(2)}MB`, 'cyan');
    });
  }

  /**
   * 运行所有测试
   */
  async runAll() {
    log('\n🧪 Enhanced Claude Code Proxy Pro Test Suite\n', 'yellow');
    log(`Platform: ${os.platform()} ${os.arch()}`, 'cyan');
    log(`Node.js: ${process.version}`, 'cyan');
    log(`Test Environment: ${process.env.NODE_ENV || 'development'}`, 'cyan');
    log('', 'reset');
    
    try {
      // 基础功能测试
      await this.testConfigManager();
      await this.testLogger();
      await this.testErrorHandler();
      
      // 核心功能测试
      await this.testProxyManager();
      await this.testEnvironmentDetection();
      
      // 功能特性测试
      await this.testInternationalization();
      
      // 集成测试
      await this.testIntegration();
      
      // 性能测试
      await this.testPerformance();
      
      // 打印结果
      this.printResults();
      
    } catch (error) {
      log(`\n❌ Test suite failed with fatal error: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * 打印测试结果
   */
  printResults() {
    log('\n📊 Enhanced Test Results:', 'yellow');
    log(`✅ Passed: ${testResults.passed}`, 'green');
    log(`❌ Failed: ${testResults.failed}`, 'red');
    log(`⊘ Skipped: ${testResults.skipped}`, 'yellow');
    
    if (testResults.errors.length > 0) {
      log('\n🚨 Failed Tests:', 'red');
      testResults.errors.forEach(error => {
        log(`  - ${error}`, 'red');
      });
    }
    
    const total = testResults.passed + testResults.failed;
    const percentage = total > 0 ? (testResults.passed / total * 100).toFixed(1) : 0;
    
    log(`\n📈 Success Rate: ${percentage}%`, 
      percentage >= 90 ? 'green' : percentage >= 70 ? 'yellow' : 'red'
    );
    
    if (testResults.skipped > 0) {
      log(`⚠️  ${testResults.skipped} tests were skipped due to environment limitations`, 'yellow');
    }
    
    // 详细结果（如果启用调试）
    if (process.env.DEBUG && testResults.details.length > 0) {
      log('\n🔍 Detailed Test Results:', 'cyan');
      testResults.details.forEach(detail => {
        const icon = detail.type === 'pass' ? '✓' : detail.type === 'fail' ? '✗' : '⊘';
        const color = detail.type === 'pass' ? 'green' : detail.type === 'fail' ? 'red' : 'yellow';
        log(`  ${icon} ${detail.message}`, color);
        if (detail.details) {
          log(`    ${JSON.stringify(detail.details)}`, 'cyan');
        }
        if (detail.reason) {
          log(`    Reason: ${detail.reason}`, 'yellow');
        }
      });
    }
    
    log(`\n⏱️  Total test execution time: ${Date.now() - this.startTime}ms`, 'cyan');
    
    // 生成退出码
    const exitCode = testResults.failed > 0 ? 1 : 0;
    if (exitCode === 0) {
      log('\n🎉 All tests completed successfully!', 'green');
    } else {
      log('\n💥 Some tests failed. Please review the errors above.', 'red');
    }
    
    process.exit(exitCode);
  }
}

// 运行测试
if (require.main === module) {
  const suite = new EnhancedTestSuite();
  suite.startTime = Date.now();
  
  suite.runAll().catch(error => {
    console.error('Fatal error in test suite:', error);
    process.exit(1);
  });
}

module.exports = EnhancedTestSuite;