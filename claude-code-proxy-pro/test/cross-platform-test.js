/**
 * 跨平台兼容性测试脚本
 * 测试应用在不同操作系统上的兼容性
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 测试配置
const PLATFORMS = {
  DARWIN: 'darwin',
  WIN32: 'win32', 
  LINUX: 'linux'
};

const TEST_CONFIG = {
  timeout: 30000,
  currentPlatform: process.platform,
  supportedPlatforms: [PLATFORMS.DARWIN, PLATFORMS.WIN32, PLATFORMS.LINUX]
};

// 测试结果
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
  platformResults: {}
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
 * 跳过测试
 */
function skip(message, reason) {
  testResults.skipped++;
  log(`⊘ ${message} (${reason})`, 'yellow');
}

/**
 * 异步测试包装器
 */
async function test(name, fn, options = {}) {
  log(`\n▶ Testing: ${name}`, 'blue');
  
  try {
    if (options.skip) {
      skip(name, options.skip);
      return;
    }

    const timeout = options.timeout || TEST_CONFIG.timeout;
    await Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout')), timeout)
      )
    ]);
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`${name}: ${error.message}`);
    log(`✗ ${name}: ${error.message}`, 'red');
  }
}

/**
 * 跨平台兼容性测试套件
 */
class CrossPlatformTestSuite {
  constructor() {
    this.currentPlatform = process.platform;
    this.projectRoot = path.join(__dirname, '..');
  }

  /**
   * 测试平台特定的构建配置
   */
  async testBuildConfigurations() {
    await test('Build Config - Platform Targets', async () => {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const builderConfig = packageJson.build;
      assert(builderConfig !== undefined, 'Electron builder config exists');
      assert(builderConfig.mac !== undefined, 'macOS build config exists');
      assert(builderConfig.win !== undefined, 'Windows build config exists');
      assert(builderConfig.linux !== undefined, 'Linux build config exists');
    });

    await test('Build Config - macOS Specific', async () => {
      const builderPath = path.join(this.projectRoot, 'electron-builder.yml');
      const content = fs.readFileSync(builderPath, 'utf8');
      
      assert(content.includes('mac:'), 'macOS section exists');
      assert(content.includes('dmg:'), 'DMG configuration exists');
      assert(content.includes('hardenedRuntime:'), 'Hardened runtime configured');
      assert(content.includes('gatekeeperAssess:'), 'Gatekeeper settings configured');
    });

    await test('Build Config - Windows Specific', async () => {
      const builderPath = path.join(this.projectRoot, 'electron-builder.yml');
      const content = fs.readFileSync(builderPath, 'utf8');
      
      assert(content.includes('win:'), 'Windows section exists');
      assert(content.includes('nsis:'), 'NSIS installer configured');
      assert(content.includes('portable'), 'Portable version configured');
      assert(content.includes('createDesktopShortcut:'), 'Desktop shortcut configured');
    });

    await test('Build Config - Linux Specific', async () => {
      const builderPath = path.join(this.projectRoot, 'electron-builder.yml');
      const content = fs.readFileSync(builderPath, 'utf8');
      
      assert(content.includes('linux:'), 'Linux section exists');
      assert(content.includes('AppImage'), 'AppImage target configured');
      assert(content.includes('deb'), 'Debian package target configured');
      assert(content.includes('rpm'), 'RPM package target configured');
    });
  }

  /**
   * 测试平台特定的脚本和命令
   */
  async testPlatformScripts() {
    await test('Platform Scripts - Environment Detection Commands', async () => {
      // 读取环境检测脚本
      const envPath = path.join(this.projectRoot, 'src', 'main', 'environment.js');
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      // 检查是否包含平台特定的命令
      assert(envContent.includes('darwin:'), 'macOS commands configured');
      assert(envContent.includes('win32:'), 'Windows commands configured');
      assert(envContent.includes('linux:'), 'Linux commands configured');
      
      // 检查是否有平台特定的路径
      assert(envContent.includes('/usr/local/bin'), 'macOS/Linux paths included');
      assert(envContent.includes('C:\\Program Files'), 'Windows paths included');
    });

    await test('Platform Scripts - Terminal Integration', async () => {
      const mainPath = path.join(this.projectRoot, 'src', 'main', 'main.js');
      const mainContent = fs.readFileSync(mainPath, 'utf8');
      
      // 检查终端集成的平台特定逻辑
      assert(mainContent.includes('process.platform === "darwin"'), 'macOS terminal logic exists');
      assert(mainContent.includes('process.platform === "win32"'), 'Windows terminal logic exists');
      assert(mainContent.includes('gnome-terminal'), 'Linux terminal support exists');
    });

    await test('Platform Scripts - Path Handling', async () => {
      const envPath = path.join(this.projectRoot, 'src', 'main', 'environment.js');
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      // 检查路径分隔符处理
      assert(envContent.includes("platform === 'win32' ? ';' : ':'"), 'Path separator handling exists');
      
      // 检查环境变量处理
      assert(envContent.includes('process.env.PATH'), 'PATH environment variable handling');
      assert(envContent.includes('process.env.HOME'), 'HOME environment variable handling');
    });
  }

