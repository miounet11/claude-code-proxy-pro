const { EventEmitter } = require('events');
const TerminalProcess = require('./TerminalProcess');
const ProfileDetector = require('./ProfileDetector');
const ShellIntegration = require('./ShellIntegration');

class TerminalManager extends EventEmitter {
  constructor() {
    super();
    this.terminals = new Map();
    this.profiles = {};
    this.defaultProfile = null;
    this.profileDetector = new ProfileDetector();
    this.shellIntegration = new ShellIntegration();
    this.nextId = 1;
  }

  async initialize() {
    // Detect available profiles
    this.profiles = await this.profileDetector.detectProfiles();
    this.defaultProfile = this.profileDetector.getDefaultProfile(this.profiles);
    
    // Load user custom profiles from settings
    this.loadCustomProfiles();
    
    return {
      profiles: this.profiles,
      defaultProfile: this.defaultProfile
    };
  }

  loadCustomProfiles() {
    try {
      // Use electron-store or your preferred configuration management
      const customProfiles = {
        'bash': {
          path: process.platform === 'darwin' ? '/bin/bash' : '/usr/bin/bash',
          args: ['-l'],
          env: {
            TERM: 'xterm-256color'
          }
        },
        'powershell': {
          path: process.platform === 'win32' ? 'powershell.exe' : 'pwsh',
          args: [],
          env: {
            TERM: 'xterm-256color'
          }
        }
      };

      // Merge custom profiles
      this.profiles = { ...this.profiles, ...customProfiles };
    } catch (error) {
      console.error('Failed to load custom profiles:', error);
    }
  }

  async createTerminal(options = {}) {
    const id = this.nextId++;
    
    // Determine which profile to use
    const profileName = options.profile || this.defaultProfile;
    const profile = this.profiles[profileName];
    
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    // Create terminal process
    const terminal = new TerminalProcess({
      id,
      name: options.name || `Terminal ${id}`,
      shell: profile.path,
      args: profile.args || [],
      cwd: options.cwd || process.env.HOME || process.env.USERPROFILE,
      env: {
        ...process.env,
        ...profile.env,
        ...options.env
      },
      cols: options.cols || 80,
      rows: options.rows || 24
    });

    // Initialize terminal
    await terminal.spawn();

    // Setup shell integration if enabled
    if (this.shellIntegration.isSupported(profile.path)) {
      await this.shellIntegration.inject(terminal);
    }

    // Setup event forwarding
    terminal.on('data', (data) => {
      this.emit('terminal-data', { id, data });
    });

    terminal.on('exit', (code) => {
      this.emit('terminal-exit', { id, code });
      this.terminals.delete(id);
    });

    terminal.on('title', (title) => {
      this.emit('terminal-title', { id, title });
    });

    // Shell integration events
    terminal.on('command-start', (command) => {
      this.emit('command-start', { id, command });
    });

    terminal.on('command-end', (exitCode) => {
      this.emit('command-end', { id, exitCode });
    });

    terminal.on('cwd-change', (cwd) => {
      this.emit('cwd-change', { id, cwd });
    });

    // Store terminal
    this.terminals.set(id, terminal);

    return {
      id,
      name: terminal.name,
      profile: profileName,
      pid: terminal.pid
    };
  }

  getTerminal(id) {
    return this.terminals.get(id);
  }

  getAllTerminals() {
    return Array.from(this.terminals.entries()).map(([id, terminal]) => ({
      id,
      name: terminal.name,
      pid: terminal.pid,
      title: terminal.title,
      cwd: terminal.cwd
    }));
  }

  async killTerminal(id) {
    const terminal = this.terminals.get(id);
    if (terminal) {
      await terminal.kill();
      this.terminals.delete(id);
    }
  }

  async killAllTerminals() {
    const promises = [];
    for (const terminal of this.terminals.values()) {
      promises.push(terminal.kill());
    }
    await Promise.all(promises);
    this.terminals.clear();
  }

  writeToTerminal(id, data) {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.write(data);
    }
  }

  resizeTerminal(id, cols, rows) {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.resize(cols, rows);
    }
  }

  // Profile management
  getProfiles() {
    return this.profiles;
  }

  getDefaultProfile() {
    return this.defaultProfile;
  }

  setDefaultProfile(profileName) {
    if (this.profiles[profileName]) {
      this.defaultProfile = profileName;
      // TODO: Save to settings
    }
  }

  addCustomProfile(name, config) {
    this.profiles[name] = config;
    // TODO: Save to settings
  }

  removeCustomProfile(name) {
    delete this.profiles[name];
    // TODO: Save to settings
  }

  // Terminal actions
  clearTerminal(id) {
    const terminal = this.terminals.get(id);
    if (terminal) {
      // Send clear screen sequence
      terminal.write('\x1b[2J\x1b[3J\x1b[H');
    }
  }

  async runCommand(id, command) {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.write(command + '\r');
    }
  }
}

module.exports = TerminalManager;