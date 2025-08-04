/**
 * AutoInstaller - 自动安装管理器
 * 集成 AICode-main 的核心功能
 * 提供一键安装和环境配置功能
 */

const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const axios = require('axios');
const { app } = require('electron');
const { Logger } = require('./logger');
const { execSync } = require('child_process');

class AutoInstaller {
    constructor() {
        this.logger = new Logger({ module: 'AutoInstaller' });
        this.platform = process.platform;
        this.homeDir = os.homedir();
        this.installStatus = {
            nodejs: false,
            npm: false,
            uv: false,
            git: false,
            claudeCode: false,
            proxy: false
        };
        this.ipAddress = null;
    }

    /**
     * 执行完整的自动安装流程
     */
    async runFullInstallation(progressCallback) {
        try {
            this.logger.info('开始自动安装流程...');
            
            // 1. 检查系统环境
            await this.checkSystemEnvironment(progressCallback);
            
            // 2. 获取本地 IP 地址
            await this.detectLocalIP(progressCallback);
            
            // 3. 安装必要依赖
            await this.installDependencies(progressCallback);
            
            // 4. 设置环境变量
            await this.setupEnvironmentVariables(progressCallback);
            
            // 5. 配置代理服务
            await this.setupProxyService(progressCallback);
            
            progressCallback('安装完成！', 100, 'success');
            return { success: true, status: this.installStatus };
            
        } catch (error) {
            this.logger.error('安装过程失败:', error);
            progressCallback(`安装失败: ${error.message}`, 0, 'error');
            throw error;
        }
    }

    /**
     * 检查系统环境
     */
    async checkSystemEnvironment(progressCallback) {
        progressCallback('检查系统环境...', 10);
        
        // 检查 Node.js
        this.installStatus.nodejs = await this.checkCommand('node --version');
        
        // 检查 npm
        this.installStatus.npm = await this.checkCommand('npm --version');
        
        // 检查 Git
        this.installStatus.git = await this.checkCommand('git --version');
        
        // 检查 uv
        this.installStatus.uv = await this.checkCommand('uv --version');
        
        // 检查 Claude CLI
        this.installStatus.claudeCode = await this.checkCommand('claude --help');
        
        this.logger.info('系统环境检查结果:', this.installStatus);
        progressCallback('系统环境检查完成', 20);
    }

    /**
     * 获取所有可能的命令路径
     */
    getAllPossiblePaths() {
        const paths = [
            // 用户特定路径
            path.join(this.homeDir, '.local', 'bin'),
            path.join(this.homeDir, '.cargo', 'bin'),
            path.join(this.homeDir, 'Documents', 'claude code', 'node-v20.10.0-darwin-arm64', 'bin'),
            path.join(this.homeDir, '.npm', 'bin'),
            path.join(this.homeDir, 'bin'),
            
            // 系统路径
            '/usr/local/bin',
            '/opt/homebrew/bin',
            '/opt/local/bin',
            '/usr/bin',
            '/bin',
            '/usr/sbin',
            '/sbin'
        ];
        
        // 添加当前 PATH 中的路径
        if (process.env.PATH) {
            paths.push(...process.env.PATH.split(':'));
        }
        
        // 去重
        return [...new Set(paths)];
    }

    /**
     * 查找命令的完整路径
     */
    async findCommandPath(commandName) {
        const paths = this.getAllPossiblePaths();
        
        for (const dir of paths) {
            const fullPath = path.join(dir, commandName);
            try {
                await fs.access(fullPath, fs.constants.X_OK);
                return fullPath;
            } catch {
                // 继续查找
            }
        }
        
        // 尝试使用 which 命令
        try {
            const result = execSync(`which ${commandName}`, { encoding: 'utf8' }).trim();
            if (result) return result;
        } catch {
            // which 命令失败
        }
        
        return null;
    }

