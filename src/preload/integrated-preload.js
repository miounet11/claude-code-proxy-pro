const { contextBridge, ipcRenderer } = require('electron');

// 终端与 CLI 功能已移除；仅暴露必要的系统接口
contextBridge.exposeInMainWorld('electronAPI', {
  // 兼容空方法，避免旧代码调用报错
  createTerminal: () => false,
  sendTerminalInput: () => false,
  onTerminalData: () => () => {},
  resizeTerminal: () => false,
  closeTerminal: () => false,
  terminal: {
    create: () => Promise.resolve({}),
    kill: () => Promise.resolve(true),
    killAll: () => Promise.resolve(true),
    sendInput: () => {},
    resize: () => {},
    clear: () => {},
    list: () => Promise.resolve([]),
    get: () => Promise.resolve(null),
    onData: () => () => {},
    onEvent: () => () => {},
    getProfiles: () => Promise.resolve([]),
    getDefaultProfile: () => Promise.resolve(null),
    setDefaultProfile: () => Promise.resolve(true),
    addProfile: () => Promise.resolve(true),
    removeProfile: () => Promise.resolve(true),
    runCommand: () => Promise.resolve({})
  },

  // File and clipboard operations
  openFile: (filePath) => ipcRenderer.send('open-file', filePath),
  copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
  pasteFromClipboard: () => ipcRenderer.invoke('paste-from-clipboard'),

  // Convenience methods for new terminal system
  createTerminalEnhanced: (options) => ipcRenderer.invoke('terminal:create', options),
  killTerminal: (terminalId) => ipcRenderer.invoke('terminal:kill', terminalId),
  getTerminalProfiles: () => ipcRenderer.invoke('terminal:getProfiles'),
  onTerminalEvent: (terminalId, callback) => {
    const channel = `terminal:event:${terminalId}`;
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  }
});