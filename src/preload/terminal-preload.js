const { contextBridge, ipcRenderer } = require('electron');

// Terminal API exposed to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Terminal lifecycle
  createTerminal: (options) => ipcRenderer.invoke('terminal:create', options),
  killTerminal: (terminalId) => ipcRenderer.invoke('terminal:kill', terminalId),
  killAllTerminals: () => ipcRenderer.invoke('terminal:killAll'),
  
  // Terminal I/O
  sendTerminalInput: (terminalId, data) => {
    ipcRenderer.send('terminal:input', { terminalId, data });
  },
  
  resizeTerminal: (terminalId, cols, rows) => {
    ipcRenderer.send('terminal:resize', { terminalId, cols, rows });
  },
  
  clearTerminal: (terminalId) => {
    ipcRenderer.send('terminal:clear', terminalId);
  },
  
  // Terminal info
  listTerminals: () => ipcRenderer.invoke('terminal:list'),
  getTerminal: (terminalId) => ipcRenderer.invoke('terminal:get', terminalId),
  
  // Terminal events
  onTerminalData: (terminalId, callback) => {
    const channel = `terminal:data:${terminalId}`;
    ipcRenderer.on(channel, callback);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(channel, callback);
    };
  },
  
  onTerminalEvent: (terminalId, callback) => {
    const channel = `terminal:event:${terminalId}`;
    ipcRenderer.on(channel, callback);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(channel, callback);
    };
  },
  
  // Profile management
  getTerminalProfiles: () => ipcRenderer.invoke('terminal:getProfiles'),
  getDefaultProfile: () => ipcRenderer.invoke('terminal:getDefaultProfile'),
  setDefaultProfile: (profileName) => ipcRenderer.invoke('terminal:setDefaultProfile', profileName),
  addTerminalProfile: (name, config) => ipcRenderer.invoke('terminal:addProfile', { name, config }),
  removeTerminalProfile: (name) => ipcRenderer.invoke('terminal:removeProfile', name),
  
  // Command execution
  runCommand: (terminalId, command) => ipcRenderer.invoke('terminal:runCommand', { terminalId, command }),
  
  // File operations (for link handling)
  openFile: (filePath) => ipcRenderer.send('open-file', filePath),
  
  // Clipboard operations
  copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
  pasteFromClipboard: () => ipcRenderer.invoke('paste-from-clipboard')
});