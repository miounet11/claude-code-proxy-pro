/**
 * EnhancedProxyManager - 增强版代理管理器
 * 集成 AICode-main 的智能功能
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');
const net = require('net');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { Logger } = require('./logger');
const EventEmitter = require('events');
const AutoInstaller = require('./auto-installer');

class EnhancedProxyManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.logger = new Logger({ module: 'EnhancedProxyManager' });
        this.autoInstaller = new AutoInstaller();
        
        // 配置选项
        this.config = {
            port: options.port || 8082,
            host: options.host || '127.0.0.1',
            apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
            baseUrl: options.baseUrl || 'https://api.anthropic.com',
            autoStart: options.autoStart !== false,
            autoRestart: options.autoRestart !== false,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 5000,
            healthCheckInterval: options.healthCheckInterval || 30000
        };
        
        // 状态管理
        this.state = {
            isRunning: false,
            isHealthy: false,
            lastError: null,
            startTime: null,
            requestCount: 0,
            errorCount: 0,
            portConflicts: []
        };
        
        this.app = null;
        this.server = null;
        this.healthCheckTimer = null;
        this.proxyProcess = null;
    }

    /**
     * 智能启动代理服务
     */
    async start() {
        try {
            this.logger.info('启动增强版代理服务...');
            
            // 1. 环境预检
            const envCheck = await this.performEnvironmentCheck();
            if (!envCheck.success) {
                throw new Error(`环境检查失败: ${envCheck.message}`);
            }
            
            // 2. 端口检查和智能处理
            const portAvailable = await this.ensurePortAvailable();
            if (!portAvailable) {
                throw new Error(`无法使用端口 ${this.config.port}`);
            }
            
            // 3. 启动代理服务
            await this.startProxyServer();
            
            // 4. 启动健康检查
            this.startHealthCheck();
            
            // 5. 配置环境变量
            await this.configureEnvironment();
            
            this.state.isRunning = true;
            this.state.startTime = new Date();
            this.emit('started', { port: this.config.port });
            
            this.logger.info(`代理服务已启动在端口 ${this.config.port}`);
            return { success: true, port: this.config.port };
            
        } catch (error) {
            this.logger.error('启动代理服务失败:', error);
            this.state.lastError = error.message;
            this.emit('error', error);
            
            if (this.config.autoRestart) {
                return await this.autoRestart();
            }
            
            throw error;
        }
    }

    /**
     * 执行环境检查
     */
    async performEnvironmentCheck() {
        this.logger.info('执行环境检查...');
        
        try {
            // 检查必要的依赖
            const checks = {
                nodejs: await this.checkCommand('node --version'),
                npm: await this.checkCommand('npm --version'),
                git: await this.checkCommand('git --version')
            };
            
            const failed = Object.entries(checks)
                .filter(([_, status]) => !status)
                .map(([name]) => name);
            
            if (failed.length > 0) {
                // 尝试自动安装缺失的依赖
                this.logger.warn(`缺少依赖: ${failed.join(', ')}`);
                
                if (this.config.autoStart) {
                    this.emit('installing-dependencies', { missing: failed });
                    const installResult = await this.autoInstaller.runFullInstallation((msg, progress) => {
                        this.emit('install-progress', { message: msg, progress });
                    });
                    
                    if (installResult.success) {
                        return { success: true };
                    }
                }
                
                return { 
                    success: false, 
                    message: `缺少必要的依赖: ${failed.join(', ')}`
                };
            }
            
            // 检查 API Key
            if (!this.config.apiKey) {
                this.logger.warn('未设置 ANTHROPIC_API_KEY');
                return {
                    success: false,
                    message: '需要设置 ANTHROPIC_API_KEY'
                };
            }
            
            return { success: true };
            
        } catch (error) {
            this.logger.error('环境检查失败:', error);
            return { 
                success: false, 
                message: error.message 
            };
        }
    }

    /**
     * 确保端口可用
     */
    async ensurePortAvailable() {
        const maxAttempts = 5;
        let currentPort = this.config.port;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const isAvailable = await this.isPortAvailable(currentPort);
            
            if (isAvailable) {
                this.config.port = currentPort;
                return true;
            }
            
            // 获取占用端口的进程信息
            const processInfo = await this.getPortProcess(currentPort);
            this.state.portConflicts.push({
                port: currentPort,
                process: processInfo,
                timestamp: new Date()
            });
            
            this.logger.warn(`端口 ${currentPort} 被占用`, processInfo);
            
            // 智能处理端口冲突
            if (processInfo && this.isOurProcess(processInfo)) {
                // 如果是我们的进程，尝试重启
                this.logger.info('检测到旧的代理进程，尝试重启...');
                await this.killProcess(processInfo.pid);
                await this.sleep(2000);
                continue;
            }
            
            // 尝试下一个端口
            currentPort++;
            this.emit('port-conflict', { 
                originalPort: this.config.port, 
                newPort: currentPort,
                process: processInfo
            });
        }
        
        return false;
    }

    /**
     * 启动代理服务器
     */
    async startProxyServer() {
        this.app = express();
        
        // 请求日志中间件
        this.app.use((req, res, next) => {
            this.state.requestCount++;
            this.logger.debug(`请求: ${req.method} ${req.path}`);
            next();
        });
        
        // 健康检查端点
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: this.getUptime(),
                requests: this.state.requestCount,
                errors: this.state.errorCount
            });
        });
        
        // 代理配置
        const proxyOptions = {
            target: this.config.baseUrl,
            changeOrigin: true,
            secure: true,
            headers: {
                'x-api-key': this.config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            onProxyReq: (proxyReq, req, res) => {
                // 添加认证头
                if (this.config.apiKey) {
                    proxyReq.setHeader('x-api-key', this.config.apiKey);
                }
                
                // 日志记录
                this.logger.debug(`代理请求: ${req.method} ${req.url}`);
            },
            onProxyRes: (proxyRes, req, res) => {
                // 记录响应
                this.logger.debug(`代理响应: ${proxyRes.statusCode}`);
            },
            onError: (err, req, res) => {
                this.state.errorCount++;
                this.logger.error('代理错误:', err);
                
                res.status(502).json({
                    error: {
                        type: 'proxy_error',
                        message: '代理服务暂时不可用',
                        details: err.message
                    }
                });
            }
        };
        
        // 设置代理路由
        this.app.use('/v1', createProxyMiddleware(proxyOptions));
        
        // 错误处理
        this.app.use((err, req, res, next) => {
            this.state.errorCount++;
            this.logger.error('服务器错误:', err);
            
            res.status(500).json({
                error: {
                    type: 'server_error',
                    message: '内部服务器错误'
                }
            });
        });
        
        // 启动服务器
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.config.port, this.config.host, () => {
                this.logger.info(`代理服务器已启动: http://${this.config.host}:${this.config.port}`);
                resolve();
            });
            
            this.server.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * 启动健康检查
     */
    startHealthCheck() {
        this.healthCheckTimer = setInterval(async () => {
            try {
                const response = await axios.get(`http://localhost:${this.config.port}/health`, {
                    timeout: 5000
                });
                
                this.state.isHealthy = response.data.status === 'healthy';
                this.emit('health-check', { healthy: this.state.isHealthy });
                
            } catch (error) {
                this.state.isHealthy = false;
                this.logger.warn('健康检查失败:', error.message);
                this.emit('health-check', { healthy: false, error: error.message });
                
                // 如果不健康且启用自动重启
                if (this.config.autoRestart && this.state.isRunning) {
                    await this.autoRestart();
                }
            }
        }, this.config.healthCheckInterval);
    }

    /**
     * 配置环境变量
     */
    async configureEnvironment() {
        const envVars = {
            ANTHROPIC_BASE_URL: `http://localhost:${this.config.port}/v1`,
            ANTHROPIC_API_KEY: 'proxy-key'
        };
        
        // 设置当前进程环境变量
        Object.assign(process.env, envVars);
        
        // 更新 shell 配置文件
        await this.updateShellConfig(envVars);
        
        this.logger.info('环境变量已配置');
        this.emit('environment-configured', envVars);
    }

    /**
     * 更新 shell 配置文件
     */
    async updateShellConfig(envVars) {
        const homeDir = os.homedir();
        const configFiles = [
            path.join(homeDir, '.zshrc'),
            path.join(homeDir, '.bashrc'),
            path.join(homeDir, '.profile')
        ];
        
        for (const configFile of configFiles) {
            try {
                const exists = await this.fileExists(configFile);
                if (exists) {
                    let content = await fs.readFile(configFile, 'utf8');
                    
                    // 检查是否已经添加过
                    const marker = '# Claude Code Proxy Pro Environment';
                    if (!content.includes(marker)) {
                        content += `\n${marker}\n`;
                        for (const [key, value] of Object.entries(envVars)) {
                            content += `export ${key}="${value}"\n`;
                        }
                        
                        await fs.writeFile(configFile, content, 'utf8');
                        this.logger.info(`已更新配置文件: ${configFile}`);
                    }
                }
            } catch (error) {
                this.logger.warn(`更新配置文件失败: ${configFile}`, error);
            }
        }
    }

    /**
     * 自动重启
     */
    async autoRestart() {
        this.logger.info('尝试自动重启代理服务...');
        
        for (let retry = 0; retry < this.config.maxRetries; retry++) {
            try {
                await this.stop();
                await this.sleep(this.config.retryDelay);
                await this.start();
                
                this.logger.info('代理服务重启成功');
                return { success: true };
                
            } catch (error) {
                this.logger.error(`重启尝试 ${retry + 1} 失败:`, error);
                
                if (retry === this.config.maxRetries - 1) {
                    this.emit('restart-failed', { 
                        attempts: this.config.maxRetries,
                        error: error.message 
                    });
                    return { success: false, error: error.message };
                }
            }
        }
    }

    /**
     * 停止代理服务
     */
    async stop() {
        this.logger.info('停止代理服务...');
        
        // 清除健康检查
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        
        // 关闭服务器
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve);
            });
            this.server = null;
        }
        
        // 停止代理进程
        if (this.proxyProcess) {
            this.proxyProcess.kill();
            this.proxyProcess = null;
        }
        
        this.state.isRunning = false;
        this.state.isHealthy = false;
        this.emit('stopped');
        
        this.logger.info('代理服务已停止');
    }

    /**
     * 获取运行时间
     */
    getUptime() {
        if (!this.state.startTime) return 0;
        return Math.floor((new Date() - this.state.startTime) / 1000);
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            running: this.state.isRunning,
            healthy: this.state.isHealthy,
            port: this.config.port,
            uptime: this.getUptime(),
            requests: this.state.requestCount,
            errors: this.state.errorCount,
            lastError: this.state.lastError,
            portConflicts: this.state.portConflicts
        };
    }

    /**
     * 辅助方法：检查命令
     */
    async checkCommand(command) {
        return new Promise((resolve) => {
            require('child_process').exec(command, (error) => {
                resolve(!error);
            });
        });
    }

    /**
     * 辅助方法：检查端口是否可用
     */
    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.once('error', () => resolve(false));
            server.once('listening', () => {
                server.close();
                resolve(true);
            });
            
            server.listen(port);
        });
    }

    /**
     * 辅助方法：获取占用端口的进程
     */
    async getPortProcess(port) {
        try {
            const platform = process.platform;
            let command;
            
            if (platform === 'darwin' || platform === 'linux') {
                command = `lsof -i :${port} -P -n | grep LISTEN`;
            } else if (platform === 'win32') {
                command = `netstat -ano | findstr :${port}`;
            }
            
            const output = await new Promise((resolve, reject) => {
                require('child_process').exec(command, (error, stdout) => {
                    if (error) resolve('');
                    else resolve(stdout);
                });
            });
            
            // 简单解析输出获取进程信息
            if (output) {
                const lines = output.trim().split('\n');
                if (lines.length > 0) {
                    // 这里需要根据不同平台解析
                    return {
                        name: 'node',
                        pid: parseInt(lines[0].split(/\s+/)[1] || 0),
                        command: lines[0]
                    };
                }
            }
            
            return null;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * 辅助方法：判断是否是我们的进程
     */
    isOurProcess(processInfo) {
        if (!processInfo) return false;
        
        const ourProcessNames = ['node', 'electron', 'claude-code-proxy'];
        return ourProcessNames.some(name => 
            processInfo.name.toLowerCase().includes(name) ||
            (processInfo.command && processInfo.command.toLowerCase().includes(name))
        );
    }

    /**
     * 辅助方法：杀死进程
     */
    async killProcess(pid) {
        if (!pid) return;
        
        try {
            process.kill(pid, 'SIGTERM');
            await this.sleep(1000);
            
            // 检查进程是否还在运行
            try {
                process.kill(pid, 0);
                // 如果还在运行，强制杀死
                process.kill(pid, 'SIGKILL');
            } catch {
                // 进程已经结束
            }
        } catch (error) {
            this.logger.warn(`无法杀死进程 ${pid}:`, error.message);
        }
    }

    /**
     * 辅助方法：检查文件是否存在
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 辅助方法：延迟
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = EnhancedProxyManager;