/**
 * 端到端测试脚本
 * 模拟用户操作流程，测试完整功能
 */

const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

// 测试配置
const TEST_CONFIG = {
  appPath: path.join(__dirname, '..'),
  testApiKey: process.env.TEST_API_KEY || 'test-api-key-123456',
  testBaseUrl: 'https://api.anthropic.com/v1',
  proxyPort: 3090,
  screenshots: true,
  screenshotDir: path.join(__dirname, 'screenshots')
};

// 测试结果
const testResults = {
  passed: [],
  failed: [],
  screenshots: []
};

// 颜色输出
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

class E2ETestSuite {
  constructor() {
    this.app = null;
    this.browser = null;
    this.page = null;
  }

  /**
   * 启动Electron应用
   */
  async startApp() {
    return new Promise((resolve, reject) => {
      this.app = spawn('electron', [TEST_CONFIG.appPath, '--test', '--no-sandbox'], {
        env: { ...process.env, NODE_ENV: 'test' }
      });

      this.app.stdout.on('data', (data) => {
        console.log(`[App]: ${data}`);
      });

      this.app.stderr.on('data', (data) => {
        console.error(`[App Error]: ${data}`);
      });

      // 等待应用完全启动
      setTimeout(resolve, 5000);
    });
  }

  /**
   * 连接到应用
   */
  async connectToBrowser() {
    // 获取调试端口
    const debugPort = 9222;
    
    this.browser = await puppeteer.connect({
      browserURL: `http://localhost:${debugPort}`,
      defaultViewport: null
    });

    const pages = await this.browser.pages();
    this.page = pages[0] || await this.browser.newPage();
    
    // 设置视口大小
    await this.page.setViewport({ width: 1200, height: 800 });
  }

  /**
   * 截图
   */
  async screenshot(name) {
    if (!TEST_CONFIG.screenshots) return;
    
    if (!fs.existsSync(TEST_CONFIG.screenshotDir)) {
      fs.mkdirSync(TEST_CONFIG.screenshotDir, { recursive: true });
    }
    
    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(TEST_CONFIG.screenshotDir, filename);
    
    await this.page.screenshot({ path: filepath, fullPage: true });
    testResults.screenshots.push(filepath);
    
    return filepath;
  }

  /**
   * 等待元素并点击
   */
  async clickElement(selector, options = {}) {
    await this.page.waitForSelector(selector, { visible: true, ...options });
    await this.page.click(selector);
  }

  /**
   * 等待元素并输入文本
   */
  async typeInElement(selector, text, options = {}) {
    await this.page.waitForSelector(selector, { visible: true, ...options });
    await this.page.click(selector, { clickCount: 3 }); // 三击全选
    await this.page.type(selector, text);
  }

  /**
   * 检查元素文本
   */
  async checkElementText(selector, expectedText) {
    await this.page.waitForSelector(selector, { visible: true });
    const text = await this.page.$eval(selector, el => el.textContent);
    return text.includes(expectedText);
  }

