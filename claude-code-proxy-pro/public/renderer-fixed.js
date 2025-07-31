// 环境状态显示功能的修复代码片段
// 这部分代码应该集成到 renderer-final.js 中

class EnvironmentStatusManager {
    constructor() {
        this.statusElements = {
            'nodejs': document.getElementById('nodejs-status'),
            'git': document.getElementById('git-status'),
            'uv': document.getElementById('uv-status'),
            'claude-code': document.getElementById('claude-code-status')
        };
        
        this.environmentData = {};
        this.isChecking = false;
    }
    
    // 检查环境状态（修复版）
    async checkEnvironments() {
        if (this.isChecking) return;
        
        this.isChecking = true;
        this.showCheckingState();
        
        try {
            if (window.electronAPI && window.electronAPI.checkEnvironments) {
                const result = await window.electronAPI.checkEnvironments();
                this.environmentData = result;
                this.updateEnvironmentStatus(result);
                this.bindEnvironmentInteractions();
            }
        } catch (error) {
            console.error('检查环境失败:', error);
            this.showErrorState(error);
        } finally {
            this.isChecking = false;
        }
    }
    
    // 显示检查中状态
    showCheckingState() {
        Object.values(this.statusElements).forEach(element => {
            if (element) {
                element.textContent = '⏳';
                element.className = 'env-status-icon checking';
                element.title = '正在检查...';
            }
        });
    }
    
    // 显示错误状态
    showErrorState(error) {
        Object.values(this.statusElements).forEach(element => {
            if (element) {
                element.textContent = '❌';
                element.className = 'env-status-icon error';
                element.title = `检测失败: ${error.message}`;
            }
        });
    }
    
    // 更新环境状态显示（修复版）
    updateEnvironmentStatus(envData) {
        // 遍历所有环境
        Object.entries(this.statusElements).forEach(([key, element]) => {
            if (!element || !envData[key]) return;
            
            const env = envData[key];
            
            // 清除所有状态类
            element.className = 'env-status-icon';
            
            if (env.installed) {
                // 已安装
                element.textContent = '✅';
                element.classList.add('installed');
                element.title = `已安装${env.version ? ' (v' + env.version + ')' : ''}`;
            } else {
                // 未安装
                element.textContent = '⬜';
                element.classList.add('missing');
                element.title = '未安装，点击查看安装方法';
                
                // 添加点击提示
                element.style.cursor = 'pointer';
            }
            
            // 如果有错误信息，添加到 title
            if (env.error) {
                element.title += ` - ${env.error}`;
            }
        });
    }
    
    // 绑定环境交互
    bindEnvironmentInteractions() {
        document.querySelectorAll('.env-item').forEach(item => {
            const envKey = item.dataset.env;
            const env = this.environmentData[envKey];
            
            if (!env) return;
            
            // 移除旧的事件监听器
            item.replaceWith(item.cloneNode(true));
            const newItem = document.querySelector(`[data-env="${envKey}"]`);
            
            // 添加悬停效果
            newItem.addEventListener('mouseenter', () => {
                if (!env.installed) {
                    this.showInstallTooltip(newItem, env);
                } else {
                    this.showVersionTooltip(newItem, env);
                }
            });
            
            newItem.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
            
            // 添加点击事件（仅未安装的环境）
            if (!env.installed) {
                newItem.style.cursor = 'pointer';
                newItem.addEventListener('click', () => {
                    this.showInstallDialog(env);
                });
            }
        });
    }
    
    // 显示安装提示
    showInstallTooltip(element, env) {
        const tooltip = this.createTooltip();
        tooltip.className = 'env-tooltip install-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <strong>${env.name} 未安装</strong>
            </div>
            <div class="tooltip-content">
                <p>点击查看安装方法</p>
                ${env.installCmd ? `<code>${env.installCmd}</code>` : ''}
            </div>
        `;
        
        this.positionTooltip(tooltip, element);
    }
    
    // 显示版本提示
    showVersionTooltip(element, env) {
        if (!env.version) return;
        
        const tooltip = this.createTooltip();
        tooltip.className = 'env-tooltip version-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-content">
                <strong>${env.name}</strong>
                <span>版本: ${env.version}</span>
            </div>
        `;
        
        this.positionTooltip(tooltip, element);
    }
    
