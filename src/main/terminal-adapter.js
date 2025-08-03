/**
 * 终端服务适配器
 * 为增强版主进程提供简化的终端接口
 */

const { spawn } = require('child_process');
const os = require('os');
const EventEmitter = require('events');
const { Logger } = require('./logger');

class TerminalAdapter extends EventEmitter {
    constructor() {
        super();
        this.logger = new Logger({ module: 'TerminalAdapter' });
        this.terminals = new Map();
        this.terminalCounter = 0;
    }

    /**
     * 创建新终端
     */
    async createTerminal(options = {}) {
        try {
            const terminalId = `terminal-${++this.terminalCounter}`;
            const shell = options.shell || this.getDefaultShell();
            const cwd = options.cwd || os.homedir();
            const env = {
                ...process.env,
                ...options.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor'
            };

            // 创建子进程
            const shellProcess = spawn(shell, [], {
                cwd,
                env,
                shell: true,
                windowsHide: true
            });

            // 设置编码
            shellProcess.stdout.setEncoding('utf8');
            shellProcess.stderr.setEncoding('utf8');

            // 监听输出
            shellProcess.stdout.on('data', (data) => {
                this.emit('terminal-data', { terminalId, data });
            });

            shellProcess.stderr.on('data', (data) => {
                this.emit('terminal-data', { terminalId, data });
            });

            // 监听退出
            shellProcess.on('exit', (code, signal) => {
                this.logger.info(`Terminal ${terminalId} exited`, { code, signal });
                this.emit('terminal-exit', { terminalId, code, signal });
                this.terminals.delete(terminalId);
            });

            // 监听错误
            shellProcess.on('error', (error) => {
                this.logger.error(`Terminal ${terminalId} error:`, error);
                this.emit('terminal-data', { 
                    terminalId, 
                    data: `\r\n[Error: ${error.message}]\r\n` 
                });
            });

            // 保存终端信息
            this.terminals.set(terminalId, {
                process: shellProcess,
                shell,
                cwd,
                createdAt: new Date()
            });

            this.logger.info(`Terminal ${terminalId} created`, { pid: shellProcess.pid });

            // 发送欢迎消息
            setTimeout(() => {
                this.emit('terminal-data', { 
                    terminalId, 
                    data: `Claude Code Proxy Pro Terminal\r\n${cwd} $ ` 
                });
            }, 100);

            return terminalId;

        } catch (error) {
            this.logger.error('Failed to create terminal:', error);
            throw error;
        }
    }

    /**
     * 写入数据到终端
     */
    async write(terminalId, data) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) {
            throw new Error(`Terminal ${terminalId} not found`);
        }

        try {
            terminal.process.stdin.write(data);
            return true;
        } catch (error) {
            this.logger.error(`Failed to write to terminal ${terminalId}:`, error);
            throw error;
        }
    }

    /**
     * 调整终端大小
     */
    async resize(terminalId, cols, rows) {
        // Windows 不支持 pty 调整大小，所以这里只记录
        this.logger.debug(`Terminal ${terminalId} resize:`, { cols, rows });
        return true;
    }

    /**
     * 销毁终端
     */
    async destroyTerminal(terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) {
            return false;
        }

        try {
            // 尝试优雅关闭
            terminal.process.kill('SIGTERM');
            
            // 给进程一些时间来清理
            setTimeout(() => {
                if (!terminal.process.killed) {
                    terminal.process.kill('SIGKILL');
                }
            }, 1000);

            this.terminals.delete(terminalId);
            this.logger.info(`Terminal ${terminalId} destroyed`);
            return true;

        } catch (error) {
            this.logger.error(`Failed to destroy terminal ${terminalId}:`, error);
            return false;
        }
    }

    /**
     * 获取默认 shell
     */
    getDefaultShell() {
        if (process.platform === 'win32') {
            return process.env.COMSPEC || 'cmd.exe';
        }
        return process.env.SHELL || '/bin/bash';
    }

    /**
     * 获取所有活动终端
     */
    getActiveTerminals() {
        const terminals = [];
        for (const [id, terminal] of this.terminals) {
            terminals.push({
                id,
                shell: terminal.shell,
                cwd: terminal.cwd,
                createdAt: terminal.createdAt,
                pid: terminal.process.pid
            });
        }
        return terminals;
    }

    /**
     * 清理所有终端
     */
    async cleanup() {
        this.logger.info('Cleaning up all terminals...');
        const promises = [];
        
        for (const terminalId of this.terminals.keys()) {
            promises.push(this.destroyTerminal(terminalId));
        }
        
        await Promise.all(promises);
        this.logger.info('All terminals cleaned up');
    }
}

module.exports = TerminalAdapter;