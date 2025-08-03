const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const os = require('os');
const { logger } = require('./logger');

class SimpleTerminalService {
    constructor() {
        this.terminals = new Map();
        this.setupIpcHandlers();
    }

    setupIpcHandlers() {
        // 创建新终端
        ipcMain.handle('terminal:create', (event, options = {}) => {
            try {
                const shell = options.shell || this.getDefaultShell();
                const cwd = options.cwd || os.homedir();
                const env = {
                    ...process.env,
                    ...options.env
                };

                // 使用 child_process.spawn 创建子进程
                const shellProcess = spawn(shell, [], {
                    cwd,
                    env,
                    shell: true,
                    windowsHide: true
                });

                const terminalId = `terminal-${Date.now()}`;
                
                // 设置编码
                shellProcess.stdout.setEncoding('utf8');
                shellProcess.stderr.setEncoding('utf8');
                
                // 监听标准输出
                shellProcess.stdout.on('data', (data) => {
                    event.sender.send(`terminal:data:${terminalId}`, data);
                });
                
                // 监听错误输出
                shellProcess.stderr.on('data', (data) => {
                    event.sender.send(`terminal:data:${terminalId}`, data);
                });

                // 监听退出
                shellProcess.on('exit', (code, signal) => {
                    logger.info('Terminal', 'Terminal exited', { terminalId, code, signal });
                    event.sender.send(`terminal:exit:${terminalId}`, { code, signal });
                    this.terminals.delete(terminalId);
                });

                // 监听错误
                shellProcess.on('error', (error) => {
                    logger.error('Terminal', 'Terminal error', { terminalId, error: error.message });
                    event.sender.send(`terminal:data:${terminalId}`, `Error: ${error.message}\n`);
                });

                // 存储终端实例
                this.terminals.set(terminalId, {
                    shellProcess,
                    info: {
                        pid: shellProcess.pid,
                        shell,
                        cwd
                    }
                });

                logger.info('Terminal', 'Terminal created', { terminalId, pid: shellProcess.pid });

                // 发送初始提示符
                setTimeout(() => {
                    event.sender.send(`terminal:data:${terminalId}`, `${cwd} $ `);
                }, 100);

                return {
                    success: true,
                    terminalId,
                    pid: shellProcess.pid
                };
            } catch (error) {
                logger.error('Terminal', 'Failed to create terminal', { error: error.message });
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        // 写入数据到终端
        ipcMain.handle('terminal:write', (event, terminalId, data) => {
            const terminal = this.terminals.get(terminalId);
            if (terminal && terminal.shellProcess) {
                try {
                    // 检查是否是特殊命令
                    const trimmedData = data.trim();
                    
                    if (trimmedData === 'clear') {
                        // 发送清屏命令
                        event.sender.send(`terminal:data:${terminalId}`, '\x1b[2J\x1b[H');
                        event.sender.send(`terminal:data:${terminalId}`, `${terminal.info.cwd} $ `);
                        return { success: true };
                    }
                    
                    // 写入到进程的标准输入
                    terminal.shellProcess.stdin.write(data);
                    
                    // 如果是换行符，表示命令执行，稍后发送新的提示符
                    if (data.includes('\n')) {
                        setTimeout(() => {
                            event.sender.send(`terminal:data:${terminalId}`, `\n${terminal.info.cwd} $ `);
                        }, 50);
                    }
                    
                    return { success: true };
                } catch (error) {
                    logger.error('Terminal', 'Failed to write to terminal', { terminalId, error: error.message });
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'Terminal not found' };
        });

        // 调整终端大小（简化版本，不支持真正的调整）
        ipcMain.handle('terminal:resize', (event, terminalId, cols, rows) => {
            // 简化实现：只记录，不实际调整
            const terminal = this.terminals.get(terminalId);
            if (terminal) {
                logger.info('Terminal', 'Terminal resize requested', { terminalId, cols, rows });
                return { success: true };
            }
            return { success: false, error: 'Terminal not found' };
        });

        // 销毁终端
        ipcMain.handle('terminal:destroy', (event, terminalId) => {
            const terminal = this.terminals.get(terminalId);
            if (terminal && terminal.shellProcess) {
                try {
                    terminal.shellProcess.kill();
                    this.terminals.delete(terminalId);
                    logger.info('Terminal', 'Terminal destroyed', { terminalId });
                    return { success: true };
                } catch (error) {
                    logger.error('Terminal', 'Failed to destroy terminal', { terminalId, error: error.message });
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'Terminal not found' };
        });

        // 获取终端信息
        ipcMain.handle('terminal:info', (event, terminalId) => {
            const terminal = this.terminals.get(terminalId);
            if (terminal) {
                return {
                    success: true,
                    info: terminal.info
                };
            }
            return { success: false, error: 'Terminal not found' };
        });

        // 列出所有终端
        ipcMain.handle('terminal:list', () => {
            const terminalList = Array.from(this.terminals.entries()).map(([id, terminal]) => ({
                id,
                info: terminal.info
            }));
            return { success: true, terminals: terminalList };
        });
    }

    getDefaultShell() {
        if (process.platform === 'win32') {
            return process.env.COMSPEC || 'cmd.exe';
        }
        return process.env.SHELL || '/bin/bash';
    }

    // 清理所有终端
    cleanup() {
        for (const [terminalId, terminal] of this.terminals) {
            try {
                terminal.shellProcess.kill();
                logger.info('Terminal', 'Terminal cleaned up', { terminalId });
            } catch (error) {
                logger.error('Terminal', 'Failed to cleanup terminal', { terminalId, error: error.message });
            }
        }
        this.terminals.clear();
    }
}

module.exports = SimpleTerminalService;