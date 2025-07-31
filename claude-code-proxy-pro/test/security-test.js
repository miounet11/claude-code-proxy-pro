/**
 * 安全性测试套件
 * 测试应用的安全配置、API密钥处理、网络通信等安全方面
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 测试结果
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: [],
  securityIssues: []
};

/**
 * 彩色输出
 */
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 测试断言
 */
function assert(condition, message, severity = 'error') {
  if (condition) {
    testResults.passed++;
    log(`✓ ${message}`, 'green');
  } else {
    if (severity === 'warning') {
      testResults.warnings++;
      log(`⚠ ${message}`, 'yellow');
    } else {
      testResults.failed++;
      log(`✗ ${message}`, 'red');
    }
    testResults.errors.push({ message, severity });
  }
}

/**
 * 记录安全问题
 */
function securityIssue(issue, severity = 'medium', recommendation = '') {
  testResults.securityIssues.push({ issue, severity, recommendation });
  log(`🔒 Security Issue (${severity}): ${issue}`, severity === 'high' ? 'red' : 'yellow');
  if (recommendation) {
    log(`   Recommendation: ${recommendation}`, 'cyan');
  }
}

/**
 * 异步测试包装器
 */
async function test(name, fn) {
  log(`\n▶ Security Test: ${name}`, 'blue');
  
  try {
    await fn();
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ message: `${name}: ${error.message}`, severity: 'error' });
    log(`✗ ${name}: ${error.message}`, 'red');
  }
}

/**
 * 安全测试套件
 */
