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
        
        // 键盘导航和快捷键
        this.setupKeyboardNavigation();
        this.setupFormEnhancements();
        
        // 监听主进程消息
        if (window.electronAPI) {
            window.electronAPI.onProxyStatus((status) => this.updateProxyStatus(status));
            window.electronAPI.onToast((data) => this.showToast(data.message, data.type));
        }
    }
    
    // 设置键盘导航
    setupKeyboardNavigation() {
        // 全局快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S: 保存配置
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveCurrentProfile();
                return;
            }
            
            // Ctrl/Cmd + T: 测试配置
            if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                this.testConfiguration();
                return;
            }
            
            // Ctrl/Cmd + Enter: 启动/停止代理
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.toggleProxy();
                return;
            }
            
            // Ctrl/Cmd + N: 新建配置
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.createNewProfile();
                return;
            }
            
            // Escape: 关闭所有模态框和Toast
            if (e.key === 'Escape') {
                this.hideAllModals();
                this.hideToast();
                return;
            }
            
            // F5: 刷新环境状态
            if (e.key === 'F5') {
                e.preventDefault();
                this.checkEnvironments();
                return;
            }
            
            // 箭头键导航配置列表
            if (e.target.closest('.profile-list')) {
                this.handleProfileNavigation(e);
            }
        });
        
        // 为所有按钮添加焦点样式
        this.enhanceButtonFocus();
    }
    
    // 处理配置列表导航
    handleProfileNavigation(e) {
        const profileItems = Array.from(document.querySelectorAll('.profile-item'));
        const currentIndex = profileItems.findIndex(item => item.classList.contains('active'));
        
        let newIndex = currentIndex;
        
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            newIndex = currentIndex > 0 ? currentIndex - 1 : profileItems.length - 1;
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            newIndex = currentIndex < profileItems.length - 1 ? currentIndex + 1 : 0;
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (profileItems[currentIndex]) {
                profileItems[currentIndex].click();
            }
            return;
        }
        
        if (newIndex !== currentIndex && profileItems[newIndex]) {
            profileItems[newIndex].click();
            profileItems[newIndex].focus();
        }
    }
    
    // 增强按钮焦点
    enhanceButtonFocus() {
        const buttons = document.querySelectorAll('.btn, .sidebar-btn, .add-profile-btn');
        buttons.forEach(button => {
            button.setAttribute('tabindex', '0');
            
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    button.click();
                }
            });
        });
        
        // 为配置项添加焦点支持
        const profileItems = document.querySelectorAll('.profile-item');
        profileItems.forEach(item => {
            item.setAttribute('tabindex', '0');
            
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.click();
                }
            });
        });
    }
    
    // 设置表单增强
    setupFormEnhancements() {
        // Enter 键在表单中的处理
        const formInputs = document.querySelectorAll('.form-input, .form-select');
        formInputs.forEach((input, index) => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    
                    // 尝试移动到下一个输入框
                    const nextInput = formInputs[index + 1];
                    if (nextInput) {
                        nextInput.focus();
                    } else {
                        // 最后一个输入框，保存配置
                        this.saveCurrentProfile();
                    }
                }
            });
            
            // 添加实时验证
            input.addEventListener('blur', () => {
                this.validateField(input);
            });
            
            input.addEventListener('input', () => {
                // 清除错误状态
                input.classList.remove('error');
                const formGroup = input.closest('.form-group');
                if (formGroup) {
                    formGroup.classList.remove('has-error');
                    const errorMsg = formGroup.querySelector('.field-error');
                    if (errorMsg) errorMsg.remove();
                }
            });
        });
    }
    
    // 验证单个字段
    validateField(input) {
        const formGroup = input.closest('.form-group');
        if (!formGroup) return;
        
        const value = input.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        // 根据字段类型验证
        if (formGroup.classList.contains('required') && !value) {
            isValid = false;
            errorMessage = '此字段为必填项';
        } else if (input.id === 'apiUrl' && value && !this.isValidUrl(value)) {
            isValid = false;
            errorMessage = 'URL 格式不正确';
        } else if (input.id === 'apiKey' && value && value.length < 8) {
            isValid = false;
            errorMessage = 'API 密钥长度不足';
        }
        
        // 更新样式
        formGroup.classList.remove('has-error', 'has-success');
        const existingError = formGroup.querySelector('.field-error');
        if (existingError) existingError.remove();
        
        if (!isValid && errorMessage) {
            formGroup.classList.add('has-error');
            input.classList.add('error');
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.innerHTML = `⚠ ${errorMessage}`;
            formGroup.appendChild(errorDiv);
        } else if (value && isValid) {
            formGroup.classList.add('has-success');
        }
    }
    
    // 隐藏所有模态框
    hideAllModals() {
        const modals = document.querySelectorAll('.install-guide-modal, .proxy-guide-modal');
        modals.forEach(modal => modal.remove());
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
        
        this.profiles.forEach((profile, index) => {
            const li = document.createElement('li');
            li.className = 'profile-item';
            li.setAttribute('role', 'option');
            li.setAttribute('tabindex', '0');
            li.setAttribute('aria-label', `配置: ${profile.name}`);
            
            if (profile.id === this.currentProfileId) {
                li.classList.add('active');
                li.setAttribute('aria-selected', 'true');
                this.elements.profileList.setAttribute('aria-activedescendant', `profile-${profile.id}`);
            } else {
                li.setAttribute('aria-selected', 'false');
            }
            
            li.id = `profile-${profile.id}`;
            
            li.innerHTML = `
                <div class="profile-info">
                    <div class="profile-name">${this.escapeHtml(profile.name)}</div>
                    <div class="profile-status">
                        <span class="status-dot" aria-hidden="true"></span>
                        <span>${profile.isDefault ? '免费' : profile.apiUrl.split('/')[2]}</span>
                    </div>
                </div>
            `;
            
            li.addEventListener('click', () => this.selectProfile(profile.id));
            li.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectProfile(profile.id);
                }
            });
            
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
        if (!profile) {
            this.showToast('请先选择一个配置文件', 'warning');
            return;
        }
        
        // 获取表单值
        const formData = this.getFormData();
        
        // 验证数据
        const validation = this.validateFormData(formData);
        if (!validation.valid) {
            this.showToast(validation.message, 'error');
            this.focusInvalidField(validation.field);
            return;
        }
        
        // 检查名称是否重复
        if (this.isProfileNameDuplicate(formData.name, profile.id)) {
            this.showToast('配置名称已存在，请使用其他名称', 'error');
            this.focusInvalidField('configName');
            return;
        }
        
        this.showLoading(true, {
            text: '正在保存配置...',
            showProgress: false
        });
        this.updateButtonState('saveProfileBtn', 'loading');
        
        try {
            // 更新配置数据
            Object.assign(profile, formData);
            
            // 保存到主进程
            await this.saveProfiles();
            
            this.updateUI();
            this.updateButtonState('saveProfileBtn', 'success');
            this.showToast(`✓ 配置 "${formData.name}" 保存成功！`, 'success');
            
            // 提示是否测试配置
            setTimeout(() => {
                this.showTestConfigPrompt();
            }, 1000);
            
        } catch (error) {
            console.error('保存配置错误:', error);
            this.updateButtonState('saveProfileBtn', 'error');
            this.showToast(`✗ 保存失败：${this.formatError(error)}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 获取表单数据
    getFormData() {
        let bigModel = this.elements.bigModel.value;
        if (bigModel === 'custom') {
            bigModel = this.elements.customBigModel.value.trim();
        }
        
        let smallModel = this.elements.smallModel.value;
        if (smallModel === 'custom') {
            smallModel = this.elements.customSmallModel.value.trim();
        }
        
        return {
            name: this.elements.configName.value.trim(),
            apiUrl: this.elements.apiUrl.value.trim(),
            apiKey: this.elements.apiKey.value.trim(),
            proxyPort: 8082, // 使用固定端口
            bigModel,
            smallModel
        };
    }
    
    // 验证表单数据
    validateFormData(data) {
        if (!data.name) {
            return { valid: false, message: '请输入配置名称', field: 'configName' };
        }
        
        if (data.name.length < 2) {
            return { valid: false, message: '配置名称至少需要 2 个字符', field: 'configName' };
        }
        
        if (!data.apiUrl) {
            return { valid: false, message: '请输入API地址', field: 'apiUrl' };
        }
        
        if (!this.isValidUrl(data.apiUrl)) {
            return { valid: false, message: 'API地址格式不正确，请输入完整的URL（如 https://api.example.com/v1）', field: 'apiUrl' };
        }
        
        if (!data.apiKey) {
            return { valid: false, message: '请输入API密钥', field: 'apiKey' };
        }
        
        if (data.apiKey.length < 8) {
            return { valid: false, message: 'API密钥长度似乎不正确（至少 8 个字符）', field: 'apiKey' };
        }
        
        if (!data.bigModel) {
            return { valid: false, message: '请选择或输入大模型名称', field: 'bigModel' };
        }
        
        if (!data.smallModel) {
            return { valid: false, message: '请选择或输入小模型名称', field: 'smallModel' };
        }
        
        return { valid: true };
    }
    
    // 检查配置名称是否重复
    isProfileNameDuplicate(name, currentId) {
        return this.profiles.some(profile => 
            profile.name === name && profile.id !== currentId
        );
    }
    
    // 聚焦到无效字段
    focusInvalidField(fieldName) {
        setTimeout(() => {
            const field = this.elements[fieldName];
            if (field) {
                field.focus();
                if (field.select) field.select();
                
                // 添加错误样式
                field.classList.add('error');
                setTimeout(() => {
                    field.classList.remove('error');
                }, 3000);
            }
        }, 100);
    }
    
    // 显示测试配置提示
    showTestConfigPrompt() {
        const promptToast = document.createElement('div');
        promptToast.className = 'toast test-prompt show info';
        promptToast.innerHTML = `
            <div class="toast-icon">📊</div>
            <div class="toast-content">配置已保存，是否立即测试连接？</div>
            <button class="btn btn-primary" onclick="window.proxyManager.testConfiguration(); this.parentElement.remove();">\u7acb\u5373\u6d4b\u8bd5</button>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        document.body.appendChild(promptToast);
        
        setTimeout(() => {
            promptToast.remove();
        }, 8000);
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
        
        // 首先验证配置
        const validation = this.validateProfile(profile);
        if (!validation.valid) {
            this.showToast(validation.message, 'error');
            return;
        }
        
        this.showLoading(true, {
            text: '正在测试API连接...',
            showProgress: true,
            simulateProgress: true,
            duration: 2000
        });
        this.updateButtonState('testConfigBtn', 'testing');
        
        try {
            if (window.electronAPI && window.electronAPI.testConfig) {
                const result = await window.electronAPI.testConfig({
                    apiUrl: profile.apiUrl,
                    apiKey: profile.apiKey,
                    model: profile.smallModel
                });
                
                if (result.success) {
                    this.showToast('✓ 配置测试成功！API连接正常，模型响应正常', 'success');
                } else {
                    const errorMsg = this.formatApiError(result.error);
                    this.showToast(`✗ 配置测试失败：${errorMsg}`, 'error');
                    this.showRetryOption('testConfig');
                }
            } else {
                // 模拟测试
                await this.simulateApiTest();
            }
        } catch (error) {
            console.error('测试配置错误:', error);
            const errorMsg = this.formatError(error);
            this.showToast(`✗ 测试失败：${errorMsg}`, 'error');
            this.showRetryOption('testConfig');
        } finally {
            this.showLoading(false);
            this.updateButtonState('testConfigBtn', 'normal');
        }
    }
    
    // 验证配置数据
    validateProfile(profile) {
        if (!profile.name?.trim()) {
            return { valid: false, message: '请输入配置名称' };
        }
        
        if (!profile.apiUrl?.trim()) {
            return { valid: false, message: '请输入API地址' };
        }
        
        if (!this.isValidUrl(profile.apiUrl)) {
            return { valid: false, message: 'API地址格式不正确，请输入完整的URL' };
        }
        
        if (!profile.apiKey?.trim()) {
            return { valid: false, message: '请输入API密钥' };
        }
        
        if (profile.apiKey.length < 10) {
            return { valid: false, message: 'API密钥长度似乎不正确，请检查' };
        }
        
        if (!profile.bigModel?.trim() || !profile.smallModel?.trim()) {
            return { valid: false, message: '请选择或输入模型名称' };
        }
        
        return { valid: true };
    }
    
    // 检查URL有效性
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    // 格式化API错误信息
    formatApiError(error) {
        const errorMap = {
            'ENOTFOUND': '无法连接到API服务器，请检查网络和地址',
            'ECONNREFUSED': '连接被拒绝，请检查API地址和端口',
            'TIMEOUT': '请求超时，请检查网络连接',
            'UNAUTHORIZED': 'API密钥错误或无效，请检查后重试',
            'FORBIDDEN': '访问被禁止，请检查API密钥权限',
            'NOT_FOUND': 'API地址不存在，请检查地址是否正确',
            'RATE_LIMITED': '请求频率超限，请稍后重试',
            'MODEL_NOT_FOUND': '模型不存在，请检查模型名称'
        };
        
        // 查找匹配的错误类型
        for (const [key, message] of Object.entries(errorMap)) {
            if (error.includes(key) || error.toUpperCase().includes(key)) {
                return message;
            }
        }
        
        return error || '未知错误';
    }
    
    // 格式化通用错误
    formatError(error) {
        if (error.name === 'NetworkError') {
            return '网络连接失败，请检查网络设置';
        }
        
        if (error.code === 'ENOTFOUND') {
            return '无法解析域名，请检查网络和DNS设置';
        }
        
        return error.message || '操作失败';
    }
    
    // 显示重试选项
    showRetryOption(action) {
        setTimeout(() => {
            const retryToast = document.createElement('div');
            retryToast.className = 'toast retry-toast show info';
            retryToast.innerHTML = `
                <div class="toast-icon">↻</div>
                <div class="toast-content">操作失败，是否重试？</div>
                <button class="btn btn-secondary" onclick="window.proxyManager.retry('${action}')">\u91cd\u8bd5</button>
                <button class="toast-close" onclick="this.parentElement.remove()">×</button>
            `;
            document.body.appendChild(retryToast);
            
            setTimeout(() => {
                retryToast.remove();
            }, 10000);
        }, 1000);
    }
    
    // 重试操作
    async retry(action) {
        document.querySelectorAll('.retry-toast').forEach(toast => toast.remove());
        
        switch (action) {
            case 'testConfig':
                await this.testConfiguration();
                break;
            case 'startProxy':
                await this.toggleProxy();
                break;
            default:
                console.warn('Unknown retry action:', action);
        }
    }
    
    // 更新按钮状态
    updateButtonState(buttonId, state) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        button.classList.remove('loading', 'success', 'error');
        
        switch (state) {
            case 'loading':
            case 'testing':
                button.classList.add('loading');
                button.disabled = true;
                break;
            case 'success':
                button.classList.add('success');
                setTimeout(() => {
                    button.classList.remove('success');
                }, 2000);
                button.disabled = false;
                break;
            case 'error':
                button.classList.add('error');
                setTimeout(() => {
                    button.classList.remove('error');
                }, 3000);
                button.disabled = false;
                break;
            default:
                button.disabled = false;
        }
    }
    
    // 模拟 API 测试
    async simulateApiTest() {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.showToast('✓ 模拟测试成功！', 'success');
                resolve();
            }, 1500);
        });
    }
    
    async toggleProxy() {
        const profile = this.getCurrentProfile();
        if (!profile) {
            this.showToast('请先选择一个配置文件', 'warning');
            return;
        }
        
        if (this.isProxyRunning) {
            // 停止代理
            await this.stopProxy();
        } else {
            // 启动代理
            await this.startProxy(profile);
        }
    }
    
    async startProxy(profile) {
        // 验证配置
        const validation = this.validateProfile(profile);
        if (!validation.valid) {
            this.showToast(validation.message, 'error');
            return;
        }
        
        this.showLoading(true, {
            text: '正在启动代理服务...',
            showProgress: true,
            simulateProgress: true,
            duration: 3000
        });
        this.updateButtonState('startProxyBtn', 'loading');
        
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
                    this.updateButtonState('startProxyBtn', 'success');
                    
                    const port = result.port || profile.proxyPort;
                    this.showToast(
                        `✓ 代理服务启动成功\n🌐 本地地址：http://localhost:${port}\n🔗 现在可以配置您的客户端使用该代理`, 
                        'success'
                    );
                    
                    // 显示使用指南
                    setTimeout(() => {
                        this.showProxyGuide(port);
                    }, 1000);
                    
                } else {
                    const errorMsg = this.formatProxyError(result.error);
                    this.showToast(`✗ 代理启动失败：${errorMsg}`, 'error');
                    this.updateButtonState('startProxyBtn', 'error');
                    this.showRetryOption('startProxy');
                }
            } else {
                // 模拟启动
                await this.simulateProxyStart(profile);
            }
        } catch (error) {
            console.error('启动代理错误:', error);
            const errorMsg = this.formatError(error);
            this.showToast(`✗ 启动失败：${errorMsg}`, 'error');
            this.updateButtonState('startProxyBtn', 'error');
            this.showRetryOption('startProxy');
        } finally {
            this.showLoading(false);
        }
    }
    
    async stopProxy() {
        this.showLoading(true);
        this.updateButtonState('startProxyBtn', 'loading');
        
        try {
            if (window.electronAPI && window.electronAPI.stopProxy) {
                const result = await window.electronAPI.stopProxy();
                if (result && !result.success) {
                    throw new Error(result.error || '停止代理失败');
                }
            }
            
            this.isProxyRunning = false;
            this.updateProxyStatus(false);
            this.updateButtonState('startProxyBtn', 'normal');
            this.showToast('✓ 代理服务已停止', 'info');
            
        } catch (error) {
            console.error('停止代理错误:', error);
            this.showToast(`✗ 停止失败：${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 格式化代理错误信息
    formatProxyError(error) {
        const errorMap = {
            'PORT_IN_USE': '端口已被占用，请尝试修改端口号',
            'PERMISSION_DENIED': '权限不足，请以管理员身份运行',
            'INVALID_CONFIG': '配置信息无效，请检查配置参数',
            'API_UNREACHABLE': 'API服务器不可访问，请检查网络和地址',
            'STARTUP_TIMEOUT': '启动超时，请检查系统资源',
            'MODULE_NOT_FOUND': '缺少依赖模块，请检查安装'
        };
        
        for (const [key, message] of Object.entries(errorMap)) {
            if (error.includes(key) || error.toUpperCase().includes(key)) {
                return message;
            }
        }
        
        return error || '未知错误';
    }
    
    // 模拟代理启动
    async simulateProxyStart(profile) {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.isProxyRunning = true;
                this.updateProxyStatus(true);
                this.updateButtonState('startProxyBtn', 'success');
                this.showToast(`✓ 模拟代理启动成功，端口：${profile.proxyPort}`, 'success');
                resolve();
            }, 2000);
        });
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
    
    showToast(message, type = 'info', duration = null) {
        const toast = this.elements.toast;
        
        // 清除之前的内容
        toast.innerHTML = '';
        
        // 创建图标
        const icon = document.createElement('div');
        icon.className = 'toast-icon';
        const iconMap = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'i'
        };
        icon.textContent = iconMap[type] || 'i';
        
        // 创建内容
        const content = document.createElement('div');
        content.className = 'toast-content';
        content.textContent = message;
        
        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => this.hideToast();
        
        // 组装Toast
        toast.appendChild(icon);
        toast.appendChild(content);
        toast.appendChild(closeBtn);
        
        // 设置样式
        toast.className = `toast show ${type}`;
        
        // 自动隐藏
        const autoDuration = duration || this.getToastDuration(message, type);
        
        // 添加进度条
        if (autoDuration > 2000) {
            const progress = document.createElement('div');
            progress.className = 'toast-progress';
            progress.style.width = '100%';
            toast.appendChild(progress);
            
            // 动画进度条
            setTimeout(() => {
                progress.style.width = '0%';
                progress.style.transition = `width ${autoDuration}ms linear`;
            }, 100);
        }
        
        this.currentToastTimeout = setTimeout(() => {
            this.hideToast();
        }, autoDuration);
    }
    
    hideToast() {
        if (this.currentToastTimeout) {
            clearTimeout(this.currentToastTimeout);
            this.currentToastTimeout = null;
        }
        this.elements.toast.classList.remove('show');
    }
    
    getToastDuration(message, type) {
        // 根据消息长度和类型调整显示时间
        const baseTime = 3000;
        const extraTime = Math.min(message.length * 50, 5000); // 每个字符额外显示50ms
        const typeMultiplier = {
            'error': 1.5,    // 错误消息显示更久
            'warning': 1.3,  // 警告消息显示稍久
            'success': 1.0,  // 成功消息正常显示
            'info': 1.0      // 信息消息正常显示
        };
        
        return Math.min((baseTime + extraTime) * (typeMultiplier[type] || 1), 10000);
    }
    
    showLoading(show, options = {}) {
        const overlay = this.elements.loadingOverlay;
        const text = document.getElementById('loadingText');
        const progress = document.getElementById('loadingProgress');
        const progressBar = document.getElementById('loadingProgressBar');
        
        if (show) {
            // 设置加载文本
            if (options.text) {
                text.textContent = options.text;
            } else {
                text.textContent = '正在加载...';
            }
            
            // 设置进度条
            if (options.showProgress) {
                progress.style.display = 'block';
                progressBar.style.width = '0%';
                
                // 模拟进度
                if (options.simulateProgress) {
                    this.simulateLoadingProgress(progressBar, options.duration || 3000);
                }
            } else {
                progress.style.display = 'none';
            }
            
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
            // 重置进度
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        }
    }
    
    // 模拟加载进度
    simulateLoadingProgress(progressBar, duration) {
        let progress = 0;
        const interval = 50;
        const increment = (100 / duration) * interval;
        
        const timer = setInterval(() => {
            progress += increment;
            
            // 非线性进度，在开始和结束时速度不同
            let adjustedProgress = progress;
            if (progress < 30) {
                adjustedProgress = progress * 0.5; // 开始时较慢
            } else if (progress > 80) {
                adjustedProgress = 80 + (progress - 80) * 0.2; // 结束时更慢
            }
            
            progressBar.style.width = Math.min(adjustedProgress, 95) + '%';
            
            if (progress >= 100) {
                clearInterval(timer);
            }
        }, interval);
        
        return timer;
    }
    
    // 更新加载进度
    updateLoadingProgress(percent, text) {
        const progressBar = document.getElementById('loadingProgressBar');
        const loadingText = document.getElementById('loadingText');
        const progress = document.getElementById('loadingProgress');
        
        const normalizedPercent = Math.min(Math.max(percent, 0), 100);
        
        if (progressBar) {
            progressBar.style.width = normalizedPercent + '%';
        }
        
        if (progress) {
            progress.setAttribute('aria-valuenow', normalizedPercent.toString());
        }
        
        if (text && loadingText) {
            loadingText.textContent = text;
        }
        
        // 通知屏幕阅读器
        this.announceToScreenReader(`进度 ${normalizedPercent}%${text ? ': ' + text : ''}`);
    }
    
    // 向屏幕阅读器通知信息
    announceToScreenReader(message) {
        // 创建或获取屏幕阅读器通知元素
        let announcer = document.getElementById('sr-announcer');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'sr-announcer';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.style.position = 'absolute';
            announcer.style.left = '-10000px';
            announcer.style.width = '1px';
            announcer.style.height = '1px';
            announcer.style.overflow = 'hidden';
            document.body.appendChild(announcer);
        }
        
        // 清除并设置新消息
        announcer.textContent = '';
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);
    }
    
    // 完成加载
    completeLoading() {
        const progressBar = document.getElementById('loadingProgressBar');
        const loadingText = document.getElementById('loadingText');
        
        if (progressBar) {
            progressBar.style.width = '100%';
        }
        
        if (loadingText) {
            loadingText.textContent = '完成！';
        }
        
        setTimeout(() => {
            this.showLoading(false);
        }, 800);
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
            'claudeCode': 'claude-code-status'  // 修正键名以匹配HTML中的ID
        };
        
        Object.entries(statusMap).forEach(([key, elementId]) => {
            const element = document.getElementById(elementId);
            const envItem = element?.closest('.env-item');
            const envInfo = envData[key];
            
            if (element && envItem && envInfo) {
                // 清除所有状态类
                envItem.classList.remove('installed', 'missing', 'installing');
                element.classList.remove('installed', 'missing', 'installing');
                
                // 适配后端返回的数据格式
                const isInstalled = envInfo.status === 'installed';
                const isInstalling = envInfo.status === 'installing';
                
                if (isInstalling) {
                    element.textContent = '⏳';
                    element.title = `正在安装 ${envInfo.name}...`;
                    envItem.classList.add('installing');
                    element.classList.add('installing');
                    envItem.style.cursor = 'default';
                    element.onclick = null;
                } else if (isInstalled) {
                    element.textContent = '✓';
                    element.title = `${envInfo.name} v${envInfo.version || 'unknown'} - 已安装`;
                    envItem.classList.add('installed');
                    element.classList.add('installed');
                    envItem.style.cursor = 'default';
                    element.onclick = null;
                    
                    // 显示成功动画
                    if (!element.dataset.wasInstalled) {
                        this.showInstallSuccessAnimation(envItem);
                        element.dataset.wasInstalled = 'true';
                    }
                } else {
                    element.textContent = '✗';
                    element.title = `点击安装 ${envInfo.name}`;
                    envItem.classList.add('missing');
                    element.classList.add('missing');
                    envItem.style.cursor = 'pointer';
                    
                    // 添加点击事件
                    element.onclick = () => this.showInstallGuide(key, envInfo);
                    envItem.onclick = () => this.showInstallGuide(key, envInfo);
                }
            }
        });
    }
    
    // 成功安装动画
    showInstallSuccessAnimation(envItem) {
        envItem.style.transform = 'scale(1.05)';
        envItem.style.transition = 'transform 0.3s ease';
        
        setTimeout(() => {
            envItem.style.transform = 'scale(1)';
        }, 300);
        
        // 显示成功消息
        setTimeout(() => {
            envItem.style.transform = '';
            envItem.style.transition = '';
        }, 600);
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
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="install-guide-content">
                <h3>安装 ${envInfo.name}</h3>
                <button class="close-btn" onclick="this.closest('.install-guide-modal').remove()">×</button>
                
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
        
        // 绑定关闭事件
        const closeModal = () => {
            modal.remove();
            document.removeEventListener('keydown', handleEsc);
        };
        
        // 点击overlay关闭
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeModal);
        }
        
        // 点击关闭按钮关闭
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', handleEsc);
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