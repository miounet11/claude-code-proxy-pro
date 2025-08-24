// Claude Code Proxy Pro - VSCode Style Main Process
// 完整的生产就绪主进程，支持所有集成功能

const { app, BrowserWindow, ipcMain, shell, Menu, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const os = require('os');

// 导入现有模块
const ConfigManager = require('./config-manager');
const ProxyManager = require('./proxy-manager');
const SystemEnvManager = require('./system-env-manager');
const { Logger } = require('./logger');

class ClaudeCodeProApp {
    constructor() {
        this.mainWindow = null;
        this.configManager = new ConfigManager();
        this.proxyManager = new ProxyManager();
        this.logger = new Logger();
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
        
        // 第二个实例启动时
        app.on('second-instance', () => {
            if (this.mainWindow) {
                if (this.mainWindow.isMinimized()) this.mainWindow.restore();
                this.mainWindow.focus();
            }
        });
        
        // 应用事件
        app.whenReady().then(() => this.createWindow());
        app.on('window-all-closed', () => this.handleAllWindowsClosed());
        app.on('activate', () => this.handleActivate());
        app.on('before-quit', () => { this.isQuitting = true; });
        
        // 设置 IPC 处理器
        this.setupIpcHandlers();
    }

    async createWindow() {
        // 创建浏览器窗口
        this.mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload/vscode-style-preload.js')
            },
            icon: path.join(__dirname, '../../../assets/icon.png'),
            titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
            frame: process.platform !== 'darwin',
            backgroundColor: '#1e1e1e'
        });

        // 加载应用
        this.mainWindow.loadFile(path.join(__dirname, '../../public/index-vscode-style.html'));

        // 设置菜单
        this.setupMenu();

        // 窗口事件
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting && process.platform === 'darwin') {
                event.preventDefault();
                this.mainWindow.hide();
            }
        });

        // 初始化系统环境
        await this.initializeEnvironment();
        
        // 开发环境下打开开发者工具
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.webContents.openDevTools();
        }
    }

    setupMenu() {
        const template = [
            {
                label: '文件',
                submenu: [
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
                label: '编辑',
                submenu: [
                    { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                    { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                    { type: 'separator' },
                    { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                    { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                    { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' }
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
                    { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
                    { label: '切换开发者工具', role: 'toggleDevTools' },
                    { type: 'separator' },
                    { label: '实际大小', role: 'resetZoom' },
                    { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
                    { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                    { type: 'separator' },
                    { label: '全屏', role: 'togglefullscreen' }
                ]
            },
            {
                label: '终端',
                submenu: [
                    {
                        label: '新建终端',
                        accelerator: 'CmdOrCtrl+Shift+`',
                        click: () => this.sendToRenderer('new-terminal')
                    },
                    {
                        label: '清空终端',
                        accelerator: 'CmdOrCtrl+K',
                        click: () => this.sendToRenderer('clear-terminal')
                    }
                ]
            },
            {
                label: '帮助',
                submenu: [
                    {
                        label: '文档',
                        click: () => shell.openExternal('https://github.com/your-repo/docs')
                    },
                    {
                        label: '报告问题',
                        click: () => shell.openExternal('https://github.com/your-repo/issues')
                    },
                    { type: 'separator' },
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
                    { label: '关于 ' + app.getName(), click: () => this.showAbout() },
                    { type: 'separator' },
                    { label: '偏好设置...', accelerator: 'Cmd+,', click: () => this.sendToRenderer('show-preferences') },
                    { type: 'separator' },
                    { label: '服务', role: 'services', submenu: [] },
                    { type: 'separator' },
                    { label: '隐藏 ' + app.getName(), accelerator: 'Cmd+H', role: 'hide' },
                    { label: '隐藏其他', accelerator: 'Cmd+Shift+H', role: 'hideothers' },
                    { label: '显示全部', role: 'unhide' },
                    { type: 'separator' },
                    { label: '退出', accelerator: 'Cmd+Q', click: () => { this.isQuitting = true; app.quit(); } }
                ]
            });
        }

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    setupIpcHandlers() {
        // 配置管理
        ipcMain.handle('get-profiles', async () => {
            return await this.configManager.getProfiles();
        });

        ipcMain.handle('save-profile', async (event, profile) => {
            return await this.configManager.saveProfile(profile);
        });

        ipcMain.handle('delete-profile', async (event, id) => {
            return await this.configManager.deleteProfile(id);
        });

        // 代理管理
        ipcMain.handle('start-proxy', async (event, config) => {
            try {
                await this.proxyManager.start(config);
                this.sendToRenderer('proxy-status-update', { running: true });
                return { success: true };
            } catch (error) {
                this.logger.error('Failed to start proxy:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('stop-proxy', async () => {
            try {
                await this.proxyManager.stop();
                this.sendToRenderer('proxy-status-update', { running: false });
                return { success: true };
            } catch (error) {
                this.logger.error('Failed to stop proxy:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('get-proxy-status', async () => {
            return { running: this.proxyManager.isRunning() };
        });

        ipcMain.handle('test-connection', async (event, config) => {
            try {
                const result = await this.proxyManager.testConnection(config);
                return { success: result, error: result ? null : 'Connection failed' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // 环境检查
        ipcMain.handle('check-command', async (event, command) => {
            return await this.checkCommand(command);
        });

        ipcMain.handle('check-environment', async () => {
            return await this.checkEnvironment();
        });

        ipcMain.handle('install-claude-cli', async () => {
            return await this.installClaudeCLI();
        });

        // 终端管理
        ipcMain.handle('create-terminal', async (event, id, options = {}) => {
            return await this.createTerminal(id, options);
        });

        ipcMain.handle('close-terminal', async (event, id) => {
            return await this.closeTerminal(id);
        });

        ipcMain.on('terminal-input', (event, { id, data }) => {
            const terminal = this.terminals.get(id);
            if (terminal && terminal.process) {
                terminal.process.write(data);
            }
        });

        ipcMain.on('terminal-resize', (event, { id, cols, rows }) => {
            const terminal = this.terminals.get(id);
            if (terminal && terminal.process) {
                terminal.process.resize(cols, rows);
            }
        });

        ipcMain.handle('run-command', async (event, id, command) => {
            const terminal = this.terminals.get(id);
            if (terminal && terminal.process) {
                terminal.process.write(command + '\n');
                return { success: true };
            }
            return { success: false, error: 'Terminal not found' };
        });

        // 文件操作
        ipcMain.handle('open-file', async (event, filePath) => {
            try {
                await shell.openPath(filePath);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('save-file', async (event, filePath, content) => {
            try {
                await fs.writeFile(filePath, content, 'utf8');
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // 系统操作
        ipcMain.handle('copy-to-clipboard', (event, text) => {
            clipboard.writeText(text);
            return { success: true };
        });

        // 读取/写入剪贴板文本（用于粘贴 API 地址/密钥）
        ipcMain.handle('get-clipboard-text', () => {
            return clipboard.readText();
        });
        ipcMain.handle('set-clipboard-text', (event, text) => {
            clipboard.writeText(text || '');
            return true;
        });

        ipcMain.handle('open-external', async (event, url) => {
            await shell.openExternal(url);
            return { success: true };
        });

        ipcMain.handle('show-item-in-folder', async (event, filePath) => {
            shell.showItemInFolder(filePath);
            return { success: true };
        });

        // 应用信息
        ipcMain.handle('get-app-version', () => {
            return app.getVersion();
        });

        ipcMain.handle('get-platform', () => {
            return process.platform;
        });

        // 窗口控制
        ipcMain.on('minimize-window', () => {
            if (this.mainWindow) this.mainWindow.minimize();
        });

        ipcMain.on('maximize-window', () => {
            if (this.mainWindow) {
                if (this.mainWindow.isMaximized()) {
                    this.mainWindow.unmaximize();
                } else {
                    this.mainWindow.maximize();
                }
            }
        });

        ipcMain.on('close-window', () => {
            if (this.mainWindow) this.mainWindow.close();
        });

        ipcMain.on('toggle-dev-tools', () => {
            if (this.mainWindow) {
                this.mainWindow.webContents.toggleDevTools();
            }
        });

        // 日志
        ipcMain.on('log', (event, { level, message, args }) => {
            this.logger[level](message, ...args);
        });

        // 错误处理
        ipcMain.on('renderer-error', (event, error) => {
            this.logger.error('Renderer error:', error);
        });

        // 性能数据
        ipcMain.on('performance-data', (event, data) => {
            this.logger.info('Performance data:', data);
        });
    }

    async initializeEnvironment() {
        try {
            // 设置系统环境
            await setupSystemEnvironment();
            
            // 检查环境
            const envStatus = await this.checkEnvironment();
            this.sendToRenderer('environment-update', envStatus);
            
            // 通知渲染进程应用已就绪
            this.sendToRenderer('app-ready');
        } catch (error) {
            this.logger.error('Failed to initialize environment:', error);
        }
    }

    async checkCommand(command) {
        return new Promise((resolve) => {
            const [cmd, ...args] = command.split(' ');
            const process = spawn(cmd, args, { shell: true });
            
            process.on('error', () => {
                resolve({ success: false });
            });
            
            process.on('exit', (code) => {
                resolve({ success: code === 0 });
            });
        });
    }

    async checkEnvironment() {
        const checks = {
            nodejs: await this.checkCommand('node --version'),
            git: await this.checkCommand('git --version'),
            'claude-cli': await this.checkCommand('claude --version'),
            proxy: { success: this.proxyManager.isRunning() }
        };
        
        const status = {};
        for (const [name, result] of Object.entries(checks)) {
            status[name] = result.success ? 'installed' : 'not-installed';
        }
        
        if (this.proxyManager.isRunning()) {
            status.proxy = 'running';
        } else {
            status.proxy = 'stopped';
        }
        
        return status;
    }

    async installClaudeCLI() {
        return new Promise((resolve, reject) => {
            const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            const install = spawn(npmCommand, ['install', '-g', '@anthropic-ai/claude-cli'], {
                shell: true
            });
            
            install.on('error', (error) => {
                reject(error);
            });
            
            install.on('exit', (code) => {
                if (code === 0) {
                    resolve({ success: true });
                } else {
                    reject(new Error(`Installation failed with code ${code}`));
                }
            });
        });
    }

    async createTerminal(id, options = {}) {
        try {
            const pty = require('node-pty');
            
            const shell = options.shell || (process.platform === 'win32' ? 'powershell.exe' : 
                                           process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
            
            const env = {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
                ...options.env
            };
            
            const ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: options.cols || 80,
                rows: options.rows || 24,
                cwd: options.cwd || os.homedir(),
                env: env
            });
            
            // 监听输出
            ptyProcess.onData((data) => {
                this.sendToRenderer('terminal-data', { terminalId: id, data });
            });
            
            // 监听退出
            ptyProcess.onExit((exitCode) => {
                this.sendToRenderer('terminal-exit', { terminalId: id, exitCode });
                this.terminals.delete(id);
            });
            
            this.terminals.set(id, { process: ptyProcess, id });
            
            return { success: true };
        } catch (error) {
            this.logger.error('Failed to create terminal:', error);
            return { success: false, error: error.message };
        }
    }

    async closeTerminal(id) {
        const terminal = this.terminals.get(id);
        if (terminal && terminal.process) {
            terminal.process.kill();
            this.terminals.delete(id);
            return { success: true };
        }
        return { success: false, error: 'Terminal not found' };
    }

    sendToRenderer(channel, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    async importProfile() {
        const result = await dialog.showOpenDialog(this.mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            try {
                const content = await fs.readFile(result.filePaths[0], 'utf8');
                const profile = JSON.parse(content);
                await this.configManager.saveProfile(profile);
                this.sendToRenderer('profile-imported', profile);
            } catch (error) {
                this.logger.error('Failed to import profile:', error);
                dialog.showErrorBox('导入失败', '无法导入配置文件：' + error.message);
            }
        }
    }

    async exportProfile() {
        const profiles = await this.configManager.getProfiles();
        if (profiles.length === 0) {
            dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                message: '没有可导出的配置文件'
            });
            return;
        }
        
        const result = await dialog.showSaveDialog(this.mainWindow, {
            defaultPath: 'claude-code-profiles.json',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled) {
            try {
                await fs.writeFile(result.filePath, JSON.stringify(profiles, null, 2));
                dialog.showMessageBox(this.mainWindow, {
                    type: 'info',
                    message: '配置文件导出成功'
                });
            } catch (error) {
                this.logger.error('Failed to export profiles:', error);
                dialog.showErrorBox('导出失败', '无法导出配置文件：' + error.message);
            }
        }
    }

    showAbout() {
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: '关于 Claude Code Proxy Pro',
            message: 'Claude Code Proxy Pro',
            detail: `版本: ${app.getVersion()}\n` +
                   `Electron: ${process.versions.electron}\n` +
                   `Node.js: ${process.versions.node}\n` +
                   `Chrome: ${process.versions.chrome}\n\n` +
                   'VSCode 风格的 Claude API 代理管理工具',
            buttons: ['确定']
        });
    }

    handleAllWindowsClosed() {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    }

    handleActivate() {
        if (this.mainWindow === null) {
            this.createWindow();
        } else {
            this.mainWindow.show();
        }
    }
}

// 创建应用实例
const claudeApp = new ClaudeCodeProApp();

// 导出应用实例（用于测试）
module.exports = claudeApp;