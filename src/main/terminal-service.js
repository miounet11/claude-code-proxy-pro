const { spawn } = require('node-pty');
const { EventEmitter } = require('events');
const os = require('os');

class TerminalService extends EventEmitter {
    constructor(options = {}) {
        super();
        this.terminals = new Map();
        this.defaultOptions = {
            name: 'xterm-256color',
            cols: 80,
            rows: 24,
            cwd: os.homedir(),
            env: process.env
        };
    }

    /**
     * Create a new terminal instance
     * @param {Object} [options={}] - Terminal creation options
     * @returns {string} Unique terminal ID
     */
    createTerminal(options = {}) {
        const terminalOptions = { ...this.defaultOptions, ...options };
        const shell = os.platform() === 'win32' 
            ? 'powershell.exe' 
            : process.env.SHELL || '/bin/bash';

        const terminal = spawn(shell, [], {
            name: terminalOptions.name,
            cols: terminalOptions.cols,
            rows: terminalOptions.rows,
            cwd: terminalOptions.cwd,
            env: { ...process.env, ...terminalOptions.env }
        });

        const terminalId = this._generateUniqueId();
        this.terminals.set(terminalId, terminal);

        // Setup event handlers
        terminal.onData((data) => {
            this.emit(`terminal-data-${terminalId}`, data);
        });

        terminal.onExit(({ exitCode, signal }) => {
            this.emit(`terminal-exit-${terminalId}`, { exitCode, signal });
            this.terminals.delete(terminalId);
        });

        return terminalId;
    }

    /**
     * Write data to a specific terminal
     * @param {string} terminalId - Unique terminal identifier
     * @param {string} data - Data to write
     */
    write(terminalId, data) {
        const terminal = this.terminals.get(terminalId);
        if (terminal) {
            terminal.write(data);
        }
    }

    /**
     * Resize a terminal
     * @param {string} terminalId - Unique terminal identifier
     * @param {number} cols - Number of columns
     * @param {number} rows - Number of rows
     */
    resize(terminalId, cols, rows) {
        const terminal = this.terminals.get(terminalId);
        if (terminal) {
            terminal.resize(cols, rows);
        }
    }

    /**
     * Close a specific terminal
     * @param {string} terminalId - Unique terminal identifier
     */
    closeTerminal(terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (terminal) {
            terminal.kill();
            this.terminals.delete(terminalId);
        }
    }

    /**
     * Close all terminals
     */
    closeAllTerminals() {
        for (const terminalId of this.terminals.keys()) {
            this.closeTerminal(terminalId);
        }
    }

    /**
     * Get current terminal count
     * @returns {number}
     */
    getTerminalCount() {
        return this.terminals.size;
    }

    /**
     * Generate a unique terminal ID
     * @private
     * @returns {string}
     */
    _generateUniqueId() {
        return `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Singleton pattern
module.exports = new TerminalService();