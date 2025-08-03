const { contextBridge, ipcRenderer } = require('electron');

// Expose both legacy and new terminal APIs
contextBridge.exposeInMainWorld('electronAPI', {
  // Legacy terminal API (for existing code)
  createTerminal: () => ipcRenderer.invoke('create-terminal'),
  sendTerminalInput: (pid, data) => ipcRenderer.send('terminal-input', { pid, data }),
  onTerminalData: (callback) => ipcRenderer.on('terminal-data', callback),
  resizeTerminal: (pid, cols, rows) => ipcRenderer.send('terminal-resize', { pid, cols, rows }),
  closeTerminal: (pid) => ipcRenderer.send('close-terminal', pid),

  // New VS Code-style terminal API
  terminal: {
    // Terminal lifecycle
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    kill: (terminalId) => ipcRenderer.invoke('terminal:kill', terminalId),
    killAll: () => ipcRenderer.invoke('terminal:killAll'),
    
    // Terminal I/O
    sendInput: (terminalId, data) => {
      ipcRenderer.send('terminal:input', { terminalId, data });
    },
    
    resize: (terminalId, cols, rows) => {
      ipcRenderer.send('terminal:resize', { terminalId, cols, rows });
    },
    
    clear: (terminalId) => {
      ipcRenderer.send('terminal:clear', terminalId);
    },
    
    // Terminal info
    list: () => ipcRenderer.invoke('terminal:list'),
    get: (terminalId) => ipcRenderer.invoke('terminal:get', terminalId),
    
    // Terminal events
    onData: (terminalId, callback) => {
      const channel = `terminal:data:${terminalId}`;
      ipcRenderer.on(channel, callback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(channel, callback);
      };
    },
    
    onEvent: (terminalId, callback) => {
      const channel = `terminal:event:${terminalId}`;
      ipcRenderer.on(channel, callback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(channel, callback);
      };
    },
    
    // Profile management
    getProfiles: () => ipcRenderer.invoke('terminal:getProfiles'),
    getDefaultProfile: () => ipcRenderer.invoke('terminal:getDefaultProfile'),
    setDefaultProfile: (profileName) => ipcRenderer.invoke('terminal:setDefaultProfile', profileName),
    addProfile: (name, config) => ipcRenderer.invoke('terminal:addProfile', { name, config }),
    removeProfile: (name) => ipcRenderer.invoke('terminal:removeProfile', name),
    
    // Command execution
    runCommand: (terminalId, command) => ipcRenderer.invoke('terminal:runCommand', { terminalId, command })
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