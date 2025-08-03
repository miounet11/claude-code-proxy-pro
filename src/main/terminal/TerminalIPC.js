const { ipcMain } = require('electron');
const TerminalManager = require('./TerminalManager');

class TerminalIPC {
  constructor() {
    this.terminalManager = new TerminalManager();
    this.windows = new Map();
  }

  async initialize() {
    await this.terminalManager.initialize();
    this.setupIPCHandlers();
  }

  setupIPCHandlers() {
    // Terminal lifecycle
    ipcMain.handle('terminal:create', async (event, options) => {
      try {
        const terminal = await this.terminalManager.createTerminal(options);
        this.trackWindow(terminal.id, event.sender);
        return terminal;
      } catch (error) {
        console.error('Failed to create terminal:', error);
        throw error;
      }
    });

    ipcMain.handle('terminal:kill', async (event, terminalId) => {
      await this.terminalManager.killTerminal(terminalId);
      this.untrackWindow(terminalId);
    });

    ipcMain.handle('terminal:killAll', async () => {
      await this.terminalManager.killAllTerminals();
      this.windows.clear();
    });

    // Terminal I/O
    ipcMain.on('terminal:input', (event, { terminalId, data }) => {
      this.terminalManager.writeToTerminal(terminalId, data);
    });

    ipcMain.on('terminal:resize', (event, { terminalId, cols, rows }) => {
      this.terminalManager.resizeTerminal(terminalId, cols, rows);
    });

    ipcMain.on('terminal:clear', (event, terminalId) => {
      this.terminalManager.clearTerminal(terminalId);
    });

    // Terminal info
    ipcMain.handle('terminal:list', () => {
      return this.terminalManager.getAllTerminals();
    });

    ipcMain.handle('terminal:get', (event, terminalId) => {
      const terminal = this.terminalManager.getTerminal(terminalId);
      return terminal ? terminal.getInfo() : null;
    });

    // Profile management
    ipcMain.handle('terminal:getProfiles', () => {
      return this.terminalManager.getProfiles();
    });

    ipcMain.handle('terminal:getDefaultProfile', () => {
      return this.terminalManager.getDefaultProfile();
    });

    ipcMain.handle('terminal:setDefaultProfile', (event, profileName) => {
      this.terminalManager.setDefaultProfile(profileName);
    });

    ipcMain.handle('terminal:addProfile', (event, { name, config }) => {
      this.terminalManager.addCustomProfile(name, config);
    });

    ipcMain.handle('terminal:removeProfile', (event, name) => {
      this.terminalManager.removeCustomProfile(name);
    });

    // Command execution
    ipcMain.handle('terminal:runCommand', (event, { terminalId, command }) => {
      this.terminalManager.runCommand(terminalId, command);
    });

    // Setup terminal event forwarding
    this.setupEventForwarding();
  }

  setupEventForwarding() {
    // Forward terminal output
    this.terminalManager.on('terminal-data', ({ id, data }) => {
      const window = this.windows.get(id);
      if (window && !window.isDestroyed()) {
        window.send(`terminal:data:${id}`, data);
      }
    });

    // Forward terminal events
    this.terminalManager.on('terminal-exit', ({ id, code }) => {
      const window = this.windows.get(id);
      if (window && !window.isDestroyed()) {
        window.send(`terminal:event:${id}`, { type: 'exit', code });
      }
      this.untrackWindow(id);
    });

    this.terminalManager.on('terminal-title', ({ id, title }) => {
      const window = this.windows.get(id);
      if (window && !window.isDestroyed()) {
        window.send(`terminal:event:${id}`, { type: 'title', title });
      }
    });

    // Shell integration events
    this.terminalManager.on('command-start', ({ id, command }) => {
      const window = this.windows.get(id);
      if (window && !window.isDestroyed()) {
        window.send(`terminal:event:${id}`, { type: 'command-start', command });
      }
    });

    this.terminalManager.on('command-end', ({ id, exitCode }) => {
      const window = this.windows.get(id);
      if (window && !window.isDestroyed()) {
        window.send(`terminal:event:${id}`, { type: 'command-end', exitCode });
      }
    });

    this.terminalManager.on('cwd-change', ({ id, cwd }) => {
      const window = this.windows.get(id);
      if (window && !window.isDestroyed()) {
        window.send(`terminal:event:${id}`, { type: 'cwd-change', cwd });
      }
    });
  }

  trackWindow(terminalId, webContents) {
    this.windows.set(terminalId, webContents);
    
    // Clean up when window is destroyed
    webContents.once('destroyed', () => {
      this.untrackWindow(terminalId);
    });
  }

  untrackWindow(terminalId) {
    this.windows.delete(terminalId);
  }

  async shutdown() {
    await this.terminalManager.killAllTerminals();
  }
}

module.exports = TerminalIPC;