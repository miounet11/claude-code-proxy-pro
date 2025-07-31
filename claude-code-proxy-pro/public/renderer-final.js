// Claude Code Proxy Pro - 新版渲染进程
class ProxyManager {
    constructor() {
        this.profiles = [];
        this.currentProfileId = null;
        this.maxProfiles = 10;
        this.defaultProfile = {
            id: 'default',
            name: '免费配置',
            apiUrl: 'http://www.miaoda.vip/v1',
            apiKey: '',
            bigModel: 'claude-3-7-sonnet-20250219',
            smallModel: 'claude-3-5-haiku-20241022',
            proxyPort: 8082,
            isDefault: true
        };
        
        this.elements = {};
        this.isProxyRunning = false;
        
        this.init();
    }
    
    async init() {
        await this.waitForDOM();
        
        // 初始化国际化
        await window.i18n.init();
        
        this.cacheElements();
        this.bindEvents();
        await this.loadProfiles();
        this.updateUI();
        await this.checkEnvironments();
        await this.checkProxyStatus();
        
        // 创建语言选择器
        this.createLanguageSelector();
    }
    
    waitForDOM() {
        return new Promise(resolve => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }
    
    cacheElements() {
        // 侧边栏元素
        this.elements.profileList = document.getElementById('profileList');
        this.elements.addProfileBtn = document.getElementById('addProfileBtn');
        this.elements.version = document.getElementById('version');
        this.elements.proxyStatus = document.getElementById('proxyStatus');
        this.elements.proxyStatusDot = document.getElementById('proxyStatusDot');
        this.elements.currentApiUrl = document.getElementById('currentApiUrl');
        this.elements.envStatus = document.getElementById('envStatus');
        
        // 配置表单元素
        this.elements.currentProfileName = document.getElementById('currentProfileName');
        this.elements.configForm = document.getElementById('configForm');
        this.elements.emptyState = document.getElementById('emptyState');
        this.elements.configName = document.getElementById('configName');
        this.elements.apiUrl = document.getElementById('apiUrl');
        this.elements.apiKey = document.getElementById('apiKey');
        this.elements.proxyPort = document.getElementById('proxyPort') || { value: '8082' }; // 默认端口
        this.elements.bigModel = document.getElementById('bigModel');
        this.elements.smallModel = document.getElementById('smallModel');
        this.elements.customBigModel = document.getElementById('customBigModel');
        this.elements.customSmallModel = document.getElementById('customSmallModel');
        this.elements.toggleApiKey = document.getElementById('toggleApiKey');
        
        // 操作按钮
        this.elements.testConfigBtn = document.getElementById('testConfigBtn');
        this.elements.startProxyBtn = document.getElementById('startProxyBtn');
        this.elements.saveProfileBtn = document.getElementById('saveProfileBtn');
        this.elements.deleteProfileBtn = document.getElementById('deleteProfileBtn');
        this.elements.openTerminalBtn = document.getElementById('openTerminalBtn');
        this.elements.exportScriptBtn = document.getElementById('exportScriptBtn');
        this.elements.startClaudeCodeBtn = document.getElementById('startClaudeCodeBtn');
        this.elements.restoreOfficialBtn = document.getElementById('restoreOfficialBtn');
        
        // 其他元素
        this.elements.toast = document.getElementById('toast');
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');
    }
    
    bindEvents() {
        // 配置文件操作
        this.elements.addProfileBtn.addEventListener('click', () => this.createNewProfile());
        this.elements.saveProfileBtn.addEventListener('click', () => this.saveCurrentProfile());
        this.elements.deleteProfileBtn.addEventListener('click', () => this.deleteCurrentProfile());
        
        // 代理操作
        this.elements.testConfigBtn.addEventListener('click', () => this.testConfiguration());
        this.elements.startProxyBtn.addEventListener('click', () => this.toggleProxy());
        
        // 密钥显示切换
        this.elements.toggleApiKey.addEventListener('click', () => this.toggleApiKeyVisibility());
        
        // 模型选择
        this.elements.bigModel.addEventListener('change', (e) => this.handleModelChange(e, 'big'));
        this.elements.smallModel.addEventListener('change', (e) => this.handleModelChange(e, 'small'));
        
        // 快速操作
        this.elements.openTerminalBtn.addEventListener('click', () => this.openTerminal());
        this.elements.exportScriptBtn.addEventListener('click', () => this.exportScript());
        this.elements.startClaudeCodeBtn.addEventListener('click', () => this.startClaudeCode());
        this.elements.restoreOfficialBtn.addEventListener('click', () => this.restoreOfficialSettings());
        
        // 监听主进程消息
        if (window.electronAPI) {
            window.electronAPI.onProxyStatus((status) => this.updateProxyStatus(status));
            window.electronAPI.onToast((data) => this.showToast(data.message, data.type));
        }
    }
    
    async loadProfiles() {
        try {
            // 从主进程加载配置
            if (window.electronAPI && window.electronAPI.loadProfiles) {
                const savedProfiles = await window.electronAPI.loadProfiles();
                if (savedProfiles && savedProfiles.length > 0) {
                    this.profiles = savedProfiles;
                } else {
                    // 如果没有保存的配置，添加默认配置
                    this.profiles = [this.defaultProfile];
                }
            } else {
                // 如果API不可用，使用默认配置
                this.profiles = [this.defaultProfile];
            }
            
            // 设置当前配置
            if (this.profiles.length > 0) {
                this.currentProfileId = this.profiles[0].id;
            }
        } catch (error) {
            console.error('加载配置失败:', error);
            this.profiles = [this.defaultProfile];
            this.currentProfileId = this.defaultProfile.id;
        }
    }
    
    updateUI() {
        this.renderProfileList();
        this.renderCurrentProfile();
        this.updateVersion();
    }
    
    renderProfileList() {
        this.elements.profileList.innerHTML = '';
        
        this.profiles.forEach(profile => {
            const li = document.createElement('li');
            li.className = 'profile-item';
            if (profile.id === this.currentProfileId) {
                li.classList.add('active');
            }
            
            li.innerHTML = `
                <div class="profile-info">
                    <div class="profile-name">${this.escapeHtml(profile.name)}</div>
                    <div class="profile-status">
                        <span class="status-dot"></span>
                        <span>${profile.isDefault ? '免费' : profile.apiUrl.split('/')[2]}</span>
                    </div>
                </div>
            `;
            
            li.addEventListener('click', () => this.selectProfile(profile.id));
            this.elements.profileList.appendChild(li);
        });
    }
    
    renderCurrentProfile() {
        const profile = this.getCurrentProfile();
        
        if (!profile) {
            this.elements.configForm.style.display = 'none';
            this.elements.emptyState.style.display = 'flex';
            return;
        }
        
        this.elements.configForm.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        
        // 更新表单值
        this.elements.currentProfileName.textContent = profile.name;
        this.elements.configName.value = profile.name;
        this.elements.apiUrl.value = profile.apiUrl;
        this.elements.apiKey.value = profile.apiKey;
        this.elements.proxyPort.value = profile.proxyPort;
        
        // 更新模型选择
        this.updateModelSelect('big', profile.bigModel);
        this.updateModelSelect('small', profile.smallModel);
        
        // 默认配置不能删除
        this.elements.deleteProfileBtn.disabled = profile.isDefault;
    }
    
    updateModelSelect(type, value) {
        const select = type === 'big' ? this.elements.bigModel : this.elements.smallModel;
        const customInput = type === 'big' ? this.elements.customBigModel : this.elements.customSmallModel;
        
        // 检查是否是预设值
        const isPreset = Array.from(select.options).some(option => 
            option.value === value && option.value !== 'custom'
        );
        
        if (isPreset) {
            select.value = value;
            customInput.style.display = 'none';
            customInput.value = '';
        } else {
            select.value = 'custom';
            customInput.style.display = 'block';
            customInput.value = value;
        }
    }
    
    handleModelChange(event, type) {
        const customInput = type === 'big' ? this.elements.customBigModel : this.elements.customSmallModel;
        
        if (event.target.value === 'custom') {
            customInput.style.display = 'block';
            customInput.focus();
        } else {
            customInput.style.display = 'none';
            customInput.value = '';
        }
    }
    
    getCurrentProfile() {
        return this.profiles.find(p => p.id === this.currentProfileId);
    }
    
    selectProfile(profileId) {
        this.currentProfileId = profileId;
        this.updateUI();
    }
    
    createNewProfile() {
        if (this.profiles.length >= this.maxProfiles) {
            this.showToast(`最多只能创建 ${this.maxProfiles} 个配置文件`, 'warning');
            return;
        }
        
        const newProfile = {
            id: `profile_${Date.now()}`,
            name: `配置 ${this.profiles.length + 1}`,
            apiUrl: 'https://api.openai.com/v1',
            apiKey: '',
            bigModel: 'gpt-4-turbo-preview',
            smallModel: 'gpt-3.5-turbo',
            proxyPort: 8082 + this.profiles.length,
            isDefault: false
        };
        
        this.profiles.push(newProfile);
        this.currentProfileId = newProfile.id;
        this.updateUI();
        this.saveProfiles();
        
        // 聚焦到配置名称输入框
        setTimeout(() => {
            this.elements.configName.focus();
            this.elements.configName.select();
        }, 100);
    }
    
    async saveCurrentProfile() {
        const profile = this.getCurrentProfile();
        if (!profile) return;
        
        // 获取表单值
        const name = this.elements.configName.value.trim();
        const apiUrl = this.elements.apiUrl.value.trim();
        const apiKey = this.elements.apiKey.value.trim();
        const proxyPort = 8082; // 使用固定端口
        
        // 获取模型值
        let bigModel = this.elements.bigModel.value;
        if (bigModel === 'custom') {
            bigModel = this.elements.customBigModel.value.trim();
        }
        
        let smallModel = this.elements.smallModel.value;
        if (smallModel === 'custom') {
            smallModel = this.elements.customSmallModel.value.trim();
        }
        
        // 验证
        if (!name) {
            this.showToast('请输入配置名称', 'error');
            return;
        }
        
        if (!apiUrl) {
            this.showToast('请输入API地址', 'error');
            return;
        }
        
        if (!apiKey) {
            this.showToast('请输入API密钥', 'error');
            return;
        }
        
        if (!proxyPort || proxyPort < 1024 || proxyPort > 65535) {
            this.showToast('代理端口必须在 1024-65535 之间', 'error');
            return;
        }
        
        if (!bigModel || !smallModel) {
            this.showToast('请选择或输入模型名称', 'error');
            return;
        }
        
        // 更新配置
        profile.name = name;
        profile.apiUrl = apiUrl;
        profile.apiKey = apiKey;
        profile.proxyPort = proxyPort;
        profile.bigModel = bigModel;
        profile.smallModel = smallModel;
        
        // 保存到主进程
        await this.saveProfiles();
        this.updateUI();
        this.showToast('配置已保存', 'success');
    }
    
    async deleteCurrentProfile() {
        const profile = this.getCurrentProfile();
        if (!profile || profile.isDefault) return;
        
        const confirmed = await this.showConfirm(`确定要删除配置 "${profile.name}" 吗？`);
        if (!confirmed) return;
        
        // 删除配置
        this.profiles = this.profiles.filter(p => p.id !== profile.id);
        
        // 选择第一个配置
        if (this.profiles.length > 0) {
            this.currentProfileId = this.profiles[0].id;
        } else {
            this.currentProfileId = null;
        }
        
        await this.saveProfiles();
        this.updateUI();
        this.showToast('配置已删除', 'success');
    }
    
    async saveProfiles() {
        if (window.electronAPI && window.electronAPI.saveProfiles) {
            try {
                await window.electronAPI.saveProfiles(this.profiles);
            } catch (error) {
                console.error('保存配置失败:', error);
                this.showToast('保存配置失败', 'error');
            }
        }
    }
    
    async testConfiguration() {
        const profile = this.getCurrentProfile();
        if (!profile) return;
        
        this.showLoading(true);
        
        try {
            if (window.electronAPI && window.electronAPI.testConfig) {
                const result = await window.electronAPI.testConfig({
                    apiUrl: profile.apiUrl,
                    apiKey: profile.apiKey,
                    model: profile.smallModel
                });
                
                if (result.success) {
                    this.showToast('配置测试成功！API连接正常', 'success');
                } else {
                    this.showToast(`配置测试失败：${result.error}`, 'error');
                }
            } else {
                // 模拟测试
                setTimeout(() => {
                    this.showLoading(false);
                    this.showToast('配置测试成功！', 'success');
                }, 1000);
            }
        } catch (error) {
            this.showToast(`测试失败：${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    async toggleProxy() {
        const profile = this.getCurrentProfile();
        if (!profile) return;
        
        if (this.isProxyRunning) {
            // 停止代理
            if (window.electronAPI && window.electronAPI.stopProxy) {
                await window.electronAPI.stopProxy();
            }
            this.isProxyRunning = false;
            this.updateProxyStatus(false);
            this.showToast('代理已停止', 'info');
        } else {
            // 启动代理
            this.showLoading(true);
            
            try {
                if (window.electronAPI && window.electronAPI.startProxy) {
                    const result = await window.electronAPI.startProxy({
                        apiUrl: profile.apiUrl,
                        apiKey: profile.apiKey,
                        bigModel: profile.bigModel,
                        smallModel: profile.smallModel,
                        proxyPort: profile.proxyPort
                    });
                    
                    if (result.success) {
                        this.isProxyRunning = true;
                        this.updateProxyStatus(true);
                        this.showToast(`代理已启动，端口：${result.port || profile.proxyPort}`, 'success');
                        
                        // 显示使用说明并询问是否打开终端
                        setTimeout(() => {
                            this.showProxyGuide(result.port || profile.proxyPort);
                        }, 500);
                    } else {
                        this.showToast(`启动失败：${result.error}`, 'error');
                    }
                } else {
                    // 模拟启动
                    setTimeout(() => {
                        this.isProxyRunning = true;
                        this.updateProxyStatus(true);
                        this.showLoading(false);
                        this.showToast(`代理已启动，端口：${profile.proxyPort}`, 'success');
                    }, 1000);
                }
            } catch (error) {
                this.showToast(`启动失败：${error.message}`, 'error');
            } finally {
                this.showLoading(false);
            }
        }
    }
    
    updateProxyStatus(isRunning) {
        this.isProxyRunning = isRunning;
        
        // 更新代理状态显示
        if (this.elements.proxyStatusDot) {
            if (isRunning) {
                this.elements.proxyStatusDot.classList.add('active');
            } else {
                this.elements.proxyStatusDot.classList.remove('active');
            }
        }
        
        // 更新当前API URL显示
        if (this.elements.currentApiUrl) {
            const profile = this.getCurrentProfile();
            if (isRunning && profile) {
                this.elements.currentApiUrl.textContent = profile.apiUrl;
            } else {
                this.elements.currentApiUrl.textContent = '未启动';
            }
        }
        
        // 更新按钮
        const btnText = this.elements.startProxyBtn.querySelector('span:last-child');
        if (btnText) {
            this.elements.startProxyBtn.innerHTML = isRunning ? 
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>停止代理' : 
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>启动代理';
        }
    }
    
    toggleApiKeyVisibility() {
        const input = this.elements.apiKey;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        
        // 更新图标
        this.elements.toggleApiKey.innerHTML = isPassword ? 
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>' :
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    }
    
    async openTerminal() {
        try {
            if (window.electronAPI && window.electronAPI.openTerminal) {
                const result = await window.electronAPI.openTerminal();
                if (!result || !result.success) {
                    this.showToast('打开终端失败', 'error');
                }
            } else {
                this.showToast('打开终端功能未实现', 'info');
            }
        } catch (error) {
            console.error('打开终端错误:', error);
            this.showToast(`打开终端失败: ${error.message}`, 'error');
        }
    }
    
    async exportScript() {
        const profile = this.getCurrentProfile();
        if (!profile) return;
        
        const script = `#!/bin/bash
# Claude Code Proxy Pro 启动脚本
# 配置：${profile.name}

export OPENAI_API_KEY="${profile.apiKey}"
export OPENAI_BASE_URL="${profile.apiUrl}"
export BIG_MODEL="${profile.bigModel}"
export SMALL_MODEL="${profile.smallModel}"
export PROXY_PORT="${profile.proxyPort}"

echo "启动 Claude Code 代理..."
echo "API地址: $OPENAI_BASE_URL"
echo "大模型: $BIG_MODEL"
echo "小模型: $SMALL_MODEL"
echo "代理端口: $PROXY_PORT"

# 启动代理服务
# node proxy-server.js
`;
        
        if (window.electronAPI && window.electronAPI.saveFile) {
            const result = await window.electronAPI.saveFile({
                content: script,
                defaultName: `claude-proxy-${profile.name.replace(/\s+/g, '-')}.sh`
            });
            
            if (result.success) {
                this.showToast('启动脚本已导出', 'success');
            }
        } else {
            // 使用浏览器下载
            const blob = new Blob([script], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `claude-proxy-${profile.name.replace(/\s+/g, '-')}.sh`;
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('启动脚本已导出', 'success');
        }
    }
    
    updateVersion() {
        if (window.electronAPI && window.electronAPI.getVersion) {
            window.electronAPI.getVersion().then(version => {
                this.elements.version.textContent = `Pro v${version}`;
            });
        }
    }
    
    showToast(message, type = 'info') {
        const toast = this.elements.toast;
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    showLoading(show) {
        this.elements.loadingOverlay.classList.toggle('show', show);
    }
    
    async showConfirm(message) {
        if (window.electronAPI && window.electronAPI.showConfirm) {
            return await window.electronAPI.showConfirm(message);
        }
        return confirm(message);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 检查环境状态
    async checkEnvironments() {
        if (window.electronAPI && window.electronAPI.checkEnvironments) {
            try {
                const result = await window.electronAPI.checkEnvironments();
                this.updateEnvironmentStatus(result);
            } catch (error) {
                console.error('检查环境失败:', error);
            }
        }
    }
    
    // 更新环境状态显示
    updateEnvironmentStatus(envData) {
        const statusMap = {
            'nodejs': 'nodejs-status',
            'git': 'git-status',
            'uv': 'uv-status',
            'claudeCode': 'claude-code-status'  // 修正键名
        };
        
        Object.entries(statusMap).forEach(([key, elementId]) => {
            const element = document.getElementById(elementId);
            const envInfo = envData[key];
            
            if (element && envInfo) {
                // 适配后端返回的数据格式
                const isInstalled = envInfo.status === 'installed';
                
                if (isInstalled) {
                    element.textContent = '✅';
                    element.title = `${envInfo.name} v${envInfo.version || 'unknown'}`;
                    element.classList.add('installed');
                    element.classList.remove('missing');
                    element.style.cursor = 'default';
                } else {
                    element.textContent = '❌';
                    element.title = `点击查看如何安装 ${envInfo.name}`;
                    element.classList.add('missing');
                    element.classList.remove('installed');
                    element.style.cursor = 'pointer';
                    
                    // 添加点击事件
                    element.onclick = () => this.showInstallGuide(key, envInfo);
                }
            }
        });
    }
    
    // 检查代理状态
    async checkProxyStatus() {
        if (window.electronAPI && window.electronAPI.getProxyStatus) {
            try {
                const status = await window.electronAPI.getProxyStatus();
                this.updateProxyStatus(status.running);
            } catch (error) {
                console.error('检查代理状态失败:', error);
            }
        }
    }
    
    // 显示安装指南
    showInstallGuide(envKey, envInfo) {
        const modal = document.createElement('div');
        modal.className = 'install-guide-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <h3>安装 ${envInfo.name}</h3>
                <div class="install-options">
                    <div class="install-option">
                        <h4>🤖 自动安装（推荐）</h4>
                        <button class="btn btn-primary" onclick="window.proxyManager.installEnvironment('${envKey}')">
                            一键安装
                        </button>
                    </div>
                    <div class="install-option">
                        <h4>💻 手动安装</h4>
                        <code>${envInfo.installCmd || '请访问官网获取安装命令'}</code>
                        <button class="btn btn-secondary" onclick="navigator.clipboard.writeText('${envInfo.installCmd || ''}')">
                            复制命令
                        </button>
                    </div>
                    <div class="install-option">
                        <h4>🌐 访问官网</h4>
                        <button class="btn btn-secondary" onclick="window.electronAPI.openExternal('${this.getOfficialUrl(envKey)}')">
                            打开官网
                        </button>
                    </div>
                </div>
                <button class="modal-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // 获取官方网站URL
    getOfficialUrl(envKey) {
        const urls = {
            nodejs: 'https://nodejs.org/',
            git: 'https://git-scm.com/',
            uv: 'https://github.com/astral-sh/uv',
            claudeCode: 'https://claude.ai/code'
        };
        return urls[envKey] || 'https://google.com/search?q=' + envKey;
    }
    
    // 安装环境
    async installEnvironment(envKey) {
        this.showLoading(true);
        this.showToast(`正在安装环境...`, 'info');
        
        try {
            const result = await window.electronAPI.installEnvironment(envKey);
            
            if (result.success) {
                this.showToast(result.message || '安装成功！', 'success');
                // 重新检查环境状态
                await this.checkEnvironments();
            } else {
                this.showToast(result.error || '安装失败', 'error');
                if (result.details) {
                    console.error('安装详情:', result.details);
                }
            }
        } catch (error) {
            this.showToast(`安装失败: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 显示安装指南
    showInstallGuide(key, envInfo) {
        const modal = document.createElement('div');
        modal.className = 'install-guide-modal';
        modal.innerHTML = `
            <div class="install-guide-content">
                <h3>安装 ${envInfo.name}</h3>
                <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
                
                <div class="install-options">
                    <div class="install-option">
                        <h4>🤖 自动安装</h4>
                        <button class="btn btn-primary" onclick="window.proxyManager.installEnvironment('${key}')">
                            一键安装
                        </button>
                    </div>
                    
                    <div class="install-option">
                        <h4>💻 手动安装</h4>
                        <div class="command-box">
                            <code>${envInfo.installCmd || '暂无安装命令'}</code>
                            <button class="copy-btn" onclick="navigator.clipboard.writeText('${(envInfo.installCmd || '').replace(/'/g, "\\'")}')">
                                复制
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 点击背景关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };
    }
    
    // 安装环境
    async installEnvironment(key) {
        if (window.electronAPI && window.electronAPI.installEnvironment) {
            this.showLoading(true);
            try {
                const result = await window.electronAPI.installEnvironment(key);
                if (result.success) {
                    this.showToast('安装成功！', 'success');
                    // 重新检查环境
                    await this.checkEnvironments();
                    // 关闭模态框
                    document.querySelector('.install-guide-modal')?.remove();
                } else {
                    this.showToast(`安装失败：${result.error}`, 'error');
                }
            } catch (error) {
                this.showToast(`安装失败：${error.message}`, 'error');
            } finally {
                this.showLoading(false);
            }
        }
    }
    
    // 显示代理使用指南
    showProxyGuide(port) {
        const modal = document.createElement('div');
        modal.className = 'proxy-guide-modal';
        modal.innerHTML = `
            <div class="proxy-guide-content">
                <h3>🎉 代理服务已启动！</h3>
                <button class="close-btn" id="proxyGuideCloseXBtn">×</button>
                
                <div class="guide-info">
                    <p>代理服务正在运行于端口 <strong>${port}</strong></p>
                    
                    <div class="usage-section">
                        <h4>📌 使用说明</h4>
                        <div class="usage-item">
                            <strong>🎯 一键配置：</strong>
                            <p>点击下方按钮将自动：</p>
                            <ul style="margin-left: 20px; margin-top: 8px; color: var(--text-secondary);">
                                <li>✅ 配置代理环境变量</li>
                                <li>🚀 启动 Claude 进行连接验证</li>
                                <li>📋 显示验证结果</li>
                            </ul>
                        </div>
                        
                        <div class="usage-item">
                            <strong>💡 Cursor/VSCode 使用：</strong>
                            <p class="tip">配置完成后，请重新打开 Cursor/VSCode，代理将自动生效</p>
                        </div>
                    </div>
                    
                    <div class="action-buttons">
                        <button class="btn btn-secondary" id="proxyGuideCloseBtn">
                            稍后再说
                        </button>
                        <button class="btn btn-primary" id="proxyGuideOpenTerminalBtn">
                            🚀 配置环境并验证
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 点击背景关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };
        
        // 添加按钮事件监听器
        const closeBtn = modal.querySelector('#proxyGuideCloseBtn');
        const closeXBtn = modal.querySelector('#proxyGuideCloseXBtn');
        const openTerminalBtn = modal.querySelector('#proxyGuideOpenTerminalBtn');
        
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.remove();
            };
        }
        
        if (closeXBtn) {
            closeXBtn.onclick = () => {
                modal.remove();
            };
        }
        
        if (openTerminalBtn) {
            openTerminalBtn.onclick = () => {
                this.openTerminalWithEnv(port);
            };
        }
    }
    
    // 打开配置好环境变量的终端并验证
    async openTerminalWithEnv(port) {
        try {
            // 关闭模态框
            document.querySelector('.proxy-guide-modal')?.remove();
            
            // 显示执行状态
            this.showToast('正在配置环境并启动 Claude...', 'info');
            
            // 设置环境变量命令和验证命令
            const envCommands = [
                `export ANTHROPIC_BASE_URL="http://localhost:${port}/v1"`,
                `export ANTHROPIC_API_KEY="proxy-key"`,
                `echo "✅ 代理环境已配置成功！"`,
                `echo "🌐 代理地址: http://localhost:${port}/v1"`,
                `echo ""`,
                `echo "🚀 正在验证 Claude 连接..."`,
                `claude "你好，Claude！请确认代理连接正常工作。"`,
                `echo ""`,
                `echo "✨ 验证完成！Claude 现在通过代理工作。"`,
                `echo "💡 在 Cursor/VSCode 中使用请重新打开编辑器"`
            ].join(' && ');
            
            if (window.electronAPI && window.electronAPI.openTerminalWithCommand) {
                await window.electronAPI.openTerminalWithCommand(envCommands);
                this.showToast('✅ 已在终端中配置环境并启动 Claude 验证', 'success');
            } else {
                // 如果没有特定方法，使用普通打开终端
                await this.openTerminal();
                // 复制命令到剪贴板
                await navigator.clipboard.writeText(envCommands);
                this.showToast('命令已复制到剪贴板，请在终端中粘贴执行', 'info');
            }
        } catch (error) {
            console.error('配置环境错误:', error);
            this.showToast(`配置失败: ${error.message}`, 'error');
        }
    }
    
    // 启动 Claude Code
    async startClaudeCode() {
        try {
            // 检查代理是否在运行
            if (!this.isProxyRunning) {
                this.showToast('请先启动代理服务', 'warning');
                return;
            }
            
            if (window.electronAPI && window.electronAPI.startClaudeCode) {
                this.showLoading(true);
                const result = await window.electronAPI.startClaudeCode({
                    maxTokens: '32000'
                });
                
                if (result.success) {
                    this.showToast('Claude Code 已启动', 'success');
                } else {
                    this.showToast(`启动失败：${result.error}`, 'error');
                }
            } else {
                this.showToast('启动 Claude Code 功能未实现', 'info');
            }
        } catch (error) {
            console.error('启动 Claude Code 错误:', error);
            this.showToast(`启动失败: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 还原官方设置
    async restoreOfficialSettings() {
        try {
            if (!window.electronAPI || !window.electronAPI.showConfirm || !window.electronAPI.restoreOfficialSettings) {
                this.showToast('还原功能不可用', 'error');
                return;
            }
            
            // 显示确认对话框
            const confirmed = await window.electronAPI.showConfirm(
                '确定要还原 Claude Code 官方设置吗？\n\n这将：\n• 清除代理相关环境变量\n• 升级 Claude Code 到最新版本\n• 需要重新设置 API Key\n\n请确保已备份重要配置！'
            );
            
            if (!confirmed) {
                return;
            }
            
            this.showLoading(true);
            this.showToast('正在还原官方设置...', 'info');
            
            // 调用主进程的还原功能
            const result = await window.electronAPI.restoreOfficialSettings();
            
            if (result.success) {
                this.showToast('还原脚本已启动，请按照终端提示完成操作', 'success');
            } else {
                this.showToast(`还原失败：${result.error}`, 'error');
            }
            
        } catch (error) {
            console.error('还原官方设置错误:', error);
            this.showToast(`还原失败: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 创建语言选择器
    createLanguageSelector() {
        const container = document.querySelector('.language-selector-container');
        if (!container) return;
        
        const selector = window.i18n.createLanguageSelector();
        container.appendChild(selector);
        
        // 监听语言变化，更新动态内容
        window.i18n.addListener((locale) => {
            // 更新配置文件列表中的动态文本
            this.updateProfileListTexts();
            // 更新其他动态内容
            this.updateDynamicTexts();
        });
    }
    
    // 更新配置文件列表中的动态文本
    updateProfileListTexts() {
        // 更新配置文件列表中的文本，这些是动态生成的
        const profileItems = document.querySelectorAll('.profile-item');
        profileItems.forEach(item => {
            const nameSpan = item.querySelector('.profile-name');
            if (nameSpan && nameSpan.textContent === '免费配置') {
                nameSpan.textContent = window.i18n.t('profiles.freeConfig') || '免费配置';
            }
        });
    }
    
    // 更新其他动态文本
    updateDynamicTexts() {
        // 更新状态显示
        const statusUrl = document.getElementById('currentApiUrl');
        if (statusUrl && statusUrl.textContent === '未启动') {
            statusUrl.textContent = window.i18n.t('main.stopped');
        }
        
        // 更新当前配置名称（如果是默认配置）
        const profileName = document.getElementById('currentProfileName');
        if (profileName && profileName.textContent === '默认配置') {
            profileName.textContent = window.i18n.t('profiles.defaultConfig') || '默认配置';
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.proxyManager = new ProxyManager();
});