  /**
   * 测试依赖和环境检测
   */
  async testEnvironmentDetection() {
    await test('Environment Detection - Node.js', async () => {
      const platform = this.currentPlatform;
      
      // 根据平台选择命令
      const commands = {
        darwin: 'node --version',
        win32: 'node --version',
        linux: 'node --version'
      };
      
      const command = commands[platform];
      assert(command !== undefined, `Node.js check command defined for ${platform}`);
      
      // 实际执行检测
      return new Promise((resolve, reject) => {
        exec(command, (error, stdout) => {
          if (error) {
            skip('Node.js detection failed', error.message);
            resolve();
          } else {
            assert(stdout.includes('v'), 'Node.js version detected');
            log(`  Detected Node.js: ${stdout.trim()}`, 'cyan');
            resolve();
          }
        });
      });
    });

    await test('Environment Detection - Git', async () => {
      const platform = this.currentPlatform;
      
      const commands = {
        darwin: 'git --version',
        win32: 'git --version',
        linux: 'git --version'
      };
      
      const command = commands[platform];
      assert(command !== undefined, `Git check command defined for ${platform}`);
      
      return new Promise((resolve) => {
        exec(command, (error, stdout) => {
          if (error) {
            skip('Git detection failed', 'Git not installed or not in PATH');
          } else {
            assert(stdout.includes('git version'), 'Git version detected');
            log(`  Detected Git: ${stdout.trim()}`, 'cyan');
          }
          resolve();
        });
      });
    });

    await test('Environment Detection - Platform-specific Paths', async () => {
      const platform = this.currentPlatform;
      
      // 平台特定的关键路径
      const platformPaths = {
        darwin: [
          '/usr/local/bin',
          '/opt/homebrew/bin',
          process.env.HOME + '/.local/bin'
        ],
        win32: [
          'C:\\Program Files\\nodejs',
          process.env.APPDATA + '\\npm'
        ].filter(p => p && !p.includes('undefined')),
        linux: [
          '/usr/local/bin',
          '/usr/bin',
          process.env.HOME + '/.local/bin'
        ].filter(p => p && !p.includes('undefined'))
      };
      
      const pathsToCheck = platformPaths[platform] || [];
      let existingPaths = 0;
      
      for (const testPath of pathsToCheck) {
        try {
          if (fs.existsSync(testPath)) {
            existingPaths++;
            log(`  Found path: ${testPath}`, 'cyan');
          }
        } catch (error) {
          // 路径检查失败，忽略
        }
      }
      
      assert(pathsToCheck.length > 0, `Platform-specific paths defined for ${platform}`);
      log(`  Existing paths: ${existingPaths}/${pathsToCheck.length}`, 'cyan');
    });
  }

  /**
   * 测试文件权限和访问
   */
  async testFilePermissions() {
    await test('File Permissions - Application Files', async () => {
      const criticalFiles = [
        'src/main/main.js',
        'src/preload/preload.js',
        'package.json',
        'electron-builder.yml'
      ];
      
      for (const file of criticalFiles) {
        const filePath = path.join(this.projectRoot, file);
        
        try {
          const stats = fs.statSync(filePath);
          assert(stats.isFile(), `${file} is accessible as file`);
          
          // 检查读权限
          fs.accessSync(filePath, fs.constants.R_OK);
          assert(true, `${file} is readable`);
          
        } catch (error) {
          assert(false, `${file} access failed: ${error.message}`);
        }
      }
    });

    await test('File Permissions - Script Executability', async () => {
      const scripts = [
        'test/run-tests.sh',
        'scripts/create-icon-from-svg.sh'
      ].filter(script => fs.existsSync(path.join(this.projectRoot, script)));
      
      if (this.currentPlatform === 'win32') {
        skip('Script executability test skipped', 'Not applicable on Windows');
        return;
      }
      
      for (const script of scripts) {
        const scriptPath = path.join(this.projectRoot, script);
        
        try {
          const stats = fs.statSync(scriptPath);
          const mode = stats.mode;
          const isExecutable = (mode & parseInt('111', 8)) !== 0;
          
          if (isExecutable) {
            assert(true, `${script} is executable`);
          } else {
            log(`  Warning: ${script} may not be executable`, 'yellow');
          }
        } catch (error) {
          assert(false, `${script} permission check failed: ${error.message}`);
        }
      }
    });
  }

