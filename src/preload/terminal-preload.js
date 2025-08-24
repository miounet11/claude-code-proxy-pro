const { contextBridge, ipcRenderer } = require('electron');

// 终端预加载已移除：提供空壳避免错误
contextBridge.exposeInMainWorld('electronAPI', {
  createTerminal: () => false,
  killTerminal: () => false,
  killAllTerminals: () => false,
  sendTerminalInput: () => {},
  resizeTerminal: () => {},
  clearTerminal: () => {},
  listTerminals: () => Promise.resolve([]),
  getTerminal: () => Promise.resolve(null),
  onTerminalData: () => () => {},
  onTerminalEvent: () => () => {},
  getTerminalProfiles: () => Promise.resolve([]),
  getDefaultProfile: () => Promise.resolve(null),
  setDefaultProfile: () => Promise.resolve(true),
  addTerminalProfile: () => Promise.resolve(true),
  removeTerminalProfile: () => Promise.resolve(true),
  runCommand: () => Promise.resolve({}),
  openFile: () => {},
  copyToClipboard: () => {},
  pasteFromClipboard: () => Promise.resolve('')
});