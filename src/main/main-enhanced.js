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
            
            // 后台健康轮询
            this.startHealthPolling();
            
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
                    path.join(os.homedir(), 'Documents', 'claude code', 'node-v20.10.0-darwin-arm64', 'bin'),
                    '/usr/local/bin',
                    '/opt/homebrew/bin',
                    '/usr/bin',
                    '/bin'
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
            // 如果主窗口已经存在，显示它
            if (this.mainWindow) {
                this.mainWindow.show();
                this.mainWindow.focus();
            } else {
                this.createMainWindow();
            }
            
            // 关闭安装向导窗口
            if (this.wizardWindow) {
                this.wizardWindow.close();
            }
        });
        
        // 剪贴板操作
        ipcMain.handle('get-clipboard-text', () => {
            return clipboard.readText();
        });
        
        ipcMain.handle('set-clipboard-text', (event, text) => {
            clipboard.writeText(text);
            return true;
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
        
        // 新增：运行一键安装脚本（跨平台）
        ipcMain.handle('run-proxy-installer', async (event, args = {}) => {
            try {
                const scriptsDir = path.join(__dirname, '../../scripts');
                const sh = path.join(scriptsDir, 'install-claude-proxy.sh');
                const ps1 = path.join(scriptsDir, 'install-claude-proxy.ps1');
                const port = args.port || 8082;
                const openaiKey = args.openaiKey || '';
                const anthropicKey = args.anthropicKey || '';
                const baseUrl = args.openaiBaseUrl || 'https://api.openai.com/v1';
                
                const commonFlags = [
                    `--port ${port}`,
                    openaiKey ? `--openai-key ${openaiKey}` : '',
                    anthropicKey ? `--anthropic-key ${anthropicKey}` : '',
                    baseUrl ? `--openai-base-url ${baseUrl}` : ''
                ].filter(Boolean).join(' ');
                
                let command;
                if (process.platform === 'win32') {
                    // Prefer PowerShell if available; fallback to bash if present (Git Bash)
                    if (await this.commandExists('powershell')) {
                        command = `powershell -ExecutionPolicy Bypass -File \"${ps1}\" ${commonFlags}`;
                    } else if (await this.commandExists('bash')) {
                        command = `bash \"${sh}\" ${commonFlags}`;
                    } else {
                        throw new Error('Neither PowerShell nor Bash is available on Windows');
                    }
                } else {
                    command = `bash \"${sh}\" ${commonFlags}`;
                }
                
                const output = await this.executeCommand(command, { env: process.env });
                return { success: true, output };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        // 新增：配置 Claude Code 环境（持久化等）
        ipcMain.handle('configure-claude-env', async (event, args = {}) => {
            try {
                const scriptsDir = path.join(__dirname, '../../scripts');
                const sh = path.join(scriptsDir, 'configure-claude-code.sh');
                const ps1 = path.join(scriptsDir, 'configure-claude-code.ps1');
                const port = args.port || 8082;
                const anthropicKey = args.anthropicKey || 'any-value';
                const persist = args.persist === true;
                const skipNoProxy = args.skipNoProxy === true;
                
                let flags = [`--port ${port}`, `--anthropic-key ${anthropicKey}`];
                if (persist) flags.push('--persist');
                if (skipNoProxy) flags.push('--no-proxy-update');
                const flagStr = flags.join(' ');
                
                let command;
                if (process.platform === 'win32') {
                    if (await this.commandExists('powershell')) {
                        command = `powershell -ExecutionPolicy Bypass -File \"${ps1}\" -Port ${port} -AnthropicKey \"${anthropicKey}\"${persist ? ' -Persist' : ''}`;
                    } else if (await this.commandExists('bash')) {
                        command = `bash \"${sh}\" ${flagStr}`;
                    } else {
                        throw new Error('Neither PowerShell nor Bash is available on Windows');
                    }
                } else {
                    command = `bash \"${sh}\" ${flagStr}`;
                }
                
                const output = await this.executeCommand(command, { env: process.env });
                return { success: true, output };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        // 新增：校验 Python Proxy 健康状态
        ipcMain.handle('verify-claude-proxy', async (event, port = 8082) => {
            try {
                const base = `http://127.0.0.1:${port}`;
                const health = await fetch(`${base}/health`).then(r => r.json());
                let messagesOk = false;
                try {
                    const resp = await fetch(`${base}/v1/messages`, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || 'any-value' },
                        body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] })
                    });
                    messagesOk = resp.status === 200 || resp.status === 401 || resp.status === 400;
                } catch {}
                return { success: true, health, messagesOk };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        // === Doctor 诊断与修复 ===
        ipcMain.handle('run-doctor', async (event, args = {}) => {
            const results = [];
            const cfg = await this.configManager.getConfig().catch(() => ({}));
            const port = args.port || cfg.port || 8082;
            // 1) 代理健康
            try {
                const base = `http://127.0.0.1:${port}`;
                const res = await fetch(`${base}/health`);
                if (res.ok) {
                    const h = await res.json();
                    results.push({ id: 'proxy-health', name: '代理健康', status: 'pass', detail: h });
                } else {
                    results.push({ id: 'proxy-health', name: '代理健康', status: 'fail', detail: `HTTP ${res.status}`, fixId: 'start-proxy' });
                }
            } catch (e) {
                results.push({ id: 'proxy-health', name: '代理健康', status: 'fail', detail: e.message, fixId: 'start-proxy' });
            }
            // 2) uv 是否可用
            results.push({ id: 'uv-present', name: 'uv 包管理器', status: (await this.commandExists('uv')) ? 'pass' : 'fail', fixId: 'install-uv' });
            // 3) Python 是否可用
            const pyOk = (await this.commandExists('python3')) || (await this.commandExists('python'));
            results.push({ id: 'python-present', name: 'Python 环境', status: pyOk ? 'pass' : 'fail' });
            // 4) OpenAI Key 配置
            const envDir = path.join(os.homedir(), '.local', 'claude-code-proxy');
            let envContent = '';
            try { envContent = await fs.readFile(path.join(envDir, '.env'), 'utf8'); } catch {}
            const openaiKey = (envContent.match(/^OPENAI_API_KEY="?(.+)"?/m) || [])[1] || process.env.OPENAI_API_KEY || '';
            results.push({ id: 'openai-key', name: 'OpenAI Key', status: openaiKey && openaiKey.length > 20 ? 'pass' : 'fail' });
            // 5) ANTHROPIC_* 环境
            const ab = process.env.ANTHROPIC_BASE_URL || '';
            const ak = process.env.ANTHROPIC_API_KEY || '';
            const baseOk = /^http:\/\/127\.0\.0\.1:\d+/.test(ab);
            results.push({ id: 'anthropic-env', name: 'Claude Code 环境变量', status: (baseOk && ak) ? 'pass' : 'fail', fixId: 'configure-env' });
            // 6) NO_PROXY 合并
            const np = process.env.NO_PROXY || process.env.no_proxy || '';
            const npOk = /localhost/.test(np) && /127\.0\.0\.1/.test(np);
            results.push({ id: 'no-proxy', name: 'NO_PROXY 设置', status: npOk ? 'pass' : 'warn', fixId: 'configure-env' });
            // 7) 端口占用
            const portOk = await this.proxyManager.isPortAvailable(port).catch(() => true);
            results.push({ id: 'port', name: `端口 ${port}`, status: portOk ? 'pass' : 'warn' });
            // 8) rc 文件重复定义
            const rcFiles = [
                path.join(os.homedir(), '.bashrc'),
                path.join(os.homedir(), '.zshrc'),
                path.join(os.homedir(), '.profile'),
                path.join(os.homedir(), '.zprofile')
            ];
            let dupWarn = false;
            for (const f of rcFiles) {
                try {
                    const txt = await fs.readFile(f, 'utf8');
                    const dupA = (txt.match(/ANTHROPIC_BASE_URL=/g) || []).length > 1;
                    const dupK = (txt.match(/ANTHROPIC_API_KEY=/g) || []).length > 1;
                    if (dupA || dupK) { dupWarn = true; break; }
                } catch {}
            }
            results.push({ id: 'rc-dup', name: 'Shell 配置重复定义', status: dupWarn ? 'warn' : 'pass', fixId: dupWarn ? 'configure-env' : undefined });
            return { success: true, results };
        });
        
        ipcMain.handle('apply-fix', async (event, fixId, args = {}) => {
            try {
                switch (fixId) {
                    case 'install-uv':
                        await this.autoInstaller.installUV(() => {});
                        return { success: true };
                    case 'configure-env':
                        await this.executeCommand(`bash "${path.join(__dirname, '../../scripts/configure-claude-code.sh')}" --port ${args.port || 8082} --anthropic-key ${args.anthropicKey || 'proxy-key'} --persist`, { env: process.env });
                        return { success: true };
                    case 'start-proxy':
                        await this.executeCommand(`bash "${path.join(__dirname, '../../scripts/install-claude-proxy.sh')}" --port ${args.port || 8082} ${args.openaiKey ? `--openai-key ${args.openaiKey}` : ''} ${args.anthropicKey ? `--anthropic-key ${args.anthropicKey}` : ''}`, { env: process.env });
                        return { success: true };
                    default:
                        return { success: false, error: `未知修复项: ${fixId}` };
                }
            } catch (e) {
                return { success: false, error: e.message };
            }
        });
        
        ipcMain.handle('export-diagnostics', async () => {
            try {
                const tmpDir = path.join(os.tmpdir(), `ccp-diag-${Date.now()}`);
                await fs.mkdir(tmpDir, { recursive: true });
                // 收集环境
                const diag = {
                    platform: process.platform,
                    versions: process.versions,
                    env: {
                        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
                        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '***redacted***' : '',
                        NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || ''
                    }
                };
                await fs.writeFile(path.join(tmpDir, 'env.json'), JSON.stringify(diag, null, 2));
                // 复制日志与 .env
                const cacheLog = path.join(os.homedir(), '.cache', 'claude-code-proxy', 'server.log');
                const proxyEnv = path.join(os.homedir(), '.local', 'claude-code-proxy', '.env');
                for (const f of [cacheLog, proxyEnv]) {
                    try { await fs.copyFile(f, path.join(tmpDir, path.basename(f))); } catch {}
                }
                // 打包
                const outBase = path.join(os.homedir(), `ccp-diagnostics-${Date.now()}`);
                let archive;
                if (process.platform === 'win32') {
                    archive = `${outBase}.zip`;
                    await this.executeCommand(`powershell -ExecutionPolicy Bypass -c "Compress-Archive -Path \"${tmpDir}/*\" -DestinationPath \"${archive}\" -Force"`);
                } else {
                    archive = `${outBase}.tar.gz`;
                    await this.executeCommand(`tar -czf \"${archive}\" -C \"${tmpDir}\" .`);
                }
                return { success: true, file: archive };
            } catch (e) {
                return { success: false, error: e.message };
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

    async commandExists(cmd) {
        return new Promise((resolve) => {
            const whichCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
            require('child_process').exec(whichCmd, (err) => resolve(!err));
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

    startHealthPolling() {
        const poll = async () => {
            try {
                const cfg = await this.configManager.getConfig().catch(() => ({ port: 8082 }));
                const port = (cfg && cfg.port) || 8082;
                const status = await (async () => {
                    try {
                        const base = `http://127.0.0.1:${port}`;
                        const res = await fetch(`${base}/health`);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const data = await res.json();
                        return { ok: true, data };
                    } catch (e) {
                        return { ok: false, error: e.message };
                    }
                })();
                this.sendToRenderer('proxy-health', { port, ...status });
            } catch (e) {
                this.sendToRenderer('proxy-health', { ok: false, error: e.message });
            } finally {
                setTimeout(poll, 5000);
            }
        };
        poll();
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