    // 创建提示框
    createTooltip() {
        let tooltip = document.getElementById('env-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'env-tooltip';
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }
    
    // 定位提示框
    positionTooltip(tooltip, element) {
        const rect = element.getBoundingClientRect();
        tooltip.style.display = 'block';
        tooltip.style.left = rect.right + 10 + 'px';
        tooltip.style.top = rect.top + 'px';
    }
    
    // 隐藏提示框
    hideTooltip() {
        const tooltip = document.getElementById('env-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    // 显示安装对话框
    async showInstallDialog(env) {
        const dialog = document.createElement('div');
        dialog.className = 'install-dialog-overlay';
        dialog.innerHTML = `
            <div class="install-dialog">
                <h3>安装 ${env.name}</h3>
                <div class="install-options">
                    <div class="install-option">
                        <h4>方法 1: 自动安装</h4>
                        <p>点击下方按钮自动安装（需要管理员权限）</p>
                        <button class="btn btn-primary" id="autoInstallBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            一键安装
                        </button>
                    </div>
                    
                    <div class="install-option">
                        <h4>方法 2: 手动安装</h4>
                        <p>在终端中运行以下命令：</p>
                        <div class="code-block">
                            <code>${env.installCmd || '暂无安装命令'}</code>
                            <button class="copy-btn" data-command="${env.installCmd}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    ${env.installUrl ? `
                    <div class="install-option">
                        <h4>方法 3: 访问官网</h4>
                        <a href="${env.installUrl}" class="btn btn-secondary" id="visitWebsiteBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                            访问官网
                        </a>
                    </div>
                    ` : ''}
                    
                    ${env.dependsOn ? `
                    <div class="install-warning">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>注意：需要先安装 ${this.environmentData[env.dependsOn]?.name || env.dependsOn}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="dialog-actions">
                    <button class="btn btn-secondary" id="closeDialogBtn">关闭</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 绑定事件
        dialog.querySelector('#closeDialogBtn').addEventListener('click', () => {
            dialog.remove();
        });
        
        dialog.querySelector('#autoInstallBtn')?.addEventListener('click', async () => {
            await this.installEnvironment(env.key);
            dialog.remove();
        });
        
        dialog.querySelector('#visitWebsiteBtn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            if (window.electronAPI) {
                await window.electronAPI.openExternal(env.installUrl);
            }
        });
        
        dialog.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.dataset.command;
                navigator.clipboard.writeText(command);
                this.showToast('命令已复制到剪贴板', 'success');
            });
        });
        
        // 点击遮罩关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }
    
    // 安装环境
    async installEnvironment(key) {
        const statusElement = this.statusElements[key];
        if (!statusElement) return;
        
        // 显示安装中状态
        statusElement.textContent = '⏳';
        statusElement.className = 'env-status-icon installing';
        statusElement.title = '正在安装...';
        
        try {
            if (window.electronAPI && window.electronAPI.installEnvironment) {
                const result = await window.electronAPI.installEnvironment(key);
                
                if (result.success) {
                    // 安装成功
                    statusElement.textContent = '✅';
                    statusElement.className = 'env-status-icon installed';
                    statusElement.title = '安装成功';
                    
                    this.showToast(`${this.environmentData[key].name} 安装成功！`, 'success');
                    
                    // 重新检查所有环境状态
                    setTimeout(() => this.checkEnvironments(), 1000);
                } else {
                    // 安装失败
                    statusElement.textContent = '❌';
                    statusElement.className = 'env-status-icon error';
                    statusElement.title = `安装失败: ${result.error}`;
                    
                    this.showToast(`安装失败：${result.error}`, 'error');
                    
                    // 如果有依赖问题，提示用户
                    if (result.dependency) {
                        this.showDependencyAlert(result.dependency);
                    }
                }
            }
        } catch (error) {
            statusElement.textContent = '❌';
            statusElement.className = 'env-status-icon error';
            statusElement.title = `安装失败: ${error.message}`;
            
            this.showToast(`安装失败：${error.message}`, 'error');
        }
    }
    
    // 显示依赖提示
    showDependencyAlert(dependency) {
        const depEnv = this.environmentData[dependency];
        if (!depEnv) return;
        
        const alert = document.createElement('div');
        alert.className = 'dependency-alert';
        alert.innerHTML = `
            <div class="alert-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>需要先安装 ${depEnv.name}</span>
                <button class="btn btn-sm btn-primary" id="installDepBtn">立即安装</button>
            </div>
        `;
        
        document.body.appendChild(alert);
        
        alert.querySelector('#installDepBtn').addEventListener('click', () => {
            this.showInstallDialog(depEnv);
            alert.remove();
        });
        
        setTimeout(() => alert.remove(), 5000);
    }
    
    // 显示提示消息
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast show ${type}`;
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }
}

// 集成到 ProxyManager 类中的方法
// 在 ProxyManager 的 init 方法中添加：
// this.envStatusManager = new EnvironmentStatusManager();
// await this.envStatusManager.checkEnvironments();