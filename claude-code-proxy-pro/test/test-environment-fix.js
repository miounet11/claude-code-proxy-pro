/**
 * 测试环境修复工具
 * 解决单元测试中 Electron API 依赖问题
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Electron API 模拟器
 * 为非 Electron 环境提供必要的 API 模拟
 */
class ElectronMock {
  constructor() {
    this.appDataPath = path.join(os.tmpdir(), 'claude-proxy-test');
    this.isReady = true;
    this.callbacks = {
      ready: [],
      'window-all-closed': [],
      'before-quit': [],
      activate: []
    };
    
    // 确保测试目录存在
    if (!fs.existsSync(this.appDataPath)) {
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }
  }

  // 模拟 app.getPath()
  getPath(name) {
    const paths = {
      userData: this.appDataPath,
      temp: os.tmpdir(),
      home: os.homedir(),
      logs: path.join(this.appDataPath, 'logs'),
      crashDumps: path.join(this.appDataPath, 'crashes')
    };
    
    return paths[name] || this.appDataPath;
  }

  // 模拟 app.getVersion()
  getVersion() {
    try {
      const packageJson = require('../package.json');
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  // 模拟 app.isReady()
  isReady() {
    return this.isReady;
  }

  // 模拟 app.whenReady()
  whenReady() {
    return Promise.resolve();
  }

  // 模拟 app.quit()
  quit() {
    console.log('Mock app quit called');
  }

  // 模拟事件监听
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  // 模拟事件触发
  emit(event, ...args) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }
}

/**
 * Dialog 模拟器
 */
class DialogMock {
  showMessageBox(options) {
    console.log('Mock dialog:', options.message);
    return Promise.resolve({ response: 0 });
  }

  showSaveDialog(options) {
    return Promise.resolve({ 
      canceled: false, 
      filePath: path.join(os.tmpdir(), options.defaultPath || 'test-file.txt')
    });
  }

  showErrorBox(title, content) {
    console.error('Mock error dialog:', title, content);
  }
}

/**
 * IPC Main 模拟器
 */
class IpcMainMock {
  constructor() {
    this.handlers = new Map();
  }

  handle(channel, handler) {
    this.handlers.set(channel, handler);
  }

  // 模拟 IPC 调用（用于测试）
  async invoke(channel, ...args) {
    const handler = this.handlers.get(channel);
    if (handler) {
      return await handler(null, ...args);
    }
    throw new Error(`No handler for channel: ${channel}`);
  }
}

/**
 * Shell 模拟器
 */
class ShellMock {
  openExternal(url) {
    console.log('Mock open external:', url);
    return Promise.resolve();
  }

  showItemInFolder(path) {
    console.log('Mock show item in folder:', path);
  }
}

/**
 * BrowserWindow 模拟器
 */
class BrowserWindowMock {
  constructor(options = {}) {
    this.options = options;
    this.webContents = {
      send: (channel, data) => {
        console.log('Mock webContents send:', channel, data);
      },
      openDevTools: () => {
        console.log('Mock open dev tools');
      }
    };
  }

  loadURL(url) {
    console.log('Mock load URL:', url);
    return Promise.resolve();
  }

  show() {
    console.log('Mock window show');
  }

  close() {
    console.log('Mock window close');
  }

  on(event, callback) {
    // 立即触发 ready-to-show 事件用于测试
    if (event === 'ready-to-show' && callback) {
      setTimeout(callback, 100);
    }
  }

  once(event, callback) {
    this.on(event, callback);
  }

  static getAllWindows() {
    return [];
  }
}

/**
 * 测试环境设置器
 */
class TestEnvironmentSetup {
  constructor() {
    this.originalModules = {};
    this.isSetup = false;
  }

  /**
   * 设置测试环境
   */
  setup() {
    if (this.isSetup) return;

    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    
    // 保存原始模块（如果存在）
    try {
      this.originalModules.electron = require('electron');
    } catch {
      // Electron 不存在，需要模拟
    }

    // 创建 Electron 模拟
    const electronMock = {
      app: new ElectronMock(),
      dialog: new DialogMock(),
      ipcMain: new IpcMainMock(),
      shell: new ShellMock(),
      BrowserWindow: BrowserWindowMock
    };

    // 将模拟对象注入到 require 缓存中
    const electronPath = require.resolve.paths('electron');
    if (electronPath) {
      try {
        require.cache[require.resolve('electron')] = {
          exports: electronMock,
          loaded: true
        };
      } catch {
        // 忽略模块缓存错误
      }
    }

    // 全局 Electron 模拟
    global.mockElectron = electronMock;

    this.isSetup = true;
    console.log('✅ Test environment setup complete');
  }

  /**
   * 清理测试环境
   */
  cleanup() {
    if (!this.isSetup) return;

    // 清理测试文件
    const testDir = path.join(os.tmpdir(), 'claude-proxy-test');
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error.message);
    }

    // 清理全局对象
    delete global.mockElectron;

    // 恢复环境变量
    delete process.env.NODE_ENV;

    this.isSetup = false;
    console.log('✅ Test environment cleanup complete');
  }

  /**
   * 获取模拟的 Electron 对象
   */
  getElectronMock() {
    if (!this.isSetup) {
      this.setup();
    }
    return global.mockElectron;
  }
}

// 自动设置测试环境
const testEnv = new TestEnvironmentSetup();

// 在测试开始前设置环境
if (process.env.NODE_ENV === 'test' || process.argv.includes('--test')) {
  testEnv.setup();
}

// 在进程退出时清理
process.on('exit', () => {
  testEnv.cleanup();
});

process.on('SIGINT', () => {
  testEnv.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  testEnv.cleanup();
  process.exit(0);
});

module.exports = {
  ElectronMock,
  DialogMock,
  IpcMainMock,
  ShellMock,
  BrowserWindowMock,
  TestEnvironmentSetup,
  testEnvironment: testEnv
};