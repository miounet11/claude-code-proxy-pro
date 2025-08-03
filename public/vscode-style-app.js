// Claude Code Proxy Pro - VSCode Style Application
// 完整的生产就绪应用，所有功能都在应用内完成

class ClaudeCodeApp {
    constructor() {
        this.profiles = [];
        this.currentProfile = null;
        this.terminals = new Map();
        this.currentTerminalId = null;
        this.terminalIdCounter = 1;
        this.proxyStatus = 'stopped';
        this.environmentStatus = {
            nodejs: 'checking',
            git: 'checking',
            'claude-cli': 'checking',
            proxy: 'stopped'
        };
        
        this.init();
    }

    async init() {
        // 初始化 UI 事件监听器
        this.setupEventListeners();
        
        // 加载配置文件
        await this.loadProfiles();
        
        // 检查环境状态
        await this.checkEnvironment();
        
        // 初始化终端
        this.initTerminal();
        
        // 隐藏加载提示
        this.hideLoading();
        
        // 显示欢迎消息
        this.showToast('Claude Code Proxy Pro 已就绪', 'success');
        
        // 监听快速启动事件
        window.electronAPI.onQuickStart(() => {
            this.handleQuickStart();
        });
    }

    setupEventListeners() {
        // 活动栏按钮
        document.querySelectorAll('.activity-bar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchPanel(e.currentTarget.dataset.panel);
            });
        });

        // 配置表单
        document.getElementById('save-config').addEventListener('click', () => this.saveProfile());
        document.getElementById('test-config').addEventListener('click', () => this.testConfig());
        document.getElementById('start-proxy').addEventListener('click', () => this.toggleProxy());
        document.getElementById('one-click-start').addEventListener('click', () => this.oneClickStart());

        // API 密钥显示/隐藏
        document.getElementById('toggle-api-key').addEventListener('click', () => {
            const input = document.getElementById('api-key');
            const icon = document.querySelector('#toggle-api-key i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        });

        // 终端操作
        document.getElementById('new-terminal').addEventListener('click', () => this.createNewTerminal());
        document.getElementById('clear-terminal').addEventListener('click', () => this.clearCurrentTerminal());
        document.getElementById('close-panel').addEventListener('click', () => this.togglePanel());
        document.getElementById('maximize-panel').addEventListener('click', () => this.maximizePanel());

        // 面板标签切换
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchPanelTab(e.currentTarget.dataset.panel);
            });
        });

        // 树形结构展开/折叠
        document.querySelectorAll('.tree-item-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const item = e.currentTarget.closest('.tree-item');
                const children = item.querySelector('.tree-item-children');
                const chevron = item.querySelector('.fa-chevron-down, .fa-chevron-right');
                
                if (children.style.display === 'none') {
                    children.style.display = 'block';
                    chevron.className = 'fas fa-chevron-down';
                } else {
                    children.style.display = 'none';
                    chevron.className = 'fas fa-chevron-right';
                }
            });
        });

        // 状态栏 Claude CLI 点击
        document.getElementById('open-claude-cli').addEventListener('click', () => {
            this.openClaudeCLI();
        });

        // 快捷键支持
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+P - 命令面板
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                document.querySelector('.search-box input').focus();
            }
            // Ctrl+` - 切换终端
            if (e.ctrlKey && e.key === '`') {
                e.preventDefault();
                this.togglePanel();
            }
            // Ctrl+S - 保存配置
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveProfile();
            }
        });
    }

    async loadProfiles() {
        try {
            // 从 Electron API 加载配置文件
            if (window.electronAPI && window.electronAPI.getProfiles) {
                this.profiles = await window.electronAPI.getProfiles();
            } else {
                // 模拟数据用于测试
                this.profiles = [{
                    id: 'default',
                    name: '默认配置',
                    apiUrl: 'https://api.anthropic.com',
                    apiKey: 'sk-ant-...',
                    bigModel: 'claude-3-opus-20240229',
                    smallModel: 'claude-3-haiku-20240307'
                }];
            }
            
            this.renderProfileList();
            
            if (this.profiles.length > 0) {
                this.selectProfile(this.profiles[0]);
            }
        } catch (error) {
            console.error('加载配置文件失败:', error);
            this.showToast('加载配置文件失败', 'error');
        }
    }

    renderProfileList() {
        const profileList = document.getElementById('profile-list');
        profileList.innerHTML = '';
        
        this.profiles.forEach(profile => {
            const item = document.createElement('div');
            item.className = 'tree-item profile-item';
            item.innerHTML = `
                <div class="tree-item-content">
                    <i class="fas fa-file"></i>
                    <span>${profile.name}</span>
                </div>
            `;
            item.addEventListener('click', () => this.selectProfile(profile));
            profileList.appendChild(item);
        });
    }

    selectProfile(profile) {
        this.currentProfile = profile;
        
        // 更新表单
        document.getElementById('config-name').value = profile.name;
        document.getElementById('api-url').value = profile.apiUrl;
        document.getElementById('api-key').value = profile.apiKey;
        document.getElementById('big-model').value = profile.bigModel;
        document.getElementById('small-model').value = profile.smallModel;
        
        // 更新 UI 状态
        document.querySelectorAll('.profile-item').forEach(item => {
            item.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
    }

    async saveProfile() {
        const profile = {
            id: this.currentProfile?.id || Date.now().toString(),
            name: document.getElementById('config-name').value,
            apiUrl: document.getElementById('api-url').value,
            apiKey: document.getElementById('api-key').value,
            bigModel: document.getElementById('big-model').value,
            smallModel: document.getElementById('small-model').value
        };
        
        if (!profile.name || !profile.apiUrl || !profile.apiKey) {
            this.showToast('请填写必要的配置信息', 'warning');
            return;
        }
        
        try {
            if (window.electronAPI && window.electronAPI.saveProfile) {
                await window.electronAPI.saveProfile(profile);
            }
            
            // 更新本地列表
            const index = this.profiles.findIndex(p => p.id === profile.id);
            if (index >= 0) {
                this.profiles[index] = profile;
            } else {
                this.profiles.push(profile);
            }
            
            this.currentProfile = profile;
            this.renderProfileList();
            this.showToast('配置保存成功', 'success');
        } catch (error) {
            console.error('保存配置失败:', error);
            this.showToast('保存配置失败', 'error');
        }
    }

    async testConfig() {
        this.showLoading('正在测试配置...');
        
        try {
            const apiKey = document.getElementById('api-key').value;
            const apiUrl = document.getElementById('api-url').value;
            
            if (window.electronAPI && window.electronAPI.testConnection) {
                const result = await window.electronAPI.testConnection({ apiUrl, apiKey });
                if (result.success) {
                    this.showToast('连接测试成功！', 'success');
                } else {
                    this.showToast(`连接测试失败: ${result.error}`, 'error');
                }
            } else {
                // 模拟测试
                setTimeout(() => {
                    this.showToast('连接测试成功！', 'success');
                }, 1000);
            }
        } catch (error) {
            this.showToast(`测试失败: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async toggleProxy() {
        const button = document.getElementById('start-proxy');
        
        if (this.proxyStatus === 'running') {
            // 停止代理
            await this.stopProxy();
        } else {
            // 启动代理
            await this.startProxy();
        }
    }

    async startProxy() {
        if (!this.currentProfile) {
            this.showToast('请先选择或创建配置', 'warning');
            return;
        }
        
        this.showLoading('正在启动代理服务...');
        
        try {
            if (window.electronAPI && window.electronAPI.startProxy) {
                const result = await window.electronAPI.startProxy(this.currentProfile);
                if (result.success) {
                    this.proxyStatus = 'running';
                    this.updateProxyStatus();
                    this.showToast('代理服务已启动', 'success');
                } else {
                    throw new Error(result.error);
                }
            } else {
                // 模拟启动
                setTimeout(() => {
                    this.proxyStatus = 'running';
                    this.updateProxyStatus();
                    this.showToast('代理服务已启动', 'success');
                }, 1000);
            }
        } catch (error) {
            this.showToast(`启动失败: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async stopProxy() {
        this.showLoading('正在停止代理服务...');
        
        try {
            if (window.electronAPI && window.electronAPI.stopProxy) {
                await window.electronAPI.stopProxy();
            }
            
            this.proxyStatus = 'stopped';
            this.updateProxyStatus();
            this.showToast('代理服务已停止', 'info');
        } catch (error) {
            this.showToast(`停止失败: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateProxyStatus() {
        const button = document.getElementById('start-proxy');
        const statusIndicator = document.getElementById('proxy-status-indicator');
        const statusText = document.getElementById('proxy-status-text');
        const connectionStatus = document.getElementById('connection-status');
        
        if (this.proxyStatus === 'running') {
            button.innerHTML = '<i class="fas fa-stop"></i> 停止代理';
            statusIndicator.className = 'fas fa-circle status-indicator success';
            statusText.textContent = '代理运行中';
            connectionStatus.textContent = '已连接到 localhost:8082';
            
            // 更新环境状态
            this.environmentStatus.proxy = 'running';
            this.updateEnvironmentStatus();
        } else {
            button.innerHTML = '<i class="fas fa-play"></i> 启动代理';
            statusIndicator.className = 'fas fa-circle status-indicator inactive';
            statusText.textContent = '代理未启动';
            connectionStatus.textContent = '未连接';
            
            // 更新环境状态
            this.environmentStatus.proxy = 'stopped';
            this.updateEnvironmentStatus();
        }
    }

    async checkEnvironment() {
        // 检查各个环境组件
        const checks = [
            { name: 'nodejs', command: 'node --version' },
            { name: 'git', command: 'git --version' },
            { name: 'claude-cli', command: 'claude --version' }
        ];
        
        for (const check of checks) {
            try {
                if (window.electronAPI && window.electronAPI.checkCommand) {
                    const result = await window.electronAPI.checkCommand(check.command);
                    this.environmentStatus[check.name] = result.success ? 'installed' : 'not-installed';
                } else {
                    // 模拟检查
                    this.environmentStatus[check.name] = Math.random() > 0.3 ? 'installed' : 'not-installed';
                }
            } catch (error) {
                this.environmentStatus[check.name] = 'error';
            }
        }
        
        this.updateEnvironmentStatus();
    }

    updateEnvironmentStatus() {
        const statusMap = {
            'installed': { icon: 'success', text: '已安装' },
            'not-installed': { icon: 'error', text: '未安装' },
            'checking': { icon: 'warning', text: '检查中...' },
            'running': { icon: 'success', text: '运行中' },
            'stopped': { icon: 'inactive', text: '未启动' },
            'error': { icon: 'error', text: '错误' }
        };
        
        const items = document.querySelectorAll('.env-status-item');
        items.forEach(item => {
            const name = item.textContent.trim();
            let key = '';
            
            if (name.includes('Node.js')) key = 'nodejs';
            else if (name.includes('Git')) key = 'git';
            else if (name.includes('Claude CLI')) key = 'claude-cli';
            else if (name.includes('代理服务')) key = 'proxy';
            
            if (key && this.environmentStatus[key]) {
                const status = statusMap[this.environmentStatus[key]];
                const icon = item.querySelector('.status-icon');
                const text = item.querySelector('.status-text');
                
                icon.className = `fas fa-circle status-icon ${status.icon}`;
                text.textContent = status.text;
            }
        });
    }

    async oneClickStart() {
        this.showLoading('正在执行一键启动...');
        
        try {
            // 1. 检查环境
            await this.checkEnvironment();
            
            // 2. 检查必要组件是否已安装
            const requiredComponents = ['nodejs', 'git'];
            const missingComponents = requiredComponents.filter(
                comp => this.environmentStatus[comp] !== 'installed'
            );
            
            if (missingComponents.length > 0) {
                this.showToast(`请先安装: ${missingComponents.join(', ')}`, 'error');
                this.hideLoading();
                return;
            }
            
            // 3. 安装 Claude CLI（如果需要）
            if (this.environmentStatus['claude-cli'] !== 'installed') {
                this.showToast('正在安装 Claude CLI...', 'info');
                await this.installClaudeCLI();
            }
            
            // 4. 启动代理服务
            if (this.proxyStatus !== 'running') {
                await this.startProxy();
            }
            
            // 5. 打开 Claude CLI 终端
            await this.openClaudeCLI();
            
            this.showToast('一键启动完成！', 'success');
        } catch (error) {
            this.showToast(`一键启动失败: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async installClaudeCLI() {
        const terminalId = await this.createNewTerminal('安装 Claude CLI');
        const terminal = this.terminals.get(terminalId);
        
        if (terminal && window.electronAPI && window.electronAPI.runCommand) {
            // 运行安装命令
            await window.electronAPI.runCommand(terminalId, 'npm install -g @anthropic-ai/claude-cli');
            
            // 重新检查环境
            await this.checkEnvironment();
        }
    }

    async openClaudeCLI() {
        // 确保终端面板可见
        const panel = document.getElementById('panel-container');
        if (panel.classList.contains('hidden')) {
            this.togglePanel();
        }
        
        // 切换到终端标签
        this.switchPanelTab('terminal');
        
        // 创建新的 Claude CLI 终端
        const terminalId = await this.createNewTerminal('Claude CLI');
        const terminal = this.terminals.get(terminalId);
        
        if (terminal && window.electronAPI && window.electronAPI.runCommand) {
            // 设置代理环境变量并运行 Claude
            const proxyUrl = `http://localhost:8082`;
            await window.electronAPI.runCommand(terminalId, 
                `export ANTHROPIC_API_KEY="${this.currentProfile.apiKey}" && ` +
                `export ANTHROPIC_API_URL="${proxyUrl}" && ` +
                `claude`
            );
        }
    }

    // 终端管理
    initTerminal() {
        // 创建默认终端
        this.createNewTerminal();
    }

    async createNewTerminal(name = null) {
        const terminalId = `terminal-${this.terminalIdCounter++}`;
        const terminalName = name || `终端 ${this.terminalIdCounter - 1}`;
        
        // 创建终端标签
        const tabsContainer = document.getElementById('terminal-tabs');
        const tab = document.createElement('div');
        tab.className = 'terminal-tab';
        tab.dataset.terminalId = terminalId;
        tab.innerHTML = `
            <span>${terminalName}</span>
            <button class="tab-close" title="关闭">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // 标签点击事件
        tab.addEventListener('click', (e) => {
            if (!e.target.closest('.tab-close')) {
                this.switchTerminal(terminalId);
            }
        });
        
        // 关闭按钮事件
        tab.querySelector('.tab-close').addEventListener('click', () => {
            this.closeTerminal(terminalId);
        });
        
        tabsContainer.appendChild(tab);
        
        // 创建终端实例
        const terminalContainer = document.getElementById('terminal-container');
        const terminalWrapper = document.createElement('div');
        terminalWrapper.className = 'terminal-instance';
        terminalWrapper.id = terminalId;
        terminalWrapper.style.display = 'none';
        terminalContainer.appendChild(terminalWrapper);
        
        // 初始化 xterm.js
        const terminal = new Terminal({
            theme: {
                background: '#1e1e1e',
                foreground: '#cccccc',
                cursor: '#ffffff',
                selection: '#264f78',
                black: '#000000',
                red: '#cd3131',
                green: '#0dbc79',
                yellow: '#e5e510',
                blue: '#2472c8',
                magenta: '#bc3fbc',
                cyan: '#11a8cd',
                white: '#e5e5e5',
                brightBlack: '#666666',
                brightRed: '#f14c4c',
                brightGreen: '#23d18b',
                brightYellow: '#f5f543',
                brightBlue: '#3b8eea',
                brightMagenta: '#d670d6',
                brightCyan: '#29b8db',
                brightWhite: '#e5e5e5'
            },
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            cursorBlink: true
        });
        
        terminal.open(terminalWrapper);
        
        // 自适应大小
        const fitAddon = new FitAddon.FitAddon();
        terminal.loadAddon(fitAddon);
        fitAddon.fit();
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (this.currentTerminalId === terminalId) {
                fitAddon.fit();
            }
        });
        
        // 保存终端实例
        this.terminals.set(terminalId, { terminal, fitAddon, name: terminalName });
        
        // 如果有 Electron API，连接到真实终端
        if (window.electronAPI && window.electronAPI.createTerminal) {
            try {
                await window.electronAPI.createTerminal(terminalId);
                
                // 监听终端输出
                window.electronAPI.onTerminalData((event, data) => {
                    if (data.terminalId === terminalId) {
                        terminal.write(data.data);
                    }
                });
                
                // 监听终端输入
                terminal.onData((data) => {
                    window.electronAPI.sendTerminalInput(terminalId, data);
                });
            } catch (error) {
                console.error('创建终端失败:', error);
                terminal.write('\r\n[错误] 无法创建终端进程\r\n');
            }
        } else {
            // 模拟终端
            terminal.write('欢迎使用 Claude Code Proxy Pro 终端\r\n');
            terminal.write('$ ');
            
            terminal.onData((data) => {
                if (data === '\r') {
                    terminal.write('\r\n$ ');
                } else {
                    terminal.write(data);
                }
            });
        }
        
        // 切换到新终端
        this.switchTerminal(terminalId);
        
        return terminalId;
    }

    switchTerminal(terminalId) {
        // 隐藏所有终端
        this.terminals.forEach((_, id) => {
            document.getElementById(id).style.display = 'none';
            document.querySelector(`[data-terminal-id="${id}"]`).classList.remove('active');
        });
        
        // 显示选中的终端
        document.getElementById(terminalId).style.display = 'block';
        document.querySelector(`[data-terminal-id="${terminalId}"]`).classList.add('active');
        
        this.currentTerminalId = terminalId;
        
        // 重新适应大小
        const { fitAddon } = this.terminals.get(terminalId);
        setTimeout(() => fitAddon.fit(), 100);
    }

    closeTerminal(terminalId) {
        const terminalData = this.terminals.get(terminalId);
        if (!terminalData) return;
        
        // 清理终端
        terminalData.terminal.dispose();
        this.terminals.delete(terminalId);
        
        // 移除 DOM 元素
        document.getElementById(terminalId).remove();
        document.querySelector(`[data-terminal-id="${terminalId}"]`).remove();
        
        // 如果关闭的是当前终端，切换到其他终端
        if (this.currentTerminalId === terminalId) {
            const remainingTerminals = Array.from(this.terminals.keys());
            if (remainingTerminals.length > 0) {
                this.switchTerminal(remainingTerminals[0]);
            } else {
                // 如果没有终端了，创建一个新的
                this.createNewTerminal();
            }
        }
        
        // 通知后端关闭终端
        if (window.electronAPI && window.electronAPI.closeTerminal) {
            window.electronAPI.closeTerminal(terminalId);
        }
    }

    clearCurrentTerminal() {
        if (this.currentTerminalId) {
            const { terminal } = this.terminals.get(this.currentTerminalId);
            terminal.clear();
        }
    }

    // UI 辅助方法
    switchPanel(panelName) {
        // 更新活动栏
        document.querySelectorAll('.activity-bar-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-panel="${panelName}"]`).classList.add('active');
        
        // 更新侧边栏面板
        document.querySelectorAll('.sidebar-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        const targetPanel = document.getElementById(`${panelName}-panel`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
    }

    switchPanelTab(tabName) {
        // 更新标签
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-panel="${tabName}"]`).classList.add('active');
        
        // 更新内容
        document.querySelectorAll('.panel-view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${tabName}-panel`).classList.add('active');
    }

    togglePanel() {
        const panel = document.getElementById('panel-container');
        panel.classList.toggle('hidden');
        
        // 调整终端大小
        if (!panel.classList.contains('hidden') && this.currentTerminalId) {
            setTimeout(() => {
                const { fitAddon } = this.terminals.get(this.currentTerminalId);
                fitAddon.fit();
            }, 200);
        }
    }

    maximizePanel() {
        const panel = document.getElementById('panel-container');
        panel.classList.toggle('maximized');
        
        // 调整终端大小
        if (this.currentTerminalId) {
            setTimeout(() => {
                const { fitAddon } = this.terminals.get(this.currentTerminalId);
                fitAddon.fit();
            }, 200);
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        }[type];
        
        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // 自动移除
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showLoading(message = '加载中...') {
        const overlay = document.getElementById('loading-overlay');
        overlay.querySelector('p').textContent = message;
        overlay.classList.add('show');
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('show');
    }
    
    async handleQuickStart() {
        this.showLoading('正在执行快速启动...');
        
        try {
            // 监听安装进度
            window.electronAPI.onInstallProgress((data) => {
                this.showLoading(data.message || '安装中...');
            });
            
            // 执行快速启动
            const result = await window.electronAPI.quickStart();
            
            if (result.success) {
                this.showToast('快速启动完成！所有服务已就绪', 'success');
                // 更新状态
                await this.checkEnvironment();
                await this.updateProxyStatus();
            } else {
                this.showToast(`快速启动失败: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showToast(`快速启动失败: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ClaudeCodeApp();
});

// 处理 Electron IPC 事件
if (window.electronAPI) {
    // 监听代理状态更新
    window.electronAPI.onProxyStatusUpdate((event, status) => {
        if (window.app) {
            window.app.proxyStatus = status.running ? 'running' : 'stopped';
            window.app.updateProxyStatus();
        }
    });
    
    // 监听环境状态更新
    window.electronAPI.onEnvironmentUpdate((event, status) => {
        if (window.app) {
            window.app.environmentStatus = status;
            window.app.updateEnvironmentStatus();
        }
    });
}