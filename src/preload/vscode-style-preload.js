// Claude Code Proxy Pro - VSCode Style Preload Script
// 提供完整的 Electron API 桥接

const { contextBridge, ipcRenderer } = require('electron');

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 配置管理
    getProfiles: () => ipcRenderer.invoke('get-profiles'),
    saveProfile: (profile) => ipcRenderer.invoke('save-profile', profile),
    deleteProfile: (id) => ipcRenderer.invoke('delete-profile', id),
    
    // 代理管理
    startProxy: (config) => ipcRenderer.invoke('start-proxy', config),
    stopProxy: () => ipcRenderer.invoke('stop-proxy'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    runProxyInstaller: (args) => ipcRenderer.invoke('run-proxy-installer', args),
    configureClaudeEnv: (args) => ipcRenderer.invoke('configure-claude-env', args),
    verifyProxy: (port) => ipcRenderer.invoke('verify-claude-proxy', port),
    onProxyHealth: (cb) => ipcRenderer.on('proxy-health', (_e, payload) => cb(payload)),
    // Doctor
    runDoctor: (args) => ipcRenderer.invoke('run-doctor', args),
    applyFix: (fixId, args) => ipcRenderer.invoke('apply-fix', fixId, args),
    exportDiagnostics: () => ipcRenderer.invoke('export-diagnostics'),
    // Snapshots
    createSnapshot: (note) => ipcRenderer.invoke('create-snapshot', note),
    listSnapshots: () => ipcRenderer.invoke('list-snapshots'),
    rollbackSnapshot: (id) => ipcRenderer.invoke('rollback-snapshot', id),
    
    // 环境检查
    checkCommand: (command) => ipcRenderer.invoke('check-command', command),
    checkEnvironment: () => ipcRenderer.invoke('check-environment'),
    installClaudeCLI: () => ipcRenderer.invoke('install-claude-cli'),
    
    // 终端管理
    createTerminal: (id, options) => ipcRenderer.invoke('create-terminal', id, options),
    closeTerminal: (id) => ipcRenderer.invoke('close-terminal', id),
    sendTerminalInput: (id, data) => ipcRenderer.send('terminal-input', { id, data }),
    resizeTerminal: (id, cols, rows) => ipcRenderer.send('terminal-resize', { id, cols, rows }),
    runCommand: (id, command) => ipcRenderer.invoke('run-command', id, command),
    
    // 终端事件监听
    onTerminalData: (callback) => {
        const listener = (event, data) => callback(event, data);
        ipcRenderer.on('terminal-data', listener);
        return () => ipcRenderer.removeListener('terminal-data', listener);
    },
    
    onTerminalExit: (callback) => {
        const listener = (event, data) => callback(event, data);
        ipcRenderer.on('terminal-exit', listener);
        return () => ipcRenderer.removeListener('terminal-exit', listener);
    },
    
    // 状态更新监听
    onProxyStatusUpdate: (callback) => {
        const listener = (event, status) => callback(event, status);
        ipcRenderer.on('proxy-status-update', listener);
        return () => ipcRenderer.removeListener('proxy-status-update', listener);
    },
    
    onEnvironmentUpdate: (callback) => {
        const listener = (event, status) => callback(event, status);
        ipcRenderer.on('environment-update', listener);
        return () => ipcRenderer.removeListener('environment-update', listener);
    },
    
    // 文件操作
    openFile: (path) => ipcRenderer.invoke('open-file', path),
    saveFile: (path, content) => ipcRenderer.invoke('save-file', path, content),
    
    // 系统操作
    copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
    
    // 应用信息
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    
    // 窗口控制
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    
    // 开发者工具
    toggleDevTools: () => ipcRenderer.send('toggle-dev-tools'),
    
    // 日志
    log: (level, message, ...args) => ipcRenderer.send('log', { level, message, args }),
    
    // 快速启动功能
    quickStart: () => ipcRenderer.invoke('quick-start'),
    
    onQuickStart: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('quick-start', listener);
        return () => ipcRenderer.removeListener('quick-start', listener);
    },
    
    onInstallProgress: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('install-progress', listener);
        return () => ipcRenderer.removeListener('install-progress', listener);
    }
});

// 监听主进程的初始化完成事件
ipcRenderer.on('app-ready', () => {
    console.log('Application ready');
});

// 错误处理
window.addEventListener('error', (event) => {
    ipcRenderer.send('renderer-error', {
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? event.error.stack : null
    });
});

window.addEventListener('unhandledrejection', (event) => {
    ipcRenderer.send('renderer-error', {
        message: 'Unhandled Promise Rejection',
        reason: event.reason,
        promise: event.promise
    });
});

// 性能监控
if (window.performance && window.performance.navigation) {
    window.addEventListener('load', () => {
        const perfData = {
            loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
            domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
            firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0
        };
        ipcRenderer.send('performance-data', perfData);
    });
}