const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置管理
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // 代理管理
  startProxy: (config) => ipcRenderer.invoke('start-proxy', config),
  stopProxy: () => ipcRenderer.invoke('stop-proxy'),
  getProxyStatus: () => ipcRenderer.invoke('get-proxy-status'),
  
  // 环境检测
  checkEnvironments: () => ipcRenderer.invoke('check-environments'),
  installEnvironment: (key) => ipcRenderer.invoke('install-environment', key),
  
  // Claude Code 启动
  startClaudeCode: (config) => ipcRenderer.invoke('start-claude-code', config),
  
  // 系统操作
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
  
  // 测试API连接
  testApiConnection: (config) => ipcRenderer.invoke('test-api-connection', config),
  
  // 平台信息
  platform: process.platform,
  
  // 监听代理状态更新
  onProxyStatusUpdate: (callback) => {
    ipcRenderer.on('proxy-status-update', (event, status) => callback(status));
  },
  
  // 移除监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // 配置文件管理
  loadProfiles: () => ipcRenderer.invoke('load-profiles'),
  saveProfiles: (profiles) => ipcRenderer.invoke('save-profiles', profiles),
  
  // 测试配置
  testConfig: (config) => ipcRenderer.invoke('test-config', config),
  
  // 启动/停止代理
  startProxy: (config) => ipcRenderer.invoke('start-proxy', config),
  stopProxy: () => ipcRenderer.invoke('stop-proxy'),
  
  // 获取版本
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // 打开终端
  openTerminal: () => ipcRenderer.invoke('open-terminal'),
  openTerminalWithCommand: (command) => ipcRenderer.invoke('open-terminal-with-command', command),
  
  // 集成终端 API
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    write: (terminalId, data) => ipcRenderer.invoke('terminal:write', terminalId, data),
    resize: (terminalId, cols, rows) => ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    destroy: (terminalId) => ipcRenderer.invoke('terminal:destroy', terminalId),
    info: (terminalId) => ipcRenderer.invoke('terminal:info', terminalId),
    list: () => ipcRenderer.invoke('terminal:list'),
    onData: (terminalId, callback) => {
      const channel = `terminal:data:${terminalId}`;
      ipcRenderer.on(channel, (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners(channel);
    },
    onExit: (terminalId, callback) => {
      const channel = `terminal:exit:${terminalId}`;
      ipcRenderer.on(channel, (event, exitInfo) => callback(exitInfo));
      return () => ipcRenderer.removeAllListeners(channel);
    }
  },
  
  // 保存文件
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  
  // 显示确认对话框
  showConfirm: (message) => ipcRenderer.invoke('show-confirm', message),
  
  // 还原官方设置
  restoreOfficialSettings: () => ipcRenderer.invoke('restore-official-settings'),
  
  // 监听toast消息
  onToast: (callback) => {
    ipcRenderer.on('show-toast', (event, data) => callback(data));
  },
  
  // 监听代理状态
  onProxyStatus: (callback) => {
    ipcRenderer.on('proxy-status', (event, status) => callback(status));
  },
  
  // 多语言支持
  getLocale: () => ipcRenderer.invoke('get-locale'),
  setLocale: (locale) => ipcRenderer.invoke('set-locale', locale),
  getTranslations: () => ipcRenderer.invoke('get-translations'),
  getSupportedLocales: () => ipcRenderer.invoke('get-supported-locales'),
  onLocaleChanged: (callback) => {
    ipcRenderer.on('locale-changed', (event, locale) => callback(locale));
  },
  
  // Claude API
  claude: {
    sendMessage: (options) => ipcRenderer.invoke('claude:send-message', options),
    streamMessage: (options) => ipcRenderer.invoke('claude:stream-message', options),
    validateKey: (options) => ipcRenderer.invoke('claude:validate-key', options),
    getModels: () => ipcRenderer.invoke('claude:get-models'),
    onStreamData: (callback) => {
      ipcRenderer.on('claude:stream-data', (event, data) => callback(data));
    },
    onStreamEnd: (callback) => {
      ipcRenderer.on('claude:stream-end', () => callback());
    },
    onStreamError: (callback) => {
      ipcRenderer.on('claude:stream-error', (event, error) => callback(error));
    }
  }
});