  /**
   * 测试构建产物配置
   */
  async testBuildArtifacts() {
    await test('Build Artifacts - File Inclusion', async () => {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const buildConfig = packageJson.build;
      const files = buildConfig.files || [];
      
      // 检查关键文件是否包含在构建中
      const requiredIncludes = ['src/**/*', 'public/**/*', 'assets/**/*', 'locales/**/*'];
      
      for (const include of requiredIncludes) {
        const isIncluded = files.some(pattern => pattern === include);
        assert(isIncluded, `Build includes ${include}`);
      }
      
      // 检查是否正确排除测试文件
      const shouldExclude = files.some(pattern => 
        pattern.includes('*.test.js') || pattern.includes('test')
      );
      assert(shouldExclude, 'Test files are excluded from build');
    });

    await test('Build Artifacts - Icon Configuration', async () => {
      const builderPath = path.join(this.projectRoot, 'electron-builder.yml');
      const content = fs.readFileSync(builderPath, 'utf8');
      
      // 检查各平台的图标配置
      assert(content.includes('icon: build/icon.icns'), 'macOS icon configured');
      assert(content.includes('icon: build/icon.ico'), 'Windows icon configured');
      assert(content.includes('icon: build/icons'), 'Linux icons configured');
      
      // 检查图标文件是否存在（如果build目录存在）
      const buildDir = path.join(this.projectRoot, 'build');
      if (fs.existsSync(buildDir)) {
        log('  Build directory exists, checking icons...', 'cyan');
        
        const iconChecks = [
          { file: 'icon.icns', platform: 'macOS' },
          { file: 'icon.ico', platform: 'Windows' },
          { file: 'icons', platform: 'Linux', isDir: true }
        ];
        
        for (const check of iconChecks) {
          const iconPath = path.join(buildDir, check.file);
          if (fs.existsSync(iconPath)) {
            const stats = fs.statSync(iconPath);
            const isCorrectType = check.isDir ? stats.isDirectory() : stats.isFile();
            assert(isCorrectType, `${check.platform} icon configured correctly`);
          }
        }
      } else {
        log('  Build directory not found, icon files not checked', 'yellow');
      }
    });
  }

