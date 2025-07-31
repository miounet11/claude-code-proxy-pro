const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ProxyManager = require('./proxy-manager');
const { checkAllEnvironments, installEnvironment } = require('./environment');
const { execSync, exec } = require('child_process');
const axios = require('axios');
const ConfigManager = require('./config-manager');
const ProfileManager = require('./profile-manager');
const { logger } = require('./logger');
const { errorHandler, ErrorType } = require('./error-handler');
const UpdateManager = require('./updater');
const i18n = require('./i18n');

// 禁用 GPU 加速以避免崩溃
app.disableHardwareAcceleration();

// 设置 Chromium 标志以提高稳定性
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');

// 延迟初始化的管理器实例
let configManager = null;
let profileManager = null;
let proxyManager = null;
let updateManager = null;

// 初始化函数
function initializeManagers() {
  // 初始化配置管理器
  configManager = new ConfigManager();
  
  // 初始化配置文件管理器
  profileManager = new ProfileManager();
  
  // 初始化代理管理器
  proxyManager = new ProxyManager();
  
  // 初始化更新管理器
  updateManager = new UpdateManager();
  
  // 记录应用启动
  logger.info('Main', 'Application starting', {
    version: app.getVersion(),
    platform: process.platform
  });
}

// 保持窗口引用，防止被垃圾回收
let mainWindow = null;

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    // 添加背景色避免白屏
    backgroundColor: '#1e1e1e'
  });

  // 加载应用界面
  const startUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../../public/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // 窗口准备就绪后显示，避免长时间跳动
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 聚焦窗口，停止图标跳动
    if (process.platform === 'darwin') {
      app.dock.bounce('informational');
    }
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }
  });

  // 窗口关闭处理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用就绪事件
