/**
 * 安装向导 Preload Script
 * 为安装向导提供安全的 API 访问
 */

const { contextBridge, ipcRenderer } = require('electron');

// 确保粘贴功能正常工作
window.addEventListener('DOMContentLoaded', () => {
    // 阻止 Electron 的默认粘贴行为
    document.addEventListener('paste', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
            // 允许在输入框中粘贴
            e.stopPropagation();
        }
    }, true);
});

contextBridge.exposeInMainWorld('electronAPI', {
    // 系统信息
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    
    // 命令检查
    checkCommand: (command) => ipcRenderer.invoke('check-command', command),
    
    // 网络检查
    checkNetwork: () => ipcRenderer.invoke('check-network'),
    
    // 端口检查
    checkPort: (port) => ipcRenderer.invoke('check-port', port),
    
    // 安装依赖
    installDependency: (name) => ipcRenderer.invoke('install-dependency', name),
    
    // 配置管理
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    
    // 环境变量
    setEnvironment: (vars) => ipcRenderer.invoke('set-environment', vars),
    
    // 代理管理
    startProxy: (config) => ipcRenderer.invoke('start-proxy', config),
    
    // 应用控制
    openMainApp: () => ipcRenderer.invoke('open-main-app'),
    
    // 安装进度
    onInstallProgress: (callback) => {
        ipcRenderer.on('install-progress', (event, data) => callback(data));
    },
    
    // 移除监听器
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('install-progress');
    }
});