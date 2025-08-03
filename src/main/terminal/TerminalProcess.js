const { EventEmitter } = require('events');
const pty = require('node-pty');

class TerminalProcess extends EventEmitter {
  constructor(options) {
    super();
    this.id = options.id;
    this.name = options.name;
    this.shell = options.shell;
    this.args = options.args || [];
    this.cwd = options.cwd;
    this.env = options.env || process.env;
    this.cols = options.cols || 80;
    this.rows = options.rows || 24;
    
    this.ptyProcess = null;
    this.pid = null;
    this.title = this.name;
    this.cwd = options.cwd;
    this.isAlive = false;
    
    // Buffer for shell integration parsing
    this.dataBuffer = '';
  }

  async spawn() {
    try {
      this.ptyProcess = pty.spawn(this.shell, this.args, {
        name: 'xterm-256color',
        cols: this.cols,
        rows: this.rows,
        cwd: this.cwd,
        env: this.env
      });

      this.pid = this.ptyProcess.pid;
      this.isAlive = true;

      // Setup event handlers
      this.ptyProcess.onData((data) => {
        // Parse shell integration sequences before emitting
        this.parseShellIntegration(data);
        this.emit('data', data);
      });

      this.ptyProcess.onExit(({ exitCode, signal }) => {
        this.isAlive = false;
        this.emit('exit', exitCode || 0);
      });

      return true;
    } catch (error) {
      console.error('Failed to spawn terminal:', error);
      throw error;
    }
  }

  parseShellIntegration(data) {
    // VS Code shell integration uses OSC 633 sequences
    this.dataBuffer += data;
    
    // Command start: ESC]633;A\x07
    const commandStartMatch = this.dataBuffer.match(/\x1b\]633;A\x07/);
    if (commandStartMatch) {
      this.emit('command-start');
      this.dataBuffer = this.dataBuffer.substring(commandStartMatch.index + commandStartMatch[0].length);
    }
    
    // Command end with exit code: ESC]633;B;exitCode\x07
    const commandEndMatch = this.dataBuffer.match(/\x1b\]633;B;(\d+)\x07/);
    if (commandEndMatch) {
      const exitCode = parseInt(commandEndMatch[1], 10);
      this.emit('command-end', exitCode);
      this.dataBuffer = this.dataBuffer.substring(commandEndMatch.index + commandEndMatch[0].length);
    }
    
    // Current working directory: ESC]633;P;cwd=path\x07
    const cwdMatch = this.dataBuffer.match(/\x1b\]633;P;cwd=([^\x07]+)\x07/);
    if (cwdMatch) {
      this.cwd = cwdMatch[1];
      this.emit('cwd-change', this.cwd);
      this.dataBuffer = this.dataBuffer.substring(cwdMatch.index + cwdMatch[0].length);
    }
    
    // Terminal title: ESC]0;title\x07
    const titleMatch = this.dataBuffer.match(/\x1b\]0;([^\x07]+)\x07/);
    if (titleMatch) {
      this.title = titleMatch[1];
      this.emit('title', this.title);
      this.dataBuffer = this.dataBuffer.substring(titleMatch.index + titleMatch[0].length);
    }
    
    // Prevent buffer from growing too large
    if (this.dataBuffer.length > 10000) {
      this.dataBuffer = this.dataBuffer.substring(this.dataBuffer.length - 1000);
    }
  }

  write(data) {
    if (this.ptyProcess && this.isAlive) {
      this.ptyProcess.write(data);
    }
  }

  resize(cols, rows) {
    if (this.ptyProcess && this.isAlive) {
      this.cols = cols;
      this.rows = rows;
      this.ptyProcess.resize(cols, rows);
    }
  }

  async kill(signal = 'SIGTERM') {
    if (this.ptyProcess && this.isAlive) {
      return new Promise((resolve) => {
        this.ptyProcess.once('exit', () => {
          resolve();
        });
        this.ptyProcess.kill(signal);
        
        // Force kill after timeout
        setTimeout(() => {
          if (this.isAlive) {
            this.ptyProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      });
    }
  }

  getInfo() {
    return {
      id: this.id,
      name: this.name,
      pid: this.pid,
      title: this.title,
      cwd: this.cwd,
      isAlive: this.isAlive
    };
  }
}

module.exports = TerminalProcess;