  /**
   * 等待Toast消息
   */
  async waitForToast(expectedText, type = 'success') {
    try {
      await this.page.waitForFunction(
        (expectedText, type) => {
          const toast = document.getElementById('toast');
          return toast && 
                 toast.classList.contains('show') && 
                 toast.classList.contains(type) &&
                 toast.textContent.includes(expectedText);
        },
        { timeout: 5000 },
        expectedText,
        type
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 运行测试用例
   */
  async runTest(name, testFn) {
    log(`\n▶ Testing: ${name}`, 'blue');
    
    try {
      await testFn();
      testResults.passed.push(name);
      log(`✓ ${name}`, 'green');
    } catch (error) {
      testResults.failed.push({ name, error: error.message });
      log(`✗ ${name}: ${error.message}`, 'red');
      
      // 失败时截图
      const screenshot = await this.screenshot(`error-${name.replace(/\s+/g, '-')}`);
      if (screenshot) {
        log(`  Screenshot saved: ${screenshot}`, 'yellow');
      }
    }
  }

  /**
   * 测试用例集合
   */
  async runAllTests() {
    // 测试1: 应用启动
    await this.runTest('Application Launch', async () => {
      await this.screenshot('app-launch');
      const title = await this.page.title();
      if (!title.includes('Claude Code Proxy')) {
        throw new Error('Invalid app title');
      }
    });

    // 测试2: 环境检测
    await this.runTest('Environment Detection', async () => {
      await this.clickElement('#checkEnvBtn');
      await this.page.waitForTimeout(2000);
      
      const envItems = await this.page.$$('.env-item');
      if (envItems.length === 0) {
        throw new Error('No environments detected');
      }
      
      await this.screenshot('environments');
    });

    // 测试3: API配置
    await this.runTest('API Configuration', async () => {
      // 输入API密钥
      await this.typeInElement('#apiKey', TEST_CONFIG.testApiKey);
      
      // 切换密钥可见性
      await this.clickElement('#toggleApiKey');
      await this.page.waitForTimeout(500);
      
      const inputType = await this.page.$eval('#apiKey', el => el.type);
      if (inputType !== 'text') {
        throw new Error('API key visibility toggle failed');
      }
      
      await this.screenshot('api-config');
    });

    // 测试4: 保存配置
    await this.runTest('Save Configuration', async () => {
      await this.clickElement('#saveEnvBtn');
      
      const toastShown = await this.waitForToast('设置已保存', 'success');
      if (!toastShown) {
        throw new Error('Save confirmation toast not shown');
      }
      
      await this.screenshot('config-saved');
    });

    // 测试5: 测试连接
    await this.runTest('Test API Connection', async () => {
      await this.clickElement('#testEnvBtn');
      
      // 等待测试完成（可能成功或失败）
      await this.page.waitForTimeout(3000);
      
      // 检查是否有toast消息
      const hasToast = await this.page.$eval('#toast', el => 
        el.classList.contains('show')
      );
      
      if (!hasToast) {
        throw new Error('No connection test result shown');
      }
      
      await this.screenshot('connection-test');
    });

    // 测试6: 启动代理
    await this.runTest('Start Proxy Server', async () => {
      // 查找并点击启动代理按钮（如果存在）
      const startProxyBtn = await this.page.$('#startProxyBtn');
      if (startProxyBtn) {
        await this.clickElement('#startProxyBtn');
        await this.page.waitForTimeout(2000);
        
        // 检查代理状态
        const proxyStatus = await this.page.$('#proxyStatus');
        if (proxyStatus) {
          const statusText = await this.page.$eval('#proxyStatus', el => el.textContent);
          if (!statusText.includes('运行中')) {
            throw new Error('Proxy not running after start');
          }
        }
      }
      
      await this.screenshot('proxy-started');
    });

    // 测试7: 错误处理
    await this.runTest('Error Handling', async () => {
      // 清空API密钥并尝试保存
      await this.page.click('#apiKey', { clickCount: 3 });
      await this.page.keyboard.press('Delete');
      
      await this.clickElement('#saveEnvBtn');
      
      // 应该显示错误提示
      const errorToastShown = await this.waitForToast('不能为空', 'error');
      if (!errorToastShown) {
        throw new Error('Validation error not shown');
      }
      
      await this.screenshot('error-handling');
    });

    // 测试8: 键盘快捷键
    await this.runTest('Keyboard Shortcuts', async () => {
      // 恢复API密钥
      await this.typeInElement('#apiKey', TEST_CONFIG.testApiKey);
      
      // 使用Ctrl+S保存
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('S');
      await this.page.keyboard.up('Control');
      
      const saveToastShown = await this.waitForToast('设置已保存', 'success');
      if (!saveToastShown) {
        throw new Error('Keyboard shortcut save failed');
      }
    });

    // 测试9: 响应式设计
    await this.runTest('Responsive Design', async () => {
      // 测试小屏幕
      await this.page.setViewport({ width: 800, height: 600 });
      await this.page.waitForTimeout(500);
      await this.screenshot('responsive-small');
      
      // 测试大屏幕
      await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.waitForTimeout(500);
      await this.screenshot('responsive-large');
    });

    // 测试10: 内存泄漏检测
    await this.runTest('Memory Leak Detection', async () => {
      const initialMemory = await this.page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });
      
      // 执行多次操作
      for (let i = 0; i < 5; i++) {
        await this.clickElement('#checkEnvBtn');
        await this.page.waitForTimeout(1000);
      }
      
      const finalMemory = await this.page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });
      
      // 内存增长不应超过50%
      const memoryGrowth = (finalMemory - initialMemory) / initialMemory;
      if (memoryGrowth > 0.5) {
        throw new Error(`Potential memory leak detected: ${(memoryGrowth * 100).toFixed(1)}% growth`);
      }
    });
  }

  /**
   * 清理
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.disconnect();
    }
    
    if (this.app) {
      this.app.kill();
    }
  }

  /**
   * 打印测试报告
   */
  printReport() {
    log('\n📊 E2E Test Report:', 'yellow');
    log(`✅ Passed: ${testResults.passed.length}`, 'green');
    log(`❌ Failed: ${testResults.failed.length}`, 'red');
    
    if (testResults.failed.length > 0) {
      log('\n🚨 Failed Tests:', 'red');
      testResults.failed.forEach(({ name, error }) => {
        log(`  - ${name}: ${error}`, 'red');
      });
    }
    
    if (testResults.screenshots.length > 0) {
      log('\n📸 Screenshots:', 'blue');
      testResults.screenshots.forEach(file => {
        log(`  - ${path.basename(file)}`, 'blue');
      });
    }
    
    const total = testResults.passed.length + testResults.failed.length;
    const successRate = total > 0 ? (testResults.passed.length / total * 100).toFixed(1) : 0;
    
    log(`\n📈 Success Rate: ${successRate}%`, 
      successRate >= 80 ? 'green' : successRate >= 60 ? 'yellow' : 'red'
    );
  }

  /**
   * 运行完整测试
   */
  async run() {
    log('🧪 Starting E2E Tests for Claude Code Proxy Pro\n', 'yellow');
    
    try {
      log('Starting Electron app...', 'blue');
      await this.startApp();
      
      log('Connecting to app...', 'blue');
      await this.connectToBrowser();
      
      log('Running tests...', 'blue');
      await this.runAllTests();
      
    } catch (error) {
      log(`\n❌ Fatal error: ${error.message}`, 'red');
      console.error(error);
    } finally {
      await this.cleanup();
      this.printReport();
      
      process.exit(testResults.failed.length > 0 ? 1 : 0);
    }
  }
}

// 运行测试
if (require.main === module) {
  const suite = new E2ETestSuite();
  suite.run();
}

module.exports = E2ETestSuite;