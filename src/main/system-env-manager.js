const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { logger } = require('./logger');

/**
 * 系统环境变量管理器
 * 负责在系统级别设置环境变量
 */
class SystemEnvManager {
    constructor() {
        this.platform = process.platform;
        this.homeDir = os.homedir();
    }

    /**
     * 设置代理环境变量
     */
    async setProxyEnvironment(port = 8082) {
        try {
            logger.info('SystemEnv', 'Setting proxy environment variables', { port });

            const envVars = {
                ANTHROPIC_BASE_URL: `http://localhost:${port}/v1`,
                ANTHROPIC_API_KEY: 'proxy-key'
            };

            // 根据平台选择设置方法
            if (this.platform === 'darwin' || this.platform === 'linux') {
                await this.setUnixEnvironment(envVars);
            } else if (this.platform === 'win32') {
                await this.setWindowsEnvironment(envVars);
            }

            // 设置当前进程的环境变量（立即生效）
            Object.assign(process.env, envVars);

            logger.info('SystemEnv', 'Environment variables set successfully');
            return { success: true };
        } catch (error) {
            logger.error('SystemEnv', 'Failed to set environment variables', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * 清除代理环境变量
     */
    async clearProxyEnvironment() {
        try {
            logger.info('SystemEnv', 'Clearing proxy environment variables');

            if (this.platform === 'darwin' || this.platform === 'linux') {
                await this.clearUnixEnvironment();
            } else if (this.platform === 'win32') {
                await this.clearWindowsEnvironment();
            }

            // 清除当前进程的环境变量
            delete process.env.ANTHROPIC_BASE_URL;
            delete process.env.ANTHROPIC_API_KEY;
            delete process.env.ANTHROPIC_AUTH_TOKEN;

            logger.info('SystemEnv', 'Environment variables cleared successfully');
            return { success: true };
        } catch (error) {
            logger.error('SystemEnv', 'Failed to clear environment variables', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * 设置 Unix/Linux/macOS 环境变量
     */
    async setUnixEnvironment(envVars) {
        // 获取 shell 配置文件
        const shellConfigs = this.getShellConfigFiles();
        
        for (const configFile of shellConfigs) {
            if (fs.existsSync(configFile)) {
                try {
                    // 读取现有内容
                    let content = fs.readFileSync(configFile, 'utf8');
                    
                    // 移除旧的设置
                    content = this.removeOldSettings(content);
                    
                    // 添加新的设置
                    const envBlock = this.createEnvBlock(envVars);
                    content += '\n' + envBlock;
                    
                    // 写回文件
                    fs.writeFileSync(configFile, content);
                    logger.info('SystemEnv', 'Updated shell config', { file: configFile });
                } catch (error) {
                    logger.error('SystemEnv', 'Failed to update shell config', { 
                        file: configFile, 
                        error: error.message 
                    });
                }
            }
        }

        // 创建一个临时脚本来更新 launchctl (macOS)
        if (this.platform === 'darwin') {
            for (const [key, value] of Object.entries(envVars)) {
                await this.execPromise(`launchctl setenv ${key} "${value}"`);
            }
        }
    }

    /**
     * 设置 Windows 环境变量
     */
    async setWindowsEnvironment(envVars) {
        for (const [key, value] of Object.entries(envVars)) {
            // 设置用户环境变量
            await this.execPromise(`setx ${key} "${value}"`);
        }
    }

    /**
     * 清除 Unix/Linux/macOS 环境变量
     */
    async clearUnixEnvironment() {
        const shellConfigs = this.getShellConfigFiles();
        
        for (const configFile of shellConfigs) {
            if (fs.existsSync(configFile)) {
                try {
                    let content = fs.readFileSync(configFile, 'utf8');
                    content = this.removeOldSettings(content);
                    fs.writeFileSync(configFile, content);
                    logger.info('SystemEnv', 'Cleaned shell config', { file: configFile });
                } catch (error) {
                    logger.error('SystemEnv', 'Failed to clean shell config', { 
                        file: configFile, 
                        error: error.message 
                    });
                }
            }
        }

        // 清除 launchctl (macOS)
        if (this.platform === 'darwin') {
            await this.execPromise('launchctl unsetenv ANTHROPIC_BASE_URL');
            await this.execPromise('launchctl unsetenv ANTHROPIC_API_KEY');
            await this.execPromise('launchctl unsetenv ANTHROPIC_AUTH_TOKEN');
        }
    }

    /**
     * 清除 Windows 环境变量
     */
    async clearWindowsEnvironment() {
        // Windows 使用空值来删除环境变量
        await this.execPromise('setx ANTHROPIC_BASE_URL ""');
        await this.execPromise('setx ANTHROPIC_API_KEY ""');
        await this.execPromise('setx ANTHROPIC_AUTH_TOKEN ""');
    }

    /**
     * 获取 shell 配置文件列表
     */
    getShellConfigFiles() {
        const files = [];
        
        // 常见的 shell 配置文件
        const configs = [
            '.zshrc',
            '.bashrc',
            '.bash_profile',
            '.profile',
            '.zprofile'
        ];
        
        for (const config of configs) {
            const filePath = path.join(this.homeDir, config);
            files.push(filePath);
        }
        
        return files;
    }

    /**
     * 创建环境变量块
     */
    createEnvBlock(envVars) {
        const lines = [
            '',
            '# Claude Code Proxy Pro - Auto Generated',
            '# DO NOT EDIT THIS BLOCK MANUALLY',
            '# START_CLAUDE_PROXY_ENV'
        ];
        
        for (const [key, value] of Object.entries(envVars)) {
            lines.push(`export ${key}="${value}"`);
        }
        
        // 清除可能的冲突变量
        lines.push('unset ANTHROPIC_AUTH_TOKEN');
        
        lines.push('# END_CLAUDE_PROXY_ENV', '');
        
        return lines.join('\n');
    }

    /**
     * 移除旧的设置
     */
    removeOldSettings(content) {
        // 移除自动生成的块
        const blockPattern = /# START_CLAUDE_PROXY_ENV[\s\S]*?# END_CLAUDE_PROXY_ENV\n?/g;
        content = content.replace(blockPattern, '');
        
        // 移除单独的环境变量设置
        const patterns = [
            /export ANTHROPIC_BASE_URL=.*\n?/g,
            /export ANTHROPIC_API_KEY=.*\n?/g,
            /export ANTHROPIC_AUTH_TOKEN=.*\n?/g
        ];
        
        for (const pattern of patterns) {
            content = content.replace(pattern, '');
        }
        
        return content.trim();
    }

    /**
     * 执行命令的 Promise 包装
     */
    execPromise(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /**
     * 验证环境变量是否设置成功
     */
    async verifyEnvironment() {
        const results = {
            ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN
        };
        
        logger.info('SystemEnv', 'Environment verification', results);
        return results;
    }
}

module.exports = SystemEnvManager;