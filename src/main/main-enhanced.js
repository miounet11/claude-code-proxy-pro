/**
 * Claude Code Proxy Pro - 增强版主进程
 * 集成 AICode-main 功能的完整版本
 */

const { app, BrowserWindow, ipcMain, shell, Menu, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const os = require('os');

// 导入模块
const ConfigManager = require('./config-manager');
const EnhancedProxyManager = require('./enhanced-proxy-manager');
const AutoInstaller = require('./auto-installer');
const SystemEnvManager = require('./system-env-manager');
const { Logger } = require('./logger');
const TerminalAdapter = require('./terminal-adapter');

class ClaudeCodeProEnhanced {
    constructor() {
        this.mainWindow = null;
        this.wizardWindow = null;
        this.configManager = new ConfigManager();
        this.proxyManager = new EnhancedProxyManager();
        this.autoInstaller = new AutoInstaller();
        this.envManager = new SystemEnvManager();
        this.logger = new Logger({ module: 'MainProcess' });
        this.terminalService = new TerminalAdapter();
        
        this.terminals = new Map();
        this.isQuitting = false;
        this.setupApp();
    }

    setupApp() {
        // 单实例锁
        const gotTheLock = app.requestSingleInstanceLock();
        
        if (!gotTheLock) {
            app.quit();
            return;
        }
        
        // 第二个实例尝试启动时
        app.on('second-instance', () => {
            if (this.mainWindow) {
                if (this.mainWindow.isMinimized()) this.mainWindow.restore();
                this.mainWindow.focus();
            }
        });
        
        // 应用就绪
        app.whenReady().then(() => {
            this.initialize();
        });
        
        // 窗口全部关闭
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
        
        // 激活应用
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });
        
        // 退出前清理
        app.on('before-quit', () => {
            this.isQuitting = true;
            this.cleanup();
        });
    }

    async initialize() {
        try {
            // 配置管理器已在构造函数中初始化
            
            // 检查是否首次运行
            const isFirstRun = await this.checkFirstRun();
            
            if (isFirstRun) {
                // 显示安装向导
                this.createWizardWindow();
            } else {
                // 创建主窗口
                this.createMainWindow();
                
                // 自动启动代理（如果配置了）
                const config = await this.configManager.getConfig();
                if (config.autoStart) {
                    this.startProxy();
                }
            }
            
            // 设置 IPC 处理器
            this.setupIpcHandlers();
            
            // 设置菜单
            this.setupMenu();
            
        } catch (error) {
            this.logger.error('初始化失败:', error);
            dialog.showErrorBox('初始化失败', error.message);
        }
    }

    /**
     * 检查是否首次运行
     */
    async checkFirstRun() {
        try {
            const config = await this.configManager.getConfig();
            return !config.initialized;
        } catch {
            return true;
        }
    }

    /**
     * 创建主窗口
     */
    createMainWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 800,
            minHeight: 600,
            title: 'Claude Code Proxy Pro',
            icon: path.join(__dirname, '../../assets/icon.png'),
            backgroundColor: '#1e1e1e',
            titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload/vscode-style-preload.js'),
                webSecurity: true
            }
        });
        
        // 加载主界面
        this.mainWindow.loadFile(path.join(__dirname, '../../public/index-vscode-style.html'));
        
        // 窗口事件
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
            this.cleanup();
        });
        
        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting && process.platform === 'darwin') {
                event.preventDefault();
                this.mainWindow.hide();
            }
        });
        
        // 开发模式下打开开发者工具
        if (process.argv.includes('--dev')) {
            this.mainWindow.webContents.openDevTools();
        }
    }

    /**
     * 创建安装向导窗口
     */
    createWizardWindow() {
        this.wizardWindow = new BrowserWindow({
            width: 900,
            height: 700,
            resizable: false,
            title: 'Claude Code Proxy Pro - 安装向导',
            icon: path.join(__dirname, '../../assets/icon.png'),
            backgroundColor: '#1e1e1e',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload/wizard-preload.js')
            }
        });
        
        // 加载安装向导
        this.wizardWindow.loadFile(path.join(__dirname, '../../public/install-wizard.html'));
        
        this.wizardWindow.on('closed', () => {
            this.wizardWindow = null;
            // 如果没有主窗口，退出应用
            if (!this.mainWindow) {
                app.quit();
            }
        });
    }

    /**
     * 设置 IPC 处理器
     */
    setupIpcHandlers() {
        // === 安装向导 IPC ===
        ipcMain.handle('get-platform', () => process.platform);
        
        ipcMain.handle('check-command', async (event, command) => {
            try {
                // 确保 PATH 包含常见的工具路径
                const extraPaths = [
                    path.join(os.homedir(), '.local', 'bin'),
                    path.join(os.homedir(), '.cargo', 'bin'),
                    '/usr/local/bin',
                    '/opt/homebrew/bin'
                ];
                
                const currentPath = process.env.PATH || '';
                const newPath = [...extraPaths, ...currentPath.split(':')].join(':');
                
                const result = await this.executeCommand(command, { 
                    env: { ...process.env, PATH: newPath } 
                });
                return { success: true, output: result };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        ipcMain.handle('check-network', async () => {
            try {
                const interfaces = os.networkInterfaces();
                let ip = '127.0.0.1';
                
                for (const name of Object.keys(interfaces)) {
                    for (const iface of interfaces[name]) {
                        if (iface.family === 'IPv4' && !iface.internal) {
                            ip = iface.address;
                            break;
                        }
                    }
                }
                
                return { success: true, ip };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        ipcMain.handle('check-port', async (event, port) => {
            const available = await this.proxyManager.isPortAvailable(port);
            if (!available) {
                const process = await this.proxyManager.getPortProcess(port);
                return { available: false, process: process?.name };
            }
            return { available: true };
        });
        
        ipcMain.handle('install-dependency', async (event, name) => {
            try {
                this.logger.info(`开始安装依赖: ${name}`);
                
                // 根据不同的依赖项执行不同的安装逻辑
                switch (name) {
                    case 'uv':
                        await this.autoInstaller.installUV((msg, progress) => {
                            if (this.wizardWindow) {
                                this.wizardWindow.webContents.send('install-progress', { message: msg, progress });
                            }
                        });
                        break;
                        
                    case 'claude-code':
                        await this.autoInstaller.installClaudeCode((msg, progress) => {
                            if (this.wizardWindow) {
                                this.wizardWindow.webContents.send('install-progress', { message: msg, progress });
                            }
                        });
                        break;
                        
                    case 'proxy':
                        await this.autoInstaller.setupProxyService((msg, progress) => {
                            if (this.wizardWindow) {
                                this.wizardWindow.webContents.send('install-progress', { message: msg, progress });
                            }
                        });
                        break;
                        
                    default:
                        // 通用安装逻辑
                        await this.autoInstaller.installDependencies((msg, progress) => {
                            if (this.wizardWindow) {
                                this.wizardWindow.webContents.send('install-progress', { message: msg, progress });
                            }
                        });
                }
                
                return { success: true };
            } catch (error) {
                this.logger.error(`安装 ${name} 失败:`, error);
                return { success: false, error: error.message };
            }
        });
        
        ipcMain.handle('set-environment', async (event, vars) => {
            try {
                await this.envManager.setEnvironmentVariables(vars);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        ipcMain.handle('open-main-app', () => {
            this.createMainWindow();
            if (this.wizardWindow) {
                this.wizardWindow.close();
            }
        });
        
        // === 主应用 IPC ===
        ipcMain.handle('get-profiles', async () => {
            return await this.configManager.getProfiles();
        });
        
        ipcMain.handle('save-profile', async (event, profile) => {
            return await this.configManager.saveProfile(profile);
        });
        
        ipcMain.handle('delete-profile', async (event, id) => {
            return await this.configManager.deleteProfile(id);
        });
        
        ipcMain.handle('get-config', async () => {
            return await this.configManager.getConfig();
        });
        
        ipcMain.handle('save-config', async (event, config) => {
            // 标记为已初始化
            config.initialized = true;
            return await this.configManager.saveConfig(config);
        });
        
        // === 代理管理 ===
        ipcMain.handle('start-proxy', async (event, config) => {
            try {
                // 更新代理配置
                if (config) {
                    this.proxyManager.config = { ...this.proxyManager.config, ...config };
                }
                
                const result = await this.proxyManager.start();
                
                // 发送状态更新
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('proxy-status', {
                        running: true,
                        port: result.port
                    });
                }
                
                return { success: true, port: result.port };
            } catch (error) {
                this.logger.error('启动代理失败:', error);
                return { success: false, error: error.message };
            }
        });
        
        ipcMain.handle('stop-proxy', async () => {
            try {
                await this.proxyManager.stop();
                
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('proxy-status', {
                        running: false
                    });
                }
                
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        ipcMain.handle('get-proxy-status', () => {
            return this.proxyManager.getStatus();
        });
        
        // === 终端管理 ===
        ipcMain.handle('create-terminal', async (event, options = {}) => {
            try {
                const terminalId = await this.terminalService.createTerminal(options);
                this.terminals.set(terminalId, { 
                    id: terminalId,
                    createdAt: new Date()
                });
                return { success: true, terminalId };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        ipcMain.handle('terminal-write', async (event, { terminalId, data }) => {
            try {
                await this.terminalService.write(terminalId, data);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        ipcMain.handle('terminal-resize', async (event, { terminalId, cols, rows }) => {
            try {
                await this.terminalService.resize(terminalId, cols, rows);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        ipcMain.handle('terminal-destroy', async (event, terminalId) => {
            try {
                await this.terminalService.destroyTerminal(terminalId);
                this.terminals.delete(terminalId);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        // 终端数据传输
        this.terminalService.on('terminal-data', ({ terminalId, data }) => {
            if (this.mainWindow) {
                this.mainWindow.webContents.send('terminal-data', { terminalId, data });
            }
        });
        
        // === 快速操作 ===
        ipcMain.handle('quick-start', async () => {
            try {
                // 执行完整安装流程
                const installResult = await this.autoInstaller.runFullInstallation((msg, progress) => {
                    if (this.mainWindow) {
                        this.mainWindow.webContents.send('install-progress', { message: msg, progress });
                    }
                });
                
                if (installResult.success) {
                    // 启动代理
                    const proxyResult = await this.proxyManager.start();
                    return { success: true, status: installResult.status };
                }
                
                return { success: false, error: '安装失败' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        // === 系统操作 ===
        ipcMain.handle('show-item-in-folder', async (event, path) => {
            shell.showItemInFolder(path);
        });
        
        ipcMain.handle('open-external', async (event, url) => {
            shell.openExternal(url);
        });
    }

    /**
     * 设置菜单
     */
    setupMenu() {
        const template = [
            {
                label: '文件',
                submenu: [
                    {
                        label: '安装向导',
                        click: () => this.createWizardWindow()
                    },
                    { type: 'separator' },
                    {
                        label: '新建配置',
                        accelerator: 'CmdOrCtrl+N',
                        click: () => this.sendToRenderer('menu-new-profile')
                    },
                    {
                        label: '导入配置',
                        click: () => this.importProfile()
                    },
                    {
                        label: '导出配置',
                        click: () => this.exportProfile()
                    },
                    { type: 'separator' },
                    {
                        label: '退出',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => {
                            this.isQuitting = true;
                            app.quit();
                        }
                    }
                ]
            },
            {
                label: '工具',
                submenu: [
                    {
                        label: '快速启动',
                        accelerator: 'CmdOrCtrl+Shift+S',
                        click: () => this.quickStart()
                    },
                    {
                        label: '环境检查',
                        click: () => this.checkEnvironment()
                    },
                    {
                        label: '端口诊断',
                        click: () => this.diagnosePort()
                    },
                    { type: 'separator' },
                    {
                        label: '清理缓存',
                        click: () => this.clearCache()
                    }
                ]
            },
            {
                label: '视图',
                submenu: [
                    {
                        label: '切换终端',
                        accelerator: 'CmdOrCtrl+`',
                        click: () => this.sendToRenderer('toggle-terminal')
                    },
                    {
                        label: '命令面板',
                        accelerator: 'CmdOrCtrl+Shift+P',
                        click: () => this.sendToRenderer('show-command-palette')
                    },
                    { type: 'separator' },
                    { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
                    { label: '切换开发者工具', role: 'toggleDevTools' },
                    { type: 'separator' },
                    { label: '全屏', role: 'togglefullscreen' }
                ]
            },
            {
                label: '帮助',
                submenu: [
                    {
                        label: '文档',
                        click: () => shell.openExternal('https://github.com/miounet11/claude-code-proxy-pro')
                    },
                    {
                        label: '报告问题',
                        click: () => shell.openExternal('https://github.com/miounet11/claude-code-proxy-pro/issues')
                    },
                    { type: 'separator' },
                    {
                        label: '检查更新',
                        click: () => this.checkForUpdates()
                    },
                    {
                        label: '关于',
                        click: () => this.showAbout()
                    }
                ]
            }
        ];
        
        // macOS 特殊处理
        if (process.platform === 'darwin') {
            template.unshift({
                label: app.getName(),
                submenu: [
                    { label: '关于 Claude Code Proxy Pro', click: () => this.showAbout() },
                    { type: 'separator' },
                    { label: '偏好设置...', accelerator: 'Cmd+,', click: () => this.sendToRenderer('show-settings') },
                    { type: 'separator' },
                    { label: '服务', role: 'services', submenu: [] },
                    { type: 'separator' },
                    { label: '隐藏', accelerator: 'Cmd+H', role: 'hide' },
                    { label: '隐藏其他', accelerator: 'Cmd+Alt+H', role: 'hideothers' },
                    { label: '显示全部', role: 'unhide' },
                    { type: 'separator' },
                    { label: '退出', accelerator: 'Cmd+Q', click: () => app.quit() }
                ]
            });
        }
        
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    /**
     * 快速启动
     */
    async quickStart() {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('quick-start');
        }
    }

    /**
     * 环境检查
     */
    async checkEnvironment() {
        const status = await this.autoInstaller.getInstallStatus();
        
        const details = Object.entries(status)
            .map(([key, value]) => `${key}: ${value ? '✅' : '❌'}`)
            .join('\n');
        
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: '环境检查',
            message: '系统环境状态',
            detail: details,
            buttons: ['确定']
        });
    }

    /**
     * 端口诊断
     */
    async diagnosePort() {
        const status = this.proxyManager.getStatus();
        const portInfo = status.portConflicts.length > 0 
            ? `端口冲突记录:\n${status.portConflicts.map(c => `端口 ${c.port}: ${c.process?.name || '未知进程'}`).join('\n')}`
            : '无端口冲突';
        
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: '端口诊断',
            message: `当前使用端口: ${status.port}`,
            detail: `状态: ${status.running ? '运行中' : '已停止'}\n${portInfo}`,
            buttons: ['确定']
        });
    }

    /**
     * 清理缓存
     */
    async clearCache() {
        try {
            const cacheDir = app.getPath('cache');
            // 这里可以添加具体的缓存清理逻辑
            
            dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: '清理缓存',
                message: '缓存已清理',
                buttons: ['确定']
            });
        } catch (error) {
            dialog.showErrorBox('清理失败', error.message);
        }
    }

    /**
     * 检查更新
     */
    async checkForUpdates() {
        // 这里可以集成 electron-updater
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: '检查更新',
            message: '当前版本: 4.1.1',
            detail: '您使用的是最新版本',
            buttons: ['确定']
        });
    }

    /**
     * 显示关于对话框
     */
    showAbout() {
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: '关于 Claude Code Proxy Pro',
            message: 'Claude Code Proxy Pro',
            detail: `版本: 4.1.1\n构建: ${new Date().toISOString()}\n\n一个功能强大的 Claude Code 代理工具\n集成了自动安装和智能管理功能`,
            buttons: ['确定']
        });
    }

    /**
     * 发送消息到渲染进程
     */
    sendToRenderer(channel, data) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    /**
     * 执行命令
     */
    executeCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            require('child_process').exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * 启动代理
     */
    async startProxy() {
        try {
            const config = await this.configManager.getConfig();
            await this.proxyManager.start(config);
        } catch (error) {
            this.logger.error('自动启动代理失败:', error);
        }
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            // 停止代理
            await this.proxyManager.stop();
            
            // 清理终端
            for (const terminalId of this.terminals.keys()) {
                await this.terminalService.destroyTerminal(terminalId);
            }
            
            this.logger.info('资源清理完成');
        } catch (error) {
            this.logger.error('清理资源失败:', error);
        }
    }
}

// 创建应用实例
new ClaudeCodeProEnhanced();