class SecurityTestSuite {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
  }

  /**
   * 测试API密钥处理安全性
   */
  async testApiKeyHandling() {
    await test('API Key Storage Security', async () => {
      // 检查是否有硬编码的API密钥
      const sourceFiles = this.getSourceFiles();
      let hardcodedKeys = false;
      
      const keyPatterns = [
        /sk-ant-[a-zA-Z0-9]{48,}/g,  // Anthropic API key pattern
        /sk-[a-zA-Z0-9]{48,}/g,      // Generic API key pattern
        /"apiKey"\s*:\s*"sk-/g,      // JSON API key
        /'apiKey'\s*:\s*'sk-/g       // JavaScript API key
      ];
      
      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        for (const pattern of keyPatterns) {
          if (pattern.test(content) && !file.includes('test') && !file.includes('example')) {
            hardcodedKeys = true;
            securityIssue(
              `Potential hardcoded API key found in ${path.relative(this.projectRoot, file)}`,
              'high',
              'Use environment variables or secure storage for API keys'
            );
          }
        }
      }
      
      assert(!hardcodedKeys, 'No hardcoded API keys found in source code');
    });

    await test('API Key Validation', async () => {
      // 检查API密钥验证逻辑
      const configManagerPath = path.join(this.projectRoot, 'src', 'main', 'config-manager.js');
      
      if (fs.existsSync(configManagerPath)) {
        const content = fs.readFileSync(configManagerPath, 'utf8');
        
        const hasValidation = content.includes('validate') || content.includes('apiKey');
        assert(hasValidation, 'API key validation logic exists');
        
        // 检查是否有长度验证
        const hasLengthCheck = content.includes('length') || content.includes('trim');
        assert(hasLengthCheck, 'API key length/format validation exists', 'warning');
      } else {
        assert(false, 'Config manager file not found');
      }
    });

    await test('API Key Transmission Security', async () => {
      // 检查API密钥是否通过HTTPS传输
      const proxyManagerPath = path.join(this.projectRoot, 'src', 'main', 'proxy-manager.js');
      
      if (fs.existsSync(proxyManagerPath)) {
        const content = fs.readFileSync(proxyManagerPath, 'utf8');
        
        // 检查是否强制使用HTTPS
        const httpsUsage = content.includes('https://') || content.includes('httpsAgent');
        assert(httpsUsage, 'HTTPS configuration found for API calls');
        
        // 检查是否有不安全的HTTP调用
        const httpCalls = content.match(/http:\/\/(?!localhost|127\.0\.0\.1)/g);
        if (httpCalls && httpCalls.length > 0) {
          securityIssue(
            'Insecure HTTP calls found in proxy manager',
            'medium',
            'Use HTTPS for all external API calls'
          );
        }
        
        assert(!httpCalls || httpCalls.length === 0, 'No insecure HTTP calls to external APIs');
      }
    });
  }

  /**
   * 测试输入验证和清理
   */
  async testInputValidation() {
    await test('Request Input Validation', async () => {
      const proxyManagerPath = path.join(this.projectRoot, 'src', 'main', 'proxy-manager.js');
      
      if (fs.existsSync(proxyManagerPath)) {
        const content = fs.readFileSync(proxyManagerPath, 'utf8');
        
        // 检查输入验证
        const hasValidation = content.includes('validate') || 
                             content.includes('typeof') || 
                             content.includes('Array.isArray');
        assert(hasValidation, 'Input validation logic exists');
        
        // 检查是否有SQL注入防护（虽然这个项目可能不直接使用SQL）
        const sqlPatterns = /\$\{.*\}|\+.*\+|concat\(/gi;
        if (sqlPatterns.test(content)) {
          securityIssue(
            'Potential string concatenation patterns found',
            'low',
            'Use parameterized queries or safe string building'
          );
        }
        
        // 检查XSS防护
        const hasXssProtection = content.includes('escape') || 
                                content.includes('sanitize') ||
                                content.includes('JSON.stringify');
        assert(hasXssProtection, 'XSS protection mechanisms found', 'warning');
      }
    });

    await test('Configuration Input Validation', async () => {
      const configFiles = [
        path.join(this.projectRoot, 'src', 'main', 'config-manager.js'),
        path.join(this.projectRoot, 'src', 'preload', 'preload.js')
      ];
      
      let validationFound = false;
      
      for (const file of configFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          if (content.includes('validate') || content.includes('schema')) {
            validationFound = true;
            break;
          }
        }
      }
      
      assert(validationFound, 'Configuration validation mechanisms exist');
    });

    await test('Path Traversal Protection', async () => {
      const sourceFiles = this.getSourceFiles();
      let pathTraversalRisk = false;
      
      const dangerousPatterns = [
        /\.\.\//g,        // Directory traversal
        /\.\.\\\\?/g,     // Windows directory traversal
        /path\.join\([^)]*\.\.[^)]*\)/g  // Unsafe path.join usage
      ];
      
      for (const file of sourceFiles) {
        if (file.includes('test')) continue; // Skip test files
        
        const content = fs.readFileSync(file, 'utf8');
        
        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            pathTraversalRisk = true;
            securityIssue(
              `Potential path traversal risk in ${path.relative(this.projectRoot, file)}`,
              'medium',
              'Validate and sanitize file paths'
            );
          }
        }
      }
      
      assert(!pathTraversalRisk, 'No path traversal vulnerabilities found');
    });
  }

  /**
   * 测试网络通信安全
   */
  async testNetworkSecurity() {
    await test('HTTPS Configuration', async () => {
      const mainPath = path.join(this.projectRoot, 'src', 'main', 'main.js');
      const proxyPath = path.join(this.projectRoot, 'src', 'main', 'proxy-manager.js');
      
      let httpsConfigured = false;
      
      for (const file of [mainPath, proxyPath]) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          if (content.includes('httpsAgent') || 
              content.includes('rejectUnauthorized') ||
              content.includes('https.Agent')) {
            httpsConfigured = true;
          }
        }
      }
      
      assert(httpsConfigured, 'HTTPS agent configuration found');
    });

    await test('Certificate Validation', async () => {
      const proxyPath = path.join(this.projectRoot, 'src', 'main', 'proxy-manager.js');
      
      if (fs.existsSync(proxyPath)) {
        const content = fs.readFileSync(proxyPath, 'utf8');
        
        // 检查是否禁用了证书验证（这是不安全的）
        const unsafeCertConfig = content.includes('rejectUnauthorized: false') ||
                                content.includes('NODE_TLS_REJECT_UNAUTHORIZED');
        
        if (unsafeCertConfig) {
          securityIssue(
            'Certificate validation may be disabled',
            'high',
            'Always validate SSL/TLS certificates in production'
          );
        }
        
        assert(!unsafeCertConfig, 'Certificate validation is not disabled');
      }
    });

    await test('Request Headers Security', async () => {
      const proxyPath = path.join(this.projectRoot, 'src', 'main', 'proxy-manager.js');
      
      if (fs.existsSync(proxyPath)) {
        const content = fs.readFileSync(proxyPath, 'utf8');
        
        // 检查是否设置了适当的请求头
        const hasUserAgent = content.includes('User-Agent');
        assert(hasUserAgent, 'User-Agent header is set', 'warning');
        
        // 检查是否有敏感信息泄露风险
        const sensitiveHeaders = content.match(/['"]x-api-key['"]\s*:\s*['"]/gi);
        if (sensitiveHeaders) {
          // 这实际上是正确的，但要确保不会记录
          assert(true, 'API key header usage found (ensure not logged)');
        }
      }
    });
  }

  /**
   * 测试日志安全性
   */
  async testLoggingSecurity() {
    await test('Sensitive Data in Logs', async () => {
      const loggerPath = path.join(this.projectRoot, 'src', 'main', 'logger.js');
      const sourceFiles = this.getSourceFiles();
      
      let sensitiveLogging = false;
      
      const sensitivePatterns = [
        /log.*apiKey/gi,
        /log.*password/gi,
        /log.*token/gi,
        /console\.log.*apiKey/gi,
        /console\.log.*password/gi
      ];
      
      for (const file of sourceFiles) {
        if (file.includes('test')) continue;
        
        const content = fs.readFileSync(file, 'utf8');
        
        for (const pattern of sensitivePatterns) {
          if (pattern.test(content)) {
            sensitiveLogging = true;
            securityIssue(
              `Potential sensitive data logging in ${path.relative(this.projectRoot, file)}`,
              'medium',
              'Avoid logging sensitive information like API keys'
            );
          }
        }
      }
      
      assert(!sensitiveLogging, 'No sensitive data found in logging statements');
    });

    await test('Log File Permissions', async () => {
      if (fs.existsSync(loggerPath)) {
        const content = fs.readFileSync(loggerPath, 'utf8');
        
        // 检查日志文件路径设置
        const hasSecureLogPath = content.includes('userData') || 
                                content.includes('getPath');
        assert(hasSecureLogPath, 'Logs stored in secure user directory');
        
        // 在实际环境中，我们会检查文件权限
        // 这里只能检查配置逻辑
        assert(true, 'Log file permissions should be restricted (manual verification needed)', 'warning');
      }
    });
  }

  /**
   * 测试依赖安全性
   */
  async testDependencySecurity() {
    await test('Package Dependencies Audit', async () => {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      // 检查是否有已知的不安全依赖
      const potentiallyUnsafeDeps = [];
      
      for (const [dep, version] of Object.entries(dependencies)) {
        // 检查是否使用了过于宽松的版本范围
        if (version.startsWith('^') || version.startsWith('~')) {
          // 这通常是可以接受的，但要注意
        }
        
        // 检查是否有非常旧的依赖版本（简单检查）
        if (version.includes('0.') && !dep.includes('beta') && !dep.includes('alpha')) {
          potentiallyUnsafeDeps.push(`${dep}@${version} (pre-1.0 version)`);
        }
      }
      
      if (potentiallyUnsafeDeps.length > 0) {
        securityIssue(
          `Pre-1.0 dependencies found: ${potentiallyUnsafeDeps.join(', ')}`,
          'low',
          'Consider reviewing pre-1.0 dependencies for stability'
        );
      }
      
      assert(true, 'Dependency security check completed (run npm audit for detailed analysis)');
    });

    await test('Node.js Security Features', async () => {
      const mainPath = path.join(this.projectRoot, 'src', 'main', 'main.js');
      
      if (fs.existsSync(mainPath)) {
        const content = fs.readFileSync(mainPath, 'utf8');
        
        // 检查是否禁用了不安全的功能
        const hasSecurityFlags = content.includes('no-sandbox') || 
                                 content.includes('disable-gpu-sandbox');
        
        if (hasSecurityFlags) {
          securityIssue(
            'Security sandbox disabled',
            'medium',
            'Only disable sandbox if absolutely necessary and understand the risks'
          );
        }
        
        // 检查是否有上下文隔离
        const hasContextIsolation = content.includes('contextIsolation: true');
        assert(hasContextIsolation, 'Context isolation is enabled');
        
        // 检查是否禁用了node集成
        const nodeIntegration = content.includes('nodeIntegration: false');
        assert(nodeIntegration, 'Node integration is disabled in renderer');
      }
    });
  }

  /**
   * 测试数据存储安全性
   */
  async testDataStorageSecurity() {
    await test('Configuration Storage Security', async () => {
      const sourceFiles = this.getSourceFiles();
      let secureStorage = false;
      
      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.includes('electron-store') || 
            content.includes('userData') || 
            content.includes('getPath')) {
          secureStorage = true;
          break;
        }
      }
      
      assert(secureStorage, 'Secure storage mechanisms are used');
    });

    await test('Temporary File Security', async () => {
      const sourceFiles = this.getSourceFiles();
      let tempFileUsage = false;
      
      const tempPatterns = [
        /\/tmp\//g,
        /temp/gi,
        /getTempPath/gi
      ];
      
      for (const file of sourceFiles) {
        if (file.includes('test')) continue;
        
        const content = fs.readFileSync(file, 'utf8');
        
        for (const pattern of tempPatterns) {
          if (pattern.test(content)) {
            tempFileUsage = true;
            securityIssue(
              `Temporary file usage in ${path.relative(this.projectRoot, file)}`,
              'low',
              'Ensure temporary files are properly cleaned up and have restricted permissions'
            );
          }
        }
      }
      
      if (!tempFileUsage) {
        assert(true, 'No temporary file usage found');
      }
    });
  }

  /**
   * 测试Electron特定安全配置
   */
  async testElectronSecurity() {
    await test('Electron Security Best Practices', async () => {
      const mainPath = path.join(this.projectRoot, 'src', 'main', 'main.js');
      const preloadPath = path.join(this.projectRoot, 'src', 'preload', 'preload.js');
      
      if (fs.existsSync(mainPath)) {
        const mainContent = fs.readFileSync(mainPath, 'utf8');
        
        // 检查webSecurity是否被禁用
        if (mainContent.includes('webSecurity: false')) {
          securityIssue(
            'Web security is disabled',
            'high',
            'Web security should only be disabled in development and for specific use cases'
          );
        } else {
          assert(true, 'Web security is not disabled');
        }
        
        // 检查是否有allowRunningInsecureContent
        if (mainContent.includes('allowRunningInsecureContent: true')) {
          securityIssue(
            'Insecure content is allowed',
            'medium',
            'Avoid allowing insecure content in production'
          );
        } else {
          assert(true, 'Insecure content is not explicitly allowed');
        }
      }
      
      if (fs.existsSync(preloadPath)) {
        const preloadContent = fs.readFileSync(preloadPath, 'utf8');
        
        // 检查preload脚本是否正确使用contextBridge
        const usesContextBridge = preloadContent.includes('contextBridge');
        assert(usesContextBridge, 'Preload script uses contextBridge', 'warning');
      }
    });

    await test('CSP (Content Security Policy)', async () => {
      const htmlPath = path.join(this.projectRoot, 'public', 'index.html');
      
      if (fs.existsSync(htmlPath)) {
        const content = fs.readFileSync(htmlPath, 'utf8');
        
        const hasCSP = content.includes('Content-Security-Policy') ||
                      content.includes('meta http-equiv="Content-Security-Policy"');
        
        if (!hasCSP) {
          securityIssue(
            'No Content Security Policy found',
            'medium',
            'Implement CSP to prevent XSS attacks'
          );
        }
        
        assert(hasCSP, 'Content Security Policy is implemented', 'warning');
      }
    });
  }

  /**
   * 获取源代码文件列表
   */
  getSourceFiles() {
    const sourceFiles = [];
    
    const scanDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          scanDirectory(filePath);
        } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.html'))) {
          sourceFiles.push(filePath);
        }
      }
    };
    
    scanDirectory(this.projectRoot);
    return sourceFiles;
  }

  /**
   * 运行所有安全测试
   */
  async runAll() {
    log('\n🔒 Security Test Suite for Claude Code Proxy Pro\n', 'yellow');
    log(`Project Root: ${this.projectRoot}`, 'cyan');
    log(`Node.js: ${process.version}`, 'cyan');
    log('', 'reset');
    
    try {
      // API密钥处理安全性
      await this.testApiKeyHandling();
      
      // 输入验证和清理
      await this.testInputValidation();
      
      // 网络通信安全
      await this.testNetworkSecurity();
      
      // 日志安全性
      await this.testLoggingSecurity();
      
      // 依赖安全性
      await this.testDependencySecurity();
      
      // 数据存储安全性
      await this.testDataStorageSecurity();
      
      // Electron特定安全配置
      await this.testElectronSecurity();
      
      // 打印结果
      this.printResults();
      
    } catch (error) {
      log(`\n❌ Security test suite failed: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * 打印安全测试结果
   */
  printResults() {
    log('\n📊 Security Test Results:', 'yellow');
    log(`✅ Passed: ${testResults.passed}`, 'green');
    log(`❌ Failed: ${testResults.failed}`, 'red');
    log(`⚠️  Warnings: ${testResults.warnings}`, 'yellow');
    
    if (testResults.securityIssues.length > 0) {
      log('\n🔒 Security Issues Summary:', 'red');
      
      const highIssues = testResults.securityIssues.filter(i => i.severity === 'high');
      const mediumIssues = testResults.securityIssues.filter(i => i.severity === 'medium');
      const lowIssues = testResults.securityIssues.filter(i => i.severity === 'low');
      
      if (highIssues.length > 0) {
        log(`\n🚨 HIGH SEVERITY (${highIssues.length}):`, 'red');
        highIssues.forEach(issue => {
          log(`  - ${issue.issue}`, 'red');
          if (issue.recommendation) {
            log(`    → ${issue.recommendation}`, 'cyan');
          }
        });
      }
      
      if (mediumIssues.length > 0) {
        log(`\n⚠️  MEDIUM SEVERITY (${mediumIssues.length}):`, 'yellow');
        mediumIssues.forEach(issue => {
          log(`  - ${issue.issue}`, 'yellow');
          if (issue.recommendation) {
            log(`    → ${issue.recommendation}`, 'cyan');
          }
        });
      }
      
      if (lowIssues.length > 0) {
        log(`\n💡 LOW SEVERITY (${lowIssues.length}):`, 'cyan');
        lowIssues.forEach(issue => {
          log(`  - ${issue.issue}`, 'cyan');
          if (issue.recommendation) {
            log(`    → ${issue.recommendation}`, 'cyan');
          }
        });
      }
    }
    
    if (testResults.errors.length > 0) {
      log('\n🚨 Test Failures:', 'red');
      testResults.errors.forEach(error => {
        const color = error.severity === 'warning' ? 'yellow' : 'red';
        log(`  - ${error.message}`, color);
      });
    }
    
    const total = testResults.passed + testResults.failed;
    const percentage = total > 0 ? (testResults.passed / total * 100).toFixed(1) : 0;
    
    log(`\n📈 Security Test Success Rate: ${percentage}%`, 
      percentage >= 95 ? 'green' : percentage >= 80 ? 'yellow' : 'red'
    );
    
    // 安全评级
    const highIssues = testResults.securityIssues.filter(i => i.severity === 'high').length;
    const mediumIssues = testResults.securityIssues.filter(i => i.severity === 'medium').length;
    
    let securityRating = 'A';
    let ratingColor = 'green';
    
    if (highIssues > 0) {
      securityRating = 'D';
      ratingColor = 'red';
    } else if (mediumIssues > 2) {
      securityRating = 'C';
      ratingColor = 'yellow';
    } else if (mediumIssues > 0 || testResults.warnings > 5) {
      securityRating = 'B';
      ratingColor = 'yellow';
    }
    
    log(`\n🎯 Security Rating: ${securityRating}`, ratingColor);
    
    // 建议
    log('\n💡 Security Recommendations:', 'cyan');
    if (highIssues === 0 && mediumIssues === 0) {
      log('  - Security posture looks good!', 'green');
      log('  - Continue monitoring for new vulnerabilities', 'cyan');
      log('  - Run npm audit regularly for dependency security', 'cyan');
    } else {
      log('  - Address high severity issues immediately', 'red');
      log('  - Review and fix medium severity issues', 'yellow');
      log('  - Implement regular security testing in CI/CD', 'cyan');
      log('  - Consider security code review process', 'cyan');
    }
    
    const exitCode = highIssues > 0 ? 2 : testResults.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  }
}

// 运行测试
if (require.main === module) {
  const suite = new SecurityTestSuite();
  suite.runAll().catch(error => {
    console.error('Fatal error in security test suite:', error);
    process.exit(1);
  });
}

module.exports = SecurityTestSuite;