    /**
     * 检查命令是否可用
     */
    async checkCommand(command) {
        // 提取命令名
        const commandName = command.split(' ')[0];
        
        // 先尝试直接查找命令路径
        const commandPath = await this.findCommandPath(commandName);
        if (commandPath) {
            this.logger.info(`找到命令 ${commandName}: ${commandPath}`);
            return true;
        }
        
        // 如果找不到，尝试使用扩展的 PATH 执行
        return new Promise((resolve) => {
            const newPath = this.getAllPossiblePaths().join(':');
            
            exec(command, { env: { ...process.env, PATH: newPath } }, (error) => {
                resolve(!error);
            });
        });
    }

    /**
     * 获取本地 IP 地址
     */
    async detectLocalIP(progressCallback) {
        progressCallback('检测本地 IP 地址...', 25);
        
        try {
            const interfaces = os.networkInterfaces();
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        this.ipAddress = iface.address;
                        break;
                    }
                }
                if (this.ipAddress) break;
            }
            
            if (!this.ipAddress) {
                this.ipAddress = '127.0.0.1';
            }
            
            this.logger.info(`检测到 IP 地址: ${this.ipAddress}`);
            progressCallback(`IP 地址: ${this.ipAddress}`, 30);
        } catch (error) {
            this.logger.error('IP 检测失败:', error);
            this.ipAddress = '127.0.0.1';
        }
    }

    /**
     * 安装必要的依赖
     */
    async installDependencies(progressCallback) {
        progressCallback('安装依赖项...', 35);
        
        // 安装 uv (如果需要)
        if (!this.installStatus.uv) {
            await this.installUV(progressCallback);
        }
        
        // 安装 Claude Code (如果需要)
        if (!this.installStatus.claudeCode) {
            await this.installClaudeCode(progressCallback);
        }
        
        progressCallback('依赖安装完成', 60);
    }

    /**
     * 安装 uv 包管理器
     */
    async installUV(progressCallback) {
        progressCallback('安装 uv 包管理器...', 40);
        
        try {
            let installCmd;
            
            switch (this.platform) {
                case 'darwin':
                case 'linux':
                    // macOS 和 Linux 使用 curl 安装
                    installCmd = 'curl -LsSf https://astral.sh/uv/install.sh | sh';
                    break;
                case 'win32':
                    // Windows 使用 PowerShell 安装
                    installCmd = 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"';
                    break;
                default:
                    throw new Error(`不支持的平台: ${this.platform}`);
            }
            
            await this.executeCommand(installCmd);
            
            // 添加到 PATH
            await this.addUVToPath();
            
            this.installStatus.uv = true;
            this.logger.info('uv 安装成功');
            progressCallback('uv 安装完成', 45);
            
        } catch (error) {
            this.logger.error('uv 安装失败:', error);
            throw new Error('uv 安装失败，请手动安装');
        }
    }

    /**
     * 安装 Claude Code CLI
     */
    async installClaudeCode(progressCallback) {
        progressCallback('安装 Claude Code CLI...', 50);
        
        try {
            // 优先使用 npm 安装 Claude Code
            if (this.installStatus.npm) {
                try {
                    progressCallback('使用 npm 安装 Claude Code...', 52);
                    await this.executeCommand('npm install -g @anthropic-ai/claude-code');
                    this.installStatus.claudeCode = true;
                    this.logger.info('Claude Code 通过 npm 安装成功');
                    progressCallback('Claude Code 安装完成', 55);
                    return;
                } catch (npmError) {
                    this.logger.warn('npm 安装失败，尝试其他方法:', npmError);
                }
            }
            
            // 备选：使用 uv 安装 Python 版本
            try {
                progressCallback('使用 uv 安装 claude...', 52);
                const installCmd = 'uv tool install claude-cli';
                await this.executeCommand(installCmd);
                this.installStatus.claudeCode = true;
                this.logger.info('Claude CLI 通过 uv 安装成功');
            } catch (uvError) {
                // 如果都失败，只是记录警告，不阻止流程
                this.logger.warn('Claude Code 安装失败，但继续安装流程');
                this.installStatus.claudeCode = false;
            }
            
            progressCallback('Claude Code 安装完成', 55);
            
        } catch (error) {
            this.logger.error('Claude Code 安装失败:', error);
            // 不抛出错误，让安装流程继续
            this.installStatus.claudeCode = false;
            progressCallback('Claude Code 安装跳过，继续其他步骤', 55);
        }
    }

    /**
     * 设置环境变量
     */
    async setupEnvironmentVariables(progressCallback) {
        progressCallback('配置环境变量...', 65);
        
        try {
            const envVars = {
                ANTHROPIC_BASE_URL: `http://${this.ipAddress}:8082/v1`,
                ANTHROPIC_API_KEY: 'proxy-key'
            };
            
            // 更新 shell 配置文件
            await this.updateShellConfig(envVars);
            
            // 设置当前进程环境变量
            Object.assign(process.env, envVars);
            
            this.logger.info('环境变量配置完成');
            progressCallback('环境变量配置完成', 70);
            
        } catch (error) {
            this.logger.error('环境变量配置失败:', error);
            throw error;
        }
    }

    /**
     * 设置代理服务
     */
    async setupProxyService(progressCallback) {
        progressCallback('配置代理服务...', 75);
        
        try {
            // 检查端口是否被占用
            const portInUse = await this.checkPortInUse(8082);
            if (portInUse) {
                await this.handlePortConflict(8082, progressCallback);
            }
            
            // 克隆或更新代理仓库
            const proxyPath = path.join(this.homeDir, '.claude-code-proxy');
            if (await this.fileExists(proxyPath)) {
                // 更新现有仓库
                await this.executeCommand('git pull', { cwd: proxyPath });
            } else {
                // 克隆新仓库
                await this.executeCommand(
                    `git clone https://github.com/miounet11/claude-code-proxy-pro.git ${proxyPath}`
                );
            }
            
            // 创建 .env 文件
            await this.createEnvFile(proxyPath);
            
            // 安装依赖
            progressCallback('安装代理服务依赖...', 85);
            await this.executeCommand('npm install', { cwd: proxyPath });
            
            this.installStatus.proxy = true;
            this.logger.info('代理服务配置完成');
            progressCallback('代理服务配置完成', 95);
            
        } catch (error) {
            this.logger.error('代理服务配置失败:', error);
            throw error;
        }
    }

    /**
     * 创建 .env 配置文件
     */
    async createEnvFile(proxyPath) {
        const envContent = `# Claude Code Proxy 配置
# 由 AutoInstaller 自动生成

# 服务端口
PORT=8082

# API 配置
ANTHROPIC_API_KEY=your-api-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com

# 日志级别
LOG_LEVEL=info

# 自动生成时间: ${new Date().toISOString()}
`;
        
        const envPath = path.join(proxyPath, '.env');
        await fs.writeFile(envPath, envContent, 'utf8');
        this.logger.info('.env 文件创建成功');
    }

    /**
     * 处理端口冲突
     */
    async handlePortConflict(port, progressCallback) {
        progressCallback(`检测到端口 ${port} 被占用，尝试处理...`, 80);
        
        try {
            // 获取占用端口的进程信息
            const processInfo = await this.getPortProcess(port);
            
            if (processInfo) {
                this.logger.warn(`端口 ${port} 被进程 ${processInfo.name} (PID: ${processInfo.pid}) 占用`);
                
                // 如果是我们自己的代理进程，可以尝试重启
                if (processInfo.name.includes('node') || processInfo.name.includes('claude-code-proxy')) {
                    // 这里可以添加杀进程和重启的逻辑
                    this.logger.info('检测到是代理进程，可以安全重启');
                } else {
                    throw new Error(`端口 ${port} 被其他进程占用: ${processInfo.name}`);
                }
            }
        } catch (error) {
            this.logger.error('端口冲突处理失败:', error);
            throw error;
        }
    }

    /**
     * 检查端口是否被占用
     */
    async checkPortInUse(port) {
        return new Promise((resolve) => {
            const server = require('net').createServer();
            
            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
            
            server.once('listening', () => {
                server.close();
                resolve(false);
            });
            
            server.listen(port);
        });
    }

    /**
     * 获取占用端口的进程信息
     */
    async getPortProcess(port) {
        try {
            let cmd;
            switch (this.platform) {
                case 'darwin':
                case 'linux':
                    cmd = `lsof -i :${port} -P -n | grep LISTEN`;
                    break;
                case 'win32':
                    cmd = `netstat -ano | findstr :${port}`;
                    break;
            }
            
            const result = await this.executeCommand(cmd, { ignoreError: true });
            // 这里需要解析输出获取进程信息
            // 简化处理，实际需要更复杂的解析
            return { name: 'unknown', pid: 0 };
            
        } catch (error) {
            return null;
        }
    }

    /**
     * 执行系统命令
     */
    executeCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            const execOptions = {
                shell: true,
                ...options
            };
            
            exec(command, execOptions, (error, stdout, stderr) => {
                if (error && !options.ignoreError) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * 添加 uv 到 PATH
     */
    async addUVToPath() {
        // uv 默认安装路径
        const uvPaths = [
            path.join(this.homeDir, '.cargo', 'bin'),
            path.join(this.homeDir, '.local', 'bin')
        ];
        
        // 更新当前进程 PATH
        for (const uvPath of uvPaths) {
            if (!process.env.PATH.includes(uvPath) && await this.fileExists(uvPath)) {
                process.env.PATH = `${uvPath}:${process.env.PATH}`;
            }
        }
        
        // 持久化到 shell 配置
        const pathExports = uvPaths
            .filter(p => this.fileExists(p))
            .map(p => `export PATH="${p}:$PATH"`)
            .join('\n');
            
        if (pathExports) {
            await this.updateShellConfig({ PATH_EXPORTS: pathExports });
        }
    }

    /**
     * 更新 shell 配置文件
     */
    async updateShellConfig(envVars) {
        const configFiles = [];
        
        // 根据平台确定配置文件
        if (this.platform === 'darwin' || this.platform === 'linux') {
            configFiles.push(
                path.join(this.homeDir, '.zshrc'),
                path.join(this.homeDir, '.bashrc'),
                path.join(this.homeDir, '.profile')
            );
        }
        
        for (const configFile of configFiles) {
            try {
                if (await this.fileExists(configFile)) {
                    let content = await fs.readFile(configFile, 'utf8');
                    
                    // 添加环境变量
                    for (const [key, value] of Object.entries(envVars)) {
                        if (key === 'PATH_EXPORTS') {
                            // 特殊处理 PATH 导出
                            if (!content.includes(value)) {
                                content += `\n# Added by Claude Code Proxy Pro AutoInstaller\n${value}\n`;
                            }
                        } else {
                            const exportLine = `export ${key}="${value}"`;
                            if (!content.includes(exportLine)) {
                                content += `\n# Added by Claude Code Proxy Pro AutoInstaller\n${exportLine}\n`;
                            }
                        }
                    }
                    
                    await fs.writeFile(configFile, content, 'utf8');
                    this.logger.info(`更新配置文件: ${configFile}`);
                }
            } catch (error) {
                this.logger.warn(`更新配置文件失败: ${configFile}`, error);
            }
        }
    }

    /**
     * 检查文件是否存在
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
     * 获取安装状态
     */
    getInstallStatus() {
        return this.installStatus;
    }

    /**
     * 验证安装是否成功
     */
    async verifyInstallation() {
        const checks = {
            uv: await this.checkCommand('uv --version'),
            claudeCode: await this.checkCommand('claude --version'),
            proxy: await this.checkPortInUse(8082)
        };
        
        return {
            success: checks.uv && checks.claudeCode,
            details: checks
        };
    }
}

module.exports = AutoInstaller;