  /**
   * 测试平台特定的功能
   */
  async testPlatformSpecificFeatures() {
    const platform = this.currentPlatform;

    await test(`Platform Features - ${platform.toUpperCase()} Specific`, async () => {
      if (platform === PLATFORMS.DARWIN) {
        // macOS 特定测试
        assert(process.env.HOME !== undefined, 'HOME environment variable exists');
        
        // 检查常见 macOS 路径
        const macPaths = ['/usr/local', '/opt', '/Applications'];
        let existingMacPaths = 0;
        
        for (const macPath of macPaths) {
          if (fs.existsSync(macPath)) {
            existingMacPaths++;
          }
        }
        
        assert(existingMacPaths > 0, 'macOS system paths accessible');
        log(`  Found ${existingMacPaths}/${macPaths.length} macOS system paths`, 'cyan');
        
      } else if (platform === PLATFORMS.WIN32) {
        // Windows 特定测试
        assert(process.env.APPDATA !== undefined, 'APPDATA environment variable exists');
        assert(process.env.LOCALAPPDATA !== undefined, 'LOCALAPPDATA environment variable exists');
        
        // 检查 Windows 特定路径
        const winPaths = ['C:\\Windows', 'C:\\Program Files'];
        let existingWinPaths = 0;
        
        for (const winPath of winPaths) {
          if (fs.existsSync(winPath)) {
            existingWinPaths++;
          }
        }
        
        assert(existingWinPaths > 0, 'Windows system paths accessible');
        log(`  Found ${existingWinPaths}/${winPaths.length} Windows system paths`, 'cyan');
        
      } else if (platform === PLATFORMS.LINUX) {
        // Linux 特定测试
        assert(process.env.HOME !== undefined, 'HOME environment variable exists');
        
        // 检查 Linux 特定路径
        const linuxPaths = ['/usr', '/bin', '/etc'];
        let existingLinuxPaths = 0;
        
        for (const linuxPath of linuxPaths) {
          if (fs.existsSync(linuxPath)) {
            existingLinuxPaths++;
          }
        }
        
        assert(existingLinuxPaths > 0, 'Linux system paths accessible');
        log(`  Found ${existingLinuxPaths}/${linuxPaths.length} Linux system paths`, 'cyan');
      }
    });

    await test('Platform Features - Architecture Support', async () => {
      const arch = process.arch;
      const supportedArchs = ['x64', 'arm64', 'ia32'];
      
      assert(supportedArchs.includes(arch), `Architecture ${arch} is supported`);
      log(`  Running on ${platform} ${arch}`, 'cyan');
      
      // 检查构建配置是否支持当前架构
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const buildConfig = packageJson.build;
      
      let archSupported = false;
      
      if (platform === PLATFORMS.DARWIN && buildConfig.mac) {
        const macTargets = buildConfig.mac.target || [];
        archSupported = macTargets.some(target => 
          target.arch && target.arch.includes(arch)
        );
      } else if (platform === PLATFORMS.WIN32 && buildConfig.win) {
        const winTargets = buildConfig.win.target || [];
        archSupported = winTargets.some(target => 
          target.arch && target.arch.includes(arch)
        );
      } else if (platform === PLATFORMS.LINUX && buildConfig.linux) {
        const linuxTargets = buildConfig.linux.target || [];
        archSupported = linuxTargets.some(target => 
          target.arch && target.arch.includes(arch)
        );
      }
      
      if (archSupported) {
        assert(true, `Architecture ${arch} is configured for builds`);
      } else {
        log(`  Warning: Architecture ${arch} may not be configured for builds`, 'yellow');
      }
    });
  }

  /**
   * 运行所有跨平台测试
   */
  async runAll() {
    log('\n🌍 Cross-Platform Compatibility Test Suite\n', 'yellow');
    log(`Current Platform: ${this.currentPlatform}`, 'cyan');
    log(`Architecture: ${process.arch}`, 'cyan');
    log(`Node.js: ${process.version}`, 'cyan');
    log(`OS: ${os.type()} ${os.release()}`, 'cyan');
    log('', 'reset');
    
    try {
      // 构建配置测试
      await this.testBuildConfigurations();
      
      // 平台脚本测试
      await this.testPlatformScripts();
      
      // 环境检测测试
      await this.testEnvironmentDetection();
      
      // 文件权限测试
      await this.testFilePermissions();
      
      // 构建产物测试
      await this.testBuildArtifacts();
      
      // 平台特定功能测试
      await this.testPlatformSpecificFeatures();
      
      // 打印结果
      this.printResults();
      
    } catch (error) {
      log(`\n❌ Cross-platform test suite failed: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * 打印测试结果
   */
  printResults() {
    log('\n📊 Cross-Platform Test Results:', 'yellow');
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
    
    // 平台兼容性总结
    log(`\n🎯 Platform Compatibility Summary:`, 'cyan');
    log(`  Current Platform: ${this.currentPlatform} ✅`, 'green');
    
    const otherPlatforms = TEST_CONFIG.supportedPlatforms.filter(p => p !== this.currentPlatform);
    otherPlatforms.forEach(platform => {
      log(`  ${platform}: Configuration verified ⚠️`, 'yellow');
    });
    
    log('\n💡 Recommendations:', 'cyan');
    if (testResults.failed === 0) {
      log('  - Application should work well on current platform', 'green');
      log('  - Consider testing on other platforms for full validation', 'yellow');
    } else {
      log('  - Address failed tests before cross-platform deployment', 'red');
      log('  - Review platform-specific configurations', 'yellow');
    }
    
    const exitCode = testResults.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  }
}

// 运行测试
if (require.main === module) {
  const suite = new CrossPlatformTestSuite();
  suite.runAll().catch(error => {
    console.error('Fatal error in cross-platform test suite:', error);
    process.exit(1);
  });
}

module.exports = CrossPlatformTestSuite;