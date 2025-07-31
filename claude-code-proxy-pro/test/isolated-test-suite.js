/**
 * 独立测试套件 - 针对非Electron依赖组件的测试
 * 专门测试不依赖Electron API的功能模块
 */

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
 * 独立测试套件类
 */
class IsolatedTestSuite {
  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 测试项目结构和基本配置
   */
  async testProjectStructure() {
    await test('Project Structure - Package.json', async () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      assert(fs.existsSync(packagePath), 'package.json exists');
      
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      assert(packageJson.name === 'claude-code-proxy-pro', 'Correct package name');
      assert(packageJson.version !== undefined, 'Version specified');
      assert(packageJson.main !== undefined, 'Main entry point specified');
      assert(packageJson.dependencies !== undefined, 'Dependencies specified');
    });

    await test('Project Structure - Essential Files', async () => {
      const essentialFiles = [
        'src/main/main.js',
        'src/main/proxy-manager.js',
        'src/main/environment.js',
        'src/preload/preload.js',
        'public/index.html',
        'electron-builder.yml'
      ];

      for (const file of essentialFiles) {
        const filePath = path.join(__dirname, '..', file);
        assert(fs.existsSync(filePath), `Essential file ${file} exists`);
      }
    });

    await test('Project Structure - Localization Files', async () => {
      const localeDir = path.join(__dirname, '..', 'locales');
      const expectedLocales = ['en.json', 'zh-CN.json', 'ja.json', 'zh-TW.json'];
      
      assert(fs.existsSync(localeDir), 'Locales directory exists');
      
      for (const locale of expectedLocales) {
        const localePath = path.join(localeDir, locale);
        assert(fs.existsSync(localePath), `Locale file ${locale} exists`);
        
        try {
          const content = JSON.parse(fs.readFileSync(localePath, 'utf8'));
          assert(typeof content === 'object', `Locale ${locale} is valid JSON`);
          assert(Object.keys(content).length > 0, `Locale ${locale} has content`);
        } catch (error) {
          assert(false, `Locale ${locale} contains invalid JSON: ${error.message}`);
        }
      }
    });
  }

  /**
   * 测试构建配置
   */
  async testBuildConfiguration() {
    await test('Build Config - Electron Builder Configuration', async () => {
      const builderConfigPath = path.join(__dirname, '..', 'electron-builder.yml');
      assert(fs.existsSync(builderConfigPath), 'electron-builder.yml exists');
      
      // 由于是YAML文件，我们只检查基本结构
      const content = fs.readFileSync(builderConfigPath, 'utf8');
      assert(content.includes('appId:'), 'App ID specified');
      assert(content.includes('productName:'), 'Product name specified');
      assert(content.includes('mac:'), 'macOS build config exists');
      assert(content.includes('win:'), 'Windows build config exists');
      assert(content.includes('linux:'), 'Linux build config exists');
    });

    await test('Build Config - Package.json Build Scripts', async () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      assert(packageJson.scripts.build !== undefined, 'Build script exists');
      assert(packageJson.scripts.start !== undefined, 'Start script exists');
      assert(packageJson.scripts.test !== undefined, 'Test script exists');
      
      // 检查跨平台构建脚本
      assert(packageJson.scripts['build:win'] !== undefined, 'Windows build script exists');
      assert(packageJson.scripts['build:mac'] !== undefined, 'macOS build script exists');
      assert(packageJson.scripts['build:linux'] !== undefined, 'Linux build script exists');
    });

    await test('Build Config - Dependencies Analysis', async () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // 检查关键依赖
      const requiredDeps = [
        'axios',
        'electron-store',
        'express',
        'http-proxy-middleware',
        'uuid'
      ];
      
      for (const dep of requiredDeps) {
        assert(
          packageJson.dependencies[dep] !== undefined,
          `Required dependency ${dep} is specified`
        );
      }
      
      // 检查开发依赖
      const requiredDevDeps = [
        'electron',
        'electron-builder'
      ];
      
      for (const dep of requiredDevDeps) {
        assert(
          packageJson.devDependencies[dep] !== undefined,
          `Required dev dependency ${dep} is specified`
        );
      }
    });
  }

  /**
   * 测试独立的实用函数和类
   */
  async testUtilityFunctions() {
    await test('Utilities - Request Format Conversion Logic', async () => {
      // 创建一个简化的转换逻辑测试
      const testOpenAIRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello world!' }
        ],
        max_tokens: 100,
        temperature: 0.7,
        stream: false
      };

      // 模拟 OpenAI 到 Anthropic 的转换逻辑
      function convertOpenAIToAnthropicMock(request) {
        if (!request.messages || !Array.isArray(request.messages)) {
          throw new Error('Invalid messages');
        }

        const systemMessages = request.messages.filter(m => m.role === 'system');
        const conversationMessages = request.messages.filter(m => m.role !== 'system');

        const result = {
          model: 'claude-3-opus-20240229', // 默认模型
          max_tokens: Math.min(request.max_tokens || 4096, 200000),
          temperature: Math.min(Math.max(request.temperature || 0.7, 0), 1),
          stream: Boolean(request.stream),
          messages: conversationMessages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
          }))
        };

        if (systemMessages.length > 0) {
          result.system = systemMessages.map(m => m.content).join('\n\n');
        }

        return result;
      }

      const converted = convertOpenAIToAnthropicMock(testOpenAIRequest);
      
      assert(typeof converted === 'object', 'Conversion returns object');
      assert(converted.model !== undefined, 'Model specified');
      assert(converted.max_tokens === 100, 'Max tokens preserved');
      assert(converted.temperature === 0.7, 'Temperature preserved');
      assert(converted.system === 'You are a helpful assistant.', 'System message extracted');
      assert(converted.messages.length === 1, 'User message preserved');
      assert(converted.messages[0].content === 'Hello world!', 'User content preserved');
    });

    await test('Utilities - Response Format Conversion Logic', async () => {
      // 模拟 Anthropic 到 OpenAI 的转换逻辑
      function convertAnthropicToOpenAIMock(response) {
        if (!response || typeof response !== 'object') {
          throw new Error('Invalid response');
        }

        // 提取文本内容
        let content = '';
        if (typeof response.content === 'string') {
          content = response.content;
        } else if (Array.isArray(response.content)) {
          content = response.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('');
        }

        // 映射停止原因
        const finishReasonMap = {
          'end_turn': 'stop',
          'max_tokens': 'length',
          'stop_sequence': 'stop'
        };

        const result = {
          id: response.id || `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: response.model || 'claude-3-opus-20240229',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: content
            },
            finish_reason: finishReasonMap[response.stop_reason] || 'stop'
          }],
          usage: {
            prompt_tokens: response.usage?.input_tokens || 0,
            completion_tokens: response.usage?.output_tokens || 0,
            total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
          }
        };

        return result;
      }

      const testAnthropicResponse = {
        id: 'msg_test123',
        model: 'claude-3-opus-20240229',
        content: [
          { type: 'text', text: 'Hello! How can I help you today?' }
        ],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 15,
          output_tokens: 12
        }
      };

      const converted = convertAnthropicToOpenAIMock(testAnthropicResponse);
      
      assert(typeof converted === 'object', 'Conversion returns object');
      assert(converted.object === 'chat.completion', 'Correct object type');
      assert(Array.isArray(converted.choices), 'Choices array exists');
      assert(converted.choices[0].message.role === 'assistant', 'Correct role');
      assert(converted.choices[0].message.content.includes('Hello!'), 'Content preserved');
      assert(converted.choices[0].finish_reason === 'stop', 'Finish reason mapped correctly');
      assert(converted.usage.total_tokens === 27, 'Token usage calculated');
    });

    await test('Utilities - Version Comparison Logic', async () => {
      // 实现版本比较逻辑测试
      function compareVersions(v1, v2) {
        if (!v1 || v1 === 'unknown') return -1;
        if (!v2) return 1;
        
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const part1 = parts1[i] || 0;
          const part2 = parts2[i] || 0;
          
          if (part1 > part2) return 1;
          if (part1 < part2) return -1;
        }
        
        return 0;
      }

      // 测试版本比较
      assert(compareVersions('1.0.0', '1.0.0') === 0, 'Equal versions');
      assert(compareVersions('1.0.1', '1.0.0') === 1, 'Newer version');
      assert(compareVersions('1.0.0', '1.0.1') === -1, 'Older version');
      assert(compareVersions('2.0.0', '1.9.9') === 1, 'Major version difference');
      assert(compareVersions('unknown', '1.0.0') === -1, 'Unknown version handling');
      assert(compareVersions('1.0', '1.0.0') === 0, 'Different length versions');
    });
  }

  /**
   * 测试配置验证逻辑
   */
  async testConfigurationValidation() {
    await test('Config Validation - URL Validation', async () => {
      function isValidUrl(url) {
        if (!url || typeof url !== 'string') return false;
        try {
          new URL(url);
          return url.startsWith('http://') || url.startsWith('https://');
        } catch {
          return false;
        }
      }

      assert(isValidUrl('https://api.anthropic.com/v1'), 'Valid HTTPS URL');
      assert(isValidUrl('http://localhost:8080'), 'Valid HTTP URL');
      assert(!isValidUrl(''), 'Empty URL invalid');
      assert(!isValidUrl('not-a-url'), 'Invalid URL format');
      assert(!isValidUrl('ftp://example.com'), 'Non-HTTP protocol invalid');
    });

    await test('Config Validation - Port Validation', async () => {
      function isValidPort(port) {
        const portNum = parseInt(port);
        return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
      }

      assert(isValidPort(8080), 'Valid port number');
      assert(isValidPort('3000'), 'Valid port as string');
      assert(!isValidPort(0), 'Port 0 invalid');
      assert(!isValidPort(65536), 'Port above range invalid');
      assert(!isValidPort('abc'), 'Non-numeric port invalid');
      assert(!isValidPort(-1), 'Negative port invalid');
    });

    await test('Config Validation - API Key Validation', async () => {
      function isValidApiKey(key) {
        if (!key || typeof key !== 'string') return false;
        return key.length >= 10 && key.trim() === key;
      }

      assert(isValidApiKey('sk-ant-test-key-123456'), 'Valid API key');
      assert(isValidApiKey('valid-test-key'), 'Another valid key');
      assert(!isValidApiKey(''), 'Empty key invalid');
      assert(!isValidApiKey('short'), 'Short key invalid');
      assert(!isValidApiKey('  spaced  '), 'Key with spaces invalid');
      assert(!isValidApiKey(null), 'Null key invalid');
    });
  }

  /**
   * 测试错误处理逻辑
   */
  async testErrorHandling() {
    await test('Error Handling - Error Classification', async () => {
      // 模拟错误分类逻辑
      function classifyError(error) {
        const ERROR_TYPES = {
          NETWORK: 'NETWORK',
          API: 'API',
          VALIDATION: 'VALIDATION',
          SYSTEM: 'SYSTEM',
          UNKNOWN: 'UNKNOWN'
        };

        if (!error) return ERROR_TYPES.UNKNOWN;

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          return ERROR_TYPES.NETWORK;
        }

        if (error.response && error.response.status) {
          return ERROR_TYPES.API;
        }

        if (error.name === 'ValidationError') {
          return ERROR_TYPES.VALIDATION;
        }

        if (error.message && error.message.includes('permission')) {
          return ERROR_TYPES.SYSTEM;
        }

        return ERROR_TYPES.UNKNOWN;
      }

      // 测试不同类型的错误分类
      const networkError = { code: 'ECONNREFUSED', message: 'Connection refused' };
      assert(classifyError(networkError) === 'NETWORK', 'Network error classified correctly');

      const apiError = { response: { status: 401 }, message: 'Unauthorized' };
      assert(classifyError(apiError) === 'API', 'API error classified correctly');

      const validationError = { name: 'ValidationError', message: 'Invalid input' };
      assert(classifyError(validationError) === 'VALIDATION', 'Validation error classified correctly');

      const systemError = { message: 'permission denied' };
      assert(classifyError(systemError) === 'SYSTEM', 'System error classified correctly');

      const unknownError = { message: 'Something went wrong' };
      assert(classifyError(unknownError) === 'UNKNOWN', 'Unknown error classified correctly');
    });

    await test('Error Handling - User-Friendly Messages', async () => {
      // 模拟用户友好错误消息生成
      function getUserFriendlyMessage(errorType, originalMessage) {
        const messageMap = {
          NETWORK: '网络连接失败，请检查网络设置',
          API: 'API服务暂时不可用，请稍后重试',
          VALIDATION: '输入的配置信息有误，请检查后重试',
          SYSTEM: '系统权限不足或资源不可用',
          UNKNOWN: '发生未知错误，请联系技术支持'
        };

        return messageMap[errorType] || originalMessage || '发生了错误';
      }

      assert(
        getUserFriendlyMessage('NETWORK', 'ECONNREFUSED').includes('网络连接'),
        'Network error message is user-friendly'
      );
      
      assert(
        getUserFriendlyMessage('API', '401 Unauthorized').includes('API服务'),
        'API error message is user-friendly'
      );
      
      assert(
        getUserFriendlyMessage('VALIDATION', 'Invalid config').includes('配置信息'),
        'Validation error message is user-friendly'
      );
    });
  }

  /**
   * 测试跨平台兼容性逻辑
   */
  async testCrossPlatformCompatibility() {
    await test('Cross-Platform - Platform Detection', async () => {
      const currentPlatform = process.platform;
      const supportedPlatforms = ['darwin', 'win32', 'linux'];
      
      assert(
        supportedPlatforms.includes(currentPlatform),
        `Current platform ${currentPlatform} is supported`
      );
    });

    await test('Cross-Platform - Path Handling', async () => {
      // 测试跨平台路径处理
      function normalizePath(inputPath) {
        return path.normalize(inputPath).replace(/\\/g, '/');
      }

      const testPaths = [
        'src/main/main.js',
        'src\\main\\main.js',
        './src/main/main.js',
        '.\\src\\main\\main.js'
      ];

      for (const testPath of testPaths) {
        const normalized = normalizePath(testPath);
        assert(
          normalized.includes('src/main/main.js'),
          `Path ${testPath} normalized correctly to ${normalized}`
        );
      }
    });

    await test('Cross-Platform - Command Generation', async () => {
      // 模拟跨平台命令生成
      function getOSSpecificCommand(baseCommand, platform = process.platform) {
        const commands = {
          checknode: {
            darwin: 'node --version',
            win32: 'node.exe --version || node --version',
            linux: 'node --version'
          },
          checkgit: {
            darwin: 'git --version',
            win32: 'git.exe --version || git --version', 
            linux: 'git --version'
          }
        };
        
        return commands[baseCommand] ? 
          commands[baseCommand][platform] || commands[baseCommand].linux : 
          baseCommand;
      }

      const nodeCommand = getOSSpecificCommand('checknode', 'win32');
      assert(
        nodeCommand.includes('node.exe') || nodeCommand.includes('node --version'),
        'Windows-specific node command generated'
      );

      const macNodeCommand = getOSSpecificCommand('checknode', 'darwin');
      assert(
        macNodeCommand === 'node --version',
        'macOS node command is correct'
      );
    });
  }

  /**
   * 测试性能相关逻辑
   */
  async testPerformanceLogic() {
    await test('Performance - Memory Usage Monitoring', async () => {
      const initialMemory = process.memoryUsage();
      
      // 执行一些内存操作
      const testArray = new Array(10000).fill(0).map((_, i) => ({ id: i, data: `test-${i}` }));
      
      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      assert(heapGrowth > 0, 'Memory usage increased as expected');
      assert(heapGrowth < 50 * 1024 * 1024, 'Memory growth is reasonable (< 50MB)');
      
      // 清理测试数据
      testArray.length = 0;
    });

    await test('Performance - Execution Time Measurement', async () => {
      function measureExecutionTime(fn) {
        const start = process.hrtime.bigint();
        fn();
        const end = process.hrtime.bigint();
        return Number(end - start) / 1000000; // 转换为毫秒
      }

      const executionTime = measureExecutionTime(() => {
        // 模拟一些计算
        let sum = 0;
        for (let i = 0; i < 100000; i++) {
          sum += Math.sqrt(i);
        }
        return sum;
      });

      assert(executionTime > 0, 'Execution time measured');
      assert(executionTime < 1000, 'Execution time is reasonable (< 1000ms)');
      
      log(`  Measured execution time: ${executionTime.toFixed(2)}ms`, 'cyan');
    });
  }

  /**
   * 运行所有独立测试
   */
  async runAll() {
    log('\n🧪 Isolated Test Suite for Claude Code Proxy Pro\n', 'yellow');
    log(`Platform: ${os.platform()} ${os.arch()}`, 'cyan');
    log(`Node.js: ${process.version}`, 'cyan');
    log(`Working Directory: ${process.cwd()}`, 'cyan');
    log('', 'reset');
    
    try {
      // 项目基础结构测试
      await this.testProjectStructure();
      
      // 构建配置测试
      await this.testBuildConfiguration();
      
      // 实用函数逻辑测试
      await this.testUtilityFunctions();
      
      // 配置验证逻辑测试
      await this.testConfigurationValidation();
      
      // 错误处理逻辑测试
      await this.testErrorHandling();
      
      // 跨平台兼容性测试
      await this.testCrossPlatformCompatibility();
      
      // 性能相关逻辑测试
      await this.testPerformanceLogic();
      
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
    log('\n📊 Isolated Test Results:', 'yellow');
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
      log(`⚠️  ${testResults.skipped} tests were skipped`, 'yellow');
    }
    
    log(`\n⏱️  Total test execution time: ${Date.now() - this.startTime}ms`, 'cyan');
    
    // 生成退出码
    const exitCode = testResults.failed > 0 ? 1 : 0;
    if (exitCode === 0) {
      log('\n🎉 All isolated tests completed successfully!', 'green');
    } else {
      log('\n💥 Some tests failed. Please review the errors above.', 'red');
    }
    
    process.exit(exitCode);
  }
}

// 运行测试
if (require.main === module) {
  const suite = new IsolatedTestSuite();
  suite.runAll().catch(error => {
    console.error('Fatal error in isolated test suite:', error);
    process.exit(1);
  });
}

module.exports = IsolatedTestSuite;