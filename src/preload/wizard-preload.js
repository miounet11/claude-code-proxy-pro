/**
 * 安装向导 Preload Script
 * 为安装向导提供安全的 API 访问
 */

const { contextBridge, ipcRenderer } = require('electron');

// 确保粘贴功能正常工作
window.addEventListener('DOMContentLoaded', () => {
    console.log('[Preload] DOM 加载完成，初始化粘贴事件');
    
    // 不要阻止任何粘贴事件，让它们正常冒泡
    document.addEventListener('paste', (e) => {
        console.log('[Preload] 检测到粘贴事件', e.target?.tagName, e.target?.id);
    }, true);
    
    // 为输入框添加特殊处理
    setTimeout(() => {
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            console.log('[Preload] 找到 API Key 输入框');
            // 删除可能存在的任何属性限制
            apiKeyInput.removeAttribute('readonly');
            apiKeyInput.removeAttribute('disabled');
        }
    }, 100);
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
    
    // 新增：运行一键安装脚本（跨平台）
    runProxyInstaller: (args) => ipcRenderer.invoke('run-proxy-installer', args),
    // 新增：配置 Claude Code 环境（持久化等）
    configureClaudeEnv: (args) => ipcRenderer.invoke('configure-claude-env', args),
    // 新增：校验 Python Proxy 健康状态
    verifyProxy: (port) => ipcRenderer.invoke('verify-claude-proxy', port),
    
    // 应用控制
    openMainApp: () => ipcRenderer.invoke('open-main-app'),
    
    // 安装进度
    onInstallProgress: (callback) => {
        ipcRenderer.on('install-progress', (event, data) => callback(data));
    },
    
    // 移除监听器
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('install-progress');
    },
    
    // 剪贴板操作
    getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
    setClipboardText: (text) => ipcRenderer.invoke('set-clipboard-text', text)
});