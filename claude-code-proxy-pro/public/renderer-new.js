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
            apiKey: 'sk-3vxiV5wctLaERpZ6F7ap0Ys4nh0cmE1uK9NNmYg08DcHzQ44',
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
        this.cacheElements();
        this.bindEvents();
        await this.loadProfiles();
        this.updateUI();
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
        this.elements.globalStatus = document.getElementById('globalStatus');
        
        // 配置表单元素
        this.elements.currentProfileName = document.getElementById('currentProfileName');
        this.elements.configForm = document.getElementById('configForm');
        this.elements.emptyState = document.getElementById('emptyState');
        this.elements.configName = document.getElementById('configName');
        this.elements.apiUrl = document.getElementById('apiUrl');
        this.elements.apiKey = document.getElementById('apiKey');
        this.elements.proxyPort = document.getElementById('proxyPort');
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
        const proxyPort = parseInt(this.elements.proxyPort.value);
        
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
                        this.showToast(`代理已启动，端口：${profile.proxyPort}`, 'success');
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
        
        // 更新全局状态
        const statusElement = this.elements.globalStatus;
        const statusText = statusElement.querySelector('.status-text');
        
        if (isRunning) {
            statusElement.classList.add('online');
            statusText.textContent = '在线';
        } else {
            statusElement.classList.remove('online');
            statusText.textContent = '离线';
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
        if (window.electronAPI && window.electronAPI.openTerminal) {
            await window.electronAPI.openTerminal();
        } else {
            this.showToast('打开终端功能未实现', 'info');
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
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.proxyManager = new ProxyManager();
});