app.whenReady().then(() => {
  // 首先初始化管理器
  initializeManagers();
  
  // 初始化多语言系统
  i18n.init();
  
  createWindow();
  
  // 设置更新管理器的主窗口
  updateManager.setMainWindow(mainWindow);
  
  // macOS应用激活处理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（Windows/Linux）
app.on('window-all-closed', () => {
  // 停止代理服务
  if (proxyManager) {
    proxyManager.stop();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  logger.info('Main', 'Application shutting down');
  if (proxyManager) {
    proxyManager.stop();
  }
  logger.info('Main', 'Cleanup completed');
});

// IPC通信处理 - 使用错误处理包装器
ipcMain.handle('get-config', errorHandler.wrapIpcHandler(() => {
  return configManager.getAll();
}, ErrorType.CONFIG));

ipcMain.handle('save-config', errorHandler.wrapIpcHandler((_, config) => {
  const validation = configManager.validate(config);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }
  configManager.update(config);
  logger.info('Main', 'Configuration updated');
  return { success: true };
}, ErrorType.CONFIG));

ipcMain.handle('get-app-version', () => app.getVersion());

// 代理管理相关IPC
ipcMain.handle('start-proxy', errorHandler.wrapIpcHandler(async (_, config) => {
  logger.info('Main', 'Starting proxy server', { port: config.proxyPort });
  
  // 适配新的配置格式
  const proxyConfig = {
    apiKey: config.apiKey,
    baseUrl: config.apiUrl,
    bigModel: config.bigModel,
    smallModel: config.smallModel,
    port: config.proxyPort
  };
  
  const result = await proxyManager.start(proxyConfig);
  
  if (result.success) {
    logger.info('Main', 'Proxy server started successfully');
    // 通知渲染进程
    if (mainWindow) {
      mainWindow.webContents.send('proxy-status', true);
    }
  } else {
    logger.error('Main', 'Failed to start proxy server', { error: result.error });
  }
  
  return result;
}, ErrorType.PROXY));

ipcMain.handle('stop-proxy', errorHandler.wrapIpcHandler(() => {
  logger.info('Main', 'Stopping proxy server');
  const result = proxyManager.stop();
  logger.info('Main', 'Proxy server stopped');
  
  // 通知渲染进程
  if (mainWindow) {
    mainWindow.webContents.send('proxy-status', false);
  }
  
  return result;
}, ErrorType.PROXY));

ipcMain.handle('get-proxy-status', errorHandler.wrapIpcHandler(() => {
  return proxyManager.getStatus();
}, ErrorType.PROXY));

// 环境检测相关IPC
ipcMain.handle('check-environments', errorHandler.wrapIpcHandler(async () => {
  logger.info('Main', 'Checking environments');
  const result = await checkAllEnvironments();
  logger.info('Main', 'Environment check completed', result);
  return result;
}, ErrorType.SYSTEM));

ipcMain.handle('install-environment', errorHandler.wrapIpcHandler(async (_, key) => {
  logger.info('Main', 'Installing environment', { key });
  const result = await installEnvironment(key);
  if (result.success) {
    logger.info('Main', 'Environment installed successfully', { key });
  } else {
    logger.error('Main', 'Failed to install environment', { key, error: result.error });
  }
  return result;
}, ErrorType.SYSTEM));

// Claude Code 启动
ipcMain.handle('start-claude-code', async (_, config) => {
  try {
    const proxyStatus = proxyManager.getStatus();
    if (!proxyStatus.running) {
      return { success: false, error: '请先启动代理服务' };
    }
    
    // 设置环境变量，让 Claude Code 使用我们的代理
    const env = {
      ...process.env,
      // Claude Code 会使用这些环境变量
      ANTHROPIC_API_KEY: 'proxy-key', // 任意值，实际认证由代理处理
      ANTHROPIC_BASE_URL: `http://localhost:${proxyStatus.port}/v1`, // 指向我们的代理
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: config.maxTokens || '32000',
      // 禁用 Claude Code 的 API 密钥验证
      CLAUDE_CODE_SKIP_API_KEY_CHECK: 'true'
    };
    
    logger.info('Main', 'Starting Claude Code with proxy', {
      proxyUrl: env.ANTHROPIC_BASE_URL,
      maxTokens: env.CLAUDE_CODE_MAX_OUTPUT_TOKENS
    });
    
    // 使用系统命令启动 Claude Code
    if (process.platform === 'win32') {
      exec('start cmd /k claude', { env });
    } else if (process.platform === 'darwin') {
      // macOS: 在新的终端窗口中启动
      const script = `
        export ANTHROPIC_API_KEY="proxy-key"
        export ANTHROPIC_BASE_URL="http://localhost:${proxyStatus.port}/v1"
        export CLAUDE_CODE_MAX_OUTPUT_TOKENS="${config.maxTokens || '32000'}"
        claude
      `;
      exec(`osascript -e 'tell app "Terminal" to do script "${script}"'`);
    } else {
      // Linux: 尝试在新终端中启动
      exec(`gnome-terminal -- bash -c 'export ANTHROPIC_API_KEY="proxy-key" && export ANTHROPIC_BASE_URL="http://localhost:${proxyStatus.port}/v1" && claude; bash'`);
    }
    
    return { success: true, message: 'Claude Code 已启动' };
  } catch (error) {
    logger.error('Main', 'Failed to start Claude Code', { error: error.message });
    return { success: false, error: error.message };
  }
});

// 测试API连接
ipcMain.handle('test-api-connection', errorHandler.wrapIpcHandler(async (_, config) => {
  logger.info('Main', 'Testing API connection', { baseUrl: config.baseUrl });
  
  try {
    const response = await axios.post(config.baseUrl + '/chat/completions', {
      model: config.model,
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: config.timeout || 5000
    });
    
    logger.info('Main', 'API connection test successful');
    return { success: true, message: 'API connection successful' };
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    logger.error('Main', 'API connection test failed', {
      error: errorMessage,
      status: error.response?.status
    });
    
    return { 
      success: false, 
      error: errorMessage,
      details: {
        status: error.response?.status,
        data: error.response?.data
      }
    };
  }
}, ErrorType.API));

// 系统操作
ipcMain.handle('open-external', async (_, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('show-item-in-folder', async (_, path) => {
  shell.showItemInFolder(path);
});

// 更新相关操作
ipcMain.handle('check-for-updates', async () => {
  updateManager.checkForUpdates();
});

// 配置文件管理相关IPC
ipcMain.handle('load-profiles', () => {
  return profileManager.getProfiles();
});

ipcMain.handle('save-profiles', (_, profiles) => {
  profileManager.saveProfiles(profiles);
  return { success: true };
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

// 多语言相关IPC
ipcMain.handle('get-locale', () => {
  return i18n.getLocale();
});

ipcMain.handle('set-locale', (_, locale) => {
  const success = i18n.setLocale(locale);
  if (success && mainWindow) {
    mainWindow.webContents.send('locale-changed', locale);
  }
  return { success };
});

ipcMain.handle('get-translations', () => {
  return i18n.translations[i18n.getLocale()] || {};
});

ipcMain.handle('get-supported-locales', () => {
  return i18n.getSupportedLocales();
});

ipcMain.handle('test-config', async (_, config) => {
  try {
    const response = await axios.post(config.apiUrl + '/chat/completions', {
      model: config.model,
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    };
  }
});

// 注意：start-proxy 和 stop-proxy 已经在上面注册过了

ipcMain.handle('open-terminal', async () => {
  try {
    if (process.platform === 'darwin') {
      // macOS: 使用 open 命令打开终端
      exec('open -a Terminal');
      return { success: true };
    } else if (process.platform === 'win32') {
      // Windows: 尝试打开 Windows Terminal 或 CMD
      exec('start wt', (error) => {
        if (error) {
          // 如果 Windows Terminal 不存在，打开 CMD
          exec('start cmd');
        }
      });
      return { success: true };
    } else {
      // Linux: 尝试常见的终端模拟器
      const terminals = ['gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm'];
      
      for (const terminal of terminals) {
        try {
          exec(terminal);
          return { success: true };
        } catch (e) {
          // 继续尝试下一个
        }
      }
      
      throw new Error('No terminal emulator found');
    }
  } catch (error) {
    logger.error('Main', 'Failed to open terminal', { error: error.message });
    return { success: false, error: error.message };
  }
});

// 打开终端并执行命令
ipcMain.handle('open-terminal-with-command', async (_, command) => {
  try {
    if (process.platform === 'darwin') {
      // macOS: 在新终端中执行命令
      const script = command.replace(/'/g, "\\'").replace(/"/g, '\\"');
      exec(`osascript -e 'tell app "Terminal" to do script "${script}"'`);
      return { success: true };
    } else if (process.platform === 'win32') {
      // Windows: 在新CMD中执行命令
      exec(`start cmd /k "${command}"`);
      return { success: true };
    } else {
      // Linux: 在新终端中执行命令
      exec(`gnome-terminal -- bash -c '${command}; exec bash'`);
      return { success: true };
    }
  } catch (error) {
    logger.error('Main', 'Failed to open terminal with command', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file', async (_, options) => {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath: options.defaultName,
      filters: [
        { name: 'Shell Scripts', extensions: ['sh'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, options.content);
      return { success: true };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-confirm', async (_, message) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['取消', '确定'],
    defaultId: 0,
    message: message
  });
  
  return result.response === 1;
});

// 还原官方设置IPC处理器
ipcMain.handle('restore-official-settings', async () => {
  try {
    await restoreOfficialSettings();
    return { success: true };
  } catch (error) {
    logger.error('Main', 'Failed to restore official settings', { error: error.message });
    return { success: false, error: error.message };
  }
});

// 还原 Claude Code 官方设置
async function restoreOfficialSettings() {
  try {
    logger.info('Main', 'Starting Claude Code official settings restoration');
    
    const isWindows = process.platform === 'win32';
    const isMacOS = process.platform === 'darwin';
    
    let commands = [];
    let scriptPath;
    
    if (isWindows) {
      // Windows 批处理脚本
      scriptPath = path.join(__dirname, '../../restore-claude-windows.bat');
      const batchContent = `@echo off
echo 🔄 还原 Claude Code 官方设置...
echo.

REM 清除代理相关的环境变量
echo 📝 清除代理环境变量...
setx ANTHROPIC_BASE_URL ""
setx ANTHROPIC_AUTH_TOKEN ""

REM 升级 Claude Code
echo 📦 升级 Claude Code...
npm install -g @anthropic-ai/claude-code@latest

echo.
echo ✅ 还原完成！
echo.
echo 💡 建议操作：
echo 1. 重新打开终端或 IDE
echo 2. 如果有 API Key，请运行: claude login
echo 3. 或设置环境变量: set ANTHROPIC_API_KEY=sk-ant-your-key
echo.
pause`;
      
      fs.writeFileSync(scriptPath, batchContent);
      exec(`start cmd /k "${scriptPath}"`);
      
    } else {
      // macOS/Linux shell 脚本
      scriptPath = path.join(__dirname, '../../restore-claude.sh');
      const shellContent = `#!/bin/bash

echo "🔄 还原 Claude Code 官方设置..."
echo ""

# 检测 shell 类型
if [[ $SHELL == */zsh ]]; then
    SHELL_RC="$HOME/.zshrc"
elif [[ $SHELL == */bash ]]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.profile"
fi

echo "📝 清除代理环境变量..."

# 从当前环境中清除
unset ANTHROPIC_BASE_URL
unset ANTHROPIC_AUTH_TOKEN

# 从 shell 配置文件中移除（如果存在）
if [ -f "$SHELL_RC" ]; then
    # 创建备份
    cp "$SHELL_RC" "$SHELL_RC.backup.$(date +%Y%m%d_%H%M%S)"
    
    # 移除代理相关的环境变量
    sed -i.tmp '/export ANTHROPIC_BASE_URL/d' "$SHELL_RC"
    sed -i.tmp '/export ANTHROPIC_AUTH_TOKEN/d' "$SHELL_RC"
    rm -f "$SHELL_RC.tmp"
    
    echo "✅ 已从 $SHELL_RC 中移除代理设置"
fi

echo ""
echo "📦 升级 Claude Code..."
npm install -g @anthropic-ai/claude-code@latest

echo ""
echo "✅ 还原完成！"
echo ""
echo "💡 建议操作："
echo "1. 重新打开终端或 IDE (Cursor/VSCode)"
echo "2. 验证环境变量: env | grep -i anthropic"
echo "3. 如果有官方 API Key，请运行:"
echo "   claude login"
echo "4. 或者设置环境变量:"
echo "   export ANTHROPIC_API_KEY='sk-ant-your-complete-key'"
echo ""
echo "🔍 测试 Claude CLI:"
echo "   claude 'Hello, Claude!'"
echo ""

# 重新加载 shell 配置
echo "🔄 重新加载 shell 配置..."
source "$SHELL_RC" 2>/dev/null || true

echo "按任意键继续..."
read -n 1`;
      
      fs.writeFileSync(scriptPath, shellContent);
      fs.chmodSync(scriptPath, '755');
      
      if (isMacOS) {
        exec(`osascript -e 'tell app "Terminal" to do script "${scriptPath}"'`);
      } else {
        exec(`gnome-terminal -- bash -c '${scriptPath}; exec bash'`);
      }
    }
    
    // 通知用户
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: '还原脚本已启动',
      detail: '还原脚本正在新的终端窗口中运行。请按照提示完成操作。\n\n还原完成后建议：\n1. 重新打开 Cursor/VSCode\n2. 运行 claude login 登录官方账户\n3. 测试 Claude CLI 是否正常工作'
    });
    
    logger.info('Main', 'Claude Code restoration script launched');
    
  } catch (error) {
    logger.error('Main', 'Failed to restore Claude Code settings', { error: error.message });
    
    dialog.showErrorBox('还原失败', `无法启动还原脚本：${error.message}\n\n请手动执行以下步骤：\n1. 清除环境变量 ANTHROPIC_BASE_URL\n2. 清除环境变量 ANTHROPIC_AUTH_TOKEN\n3. 运行 npm install -g @anthropic-ai/claude-code@latest\n4. 重新打开终端`);
  }
}

// 安全性：阻止新窗口创建
app.on('web-contents-created', (_, contents) => {
  contents.on('new-window', (event) => {
    event.preventDefault();
  });
});

// 设置应用菜单
const template = [];

if (process.platform === 'darwin') {
  // macOS 菜单结构
  template.push({
    label: app.getName(),
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      {
        label: '还原 Claude Code 官方设置',
        accelerator: 'CmdOrCtrl+R',
        click: async () => {
          const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['取消', '确定还原'],
            defaultId: 0,
            message: '还原 Claude Code 官方设置',
            detail: '这将清除所有代理相关的环境变量，并升级 Claude Code 到最新版本。\n\n操作包括：\n• 清除 ANTHROPIC_BASE_URL\n• 清除 ANTHROPIC_AUTH_TOKEN\n• 保留或设置正确的 ANTHROPIC_API_KEY\n• 升级 Claude Code\n• 重启终端环境\n\n确定要继续吗？'
          });
          
          if (result.response === 1) {
            await restoreOfficialSettings();
          }
        }
      },
      { type: 'separator' },
      { role: 'quit' }
    ]
  });
}

// 工具菜单（所有平台）
template.push({
  label: '工具',
  submenu: [
    {
      label: '还原 Claude Code 官方设置',
      accelerator: 'CmdOrCtrl+R',
      click: async () => {
        const result = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['取消', '确定还原'],
          defaultId: 0,
          message: '还原 Claude Code 官方设置',
          detail: '这将清除所有代理相关的环境变量，并升级 Claude Code 到最新版本。\n\n操作包括：\n• 清除 ANTHROPIC_BASE_URL\n• 清除 ANTHROPIC_AUTH_TOKEN\n• 保留或设置正确的 ANTHROPIC_API_KEY\n• 升级 Claude Code\n• 重启终端环境\n\n确定要继续吗？'
        });
        
        if (result.response === 1) {
          await restoreOfficialSettings();
        }
      }
    }
  ]
});

// 帮助菜单
template.push({
  label: '帮助',
  submenu: [
    {
      label: '关于 Claude Code Proxy Pro',
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '关于',
          message: `Claude Code Proxy Pro v${app.getVersion()}`,
          detail: '一个强大的 Claude Code 代理工具，提供模型路由、格式转换和增强功能。'
        });
      }
    }
  ]
});

// 设置菜单（所有平台）
Menu.setApplicationMenu(Menu.buildFromTemplate(template));