// Claude Code Proxy Pro - 最终版渲染进程脚本

// 等待DOM和依赖项加载
function waitForReady() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('✅ DOM已加载');
                resolve();
            });
        } else {
            console.log('✅ DOM已就绪');
            resolve();
        }
    });
}

// 主初始化函数
async function initializeApp() {
    console.log('🚀 开始初始化应用...');
    
    // 检查electronAPI
    if (!window.electronAPI) {
        console.error('❌ electronAPI未定义！');
        showError('应用程序初始化失败：无法连接到主进程');
        return;
    }
    
    console.log('✅ electronAPI已加载');
    
    // DOM元素集合
    const elements = {
        // 头部元素
        version: document.getElementById('version'),
        globalStatus: document.getElementById('globalStatus'),
        
        // 环境检测元素
        environmentList: document.getElementById('environmentList'),
        checkEnvBtn: document.getElementById('checkEnvBtn'),
        
        // 配置元素
        apiKey: document.getElementById('apiKey'),
        apiUrl: document.getElementById('apiUrl'),
        modelSelect: document.getElementById('modelSelect'),
        proxyPort: document.getElementById('proxyPort'),
        toggleApiKey: document.getElementById('toggleApiKey'),
        envPreview: document.getElementById('envPreview'),
        
        // 操作按钮
        saveEnvBtn: document.getElementById('saveEnvBtn'),
        testEnvBtn: document.getElementById('testEnvBtn'),
        startClaudeBtn: document.getElementById('startClaudeBtn'),
        
        // 快速操作按钮
        openTerminalBtn: document.getElementById('openTerminalBtn'),
        copyEnvBtn: document.getElementById('copyEnvBtn'),
        exportScriptBtn: document.getElementById('exportScriptBtn'),
        resetConfigBtn: document.getElementById('resetConfigBtn'),
        
        // 提示元素
        toast: document.getElementById('toast')
    };
    
    // 验证所有元素是否存在
    const missingElements = [];
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            missingElements.push(key);
        }
    }
    
    if (missingElements.length > 0) {
        console.error('❌ 缺失的DOM元素:', missingElements);
        showError(`界面元素加载失败: ${missingElements.join(', ')}`);
        return;
    }
    
    console.log('✅ 所有DOM元素已找到');
    
    // 状态管理
    const state = {
        environments: {},
        isProxyRunning: false,
        apiKeyVisible: false,
        config: {
            apiKey: '',
            apiUrl: 'https://api.openai.com/v1',
            model: 'gpt-4-turbo-preview',
            proxyPort: 8082
        }
    };
    
    // Toast提示函数
    function showToast(message, type = 'info') {
        const toast = elements.toast;
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // 错误提示函数
    function showError(message) {
        showToast(message, 'error');
    }
    
    // 更新全局状态
    function updateGlobalStatus(isOnline) {
        const statusEl = elements.globalStatus;
        
        if (isOnline) {
            statusEl.classList.add('online');
            statusEl.querySelector('.status-text').textContent = '在线';
        } else {
            statusEl.classList.remove('online');
            statusEl.querySelector('.status-text').textContent = '离线';
        }
    }
    
    // 更新环境变量预览
    function updateEnvPreview() {
        const { apiKey, apiUrl, model, proxyPort } = state.config;
        const preview = `OPENAI_API_KEY=${apiKey ? 'sk-***' : '未设置'}
OPENAI_BASE_URL=${apiUrl}
BIG_MODEL=${model}
PROXY_PORT=${proxyPort}`;
        
        elements.envPreview.textContent = preview;
    }
    
    // 渲染环境列表
    function renderEnvironments(envs) {
        const list = elements.environmentList;
        list.innerHTML = '';
        
        Object.entries(envs).forEach(([key, env]) => {
            const item = document.createElement('div');
            item.className = 'environment-item';
            
            const statusClass = env.status === 'installed' ? 'success' : 'warning';
            const statusIcon = env.status === 'installed' ? '✅' : '⚠️';
            const statusText = env.status === 'installed' ? '已安装' : '未安装';
            
            item.innerHTML = `
                <div class="env-info">
                    <span class="env-name">${env.name}</span>
                    <span class="env-version">${env.version || '-'}</span>
                </div>
                <div class="env-status">
                    <span class="status-badge ${statusClass}">${statusIcon} ${statusText}</span>
                    ${env.status !== 'installed' ? 
                        `<button class="btn btn-sm btn-primary install-btn" data-key="${key}">安装</button>` : 
                        ''
                    }
                </div>
            `;
            
            list.appendChild(item);
        });
        
        // 绑定安装按钮事件
        list.querySelectorAll('.install-btn').forEach(btn => {
            btn.addEventListener('click', handleInstallEnvironment);
        });
    }
    
    // 检测环境
    async function checkEnvironments() {
        const btn = elements.checkEnvBtn;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading"></span> 检测中...';
        
        try {
            const envs = await window.electronAPI.checkEnvironments();
            state.environments = envs;
            renderEnvironments(envs);
            showToast('环境检测完成', 'success');
        } catch (error) {
            showError('环境检测失败: ' + error.message);
            console.error('环境检测错误:', error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-icon">🔍</span> 重新检测';
        }
    }
    
    // 安装环境
    async function handleInstallEnvironment(e) {
        const key = e.target.dataset.key;
        const btn = e.target;
        
        btn.disabled = true;
        btn.textContent = '安装中...';
        
        try {
            const result = await window.electronAPI.installEnvironment(key);
            if (result.success) {
                showToast(`${state.environments[key].name} 安装成功`, 'success');
                checkEnvironments(); // 重新检测
            } else {
                showError(`安装失败: ${result.error}`);
                if (result.details) {
                    console.error('安装详情:', result.details);
                }
            }
        } catch (error) {
            showError('安装失败: ' + error.message);
            console.error('安装错误:', error);
        }
    }
    
    // 切换API密钥显示
    function toggleApiKeyVisibility() {
        state.apiKeyVisible = !state.apiKeyVisible;
        elements.apiKey.type = state.apiKeyVisible ? 'text' : 'password';
    }
    
    // 保存配置
    async function saveConfig() {
        state.config = {
            apiKey: elements.apiKey.value,
            apiUrl: elements.apiUrl.value,
            model: elements.modelSelect.value,
            proxyPort: parseInt(elements.proxyPort.value)
        };
        
        updateEnvPreview();
        
        try {
            await window.electronAPI.saveConfig(state.config);
            showToast('配置保存成功', 'success');
        } catch (error) {
            showError('保存失败: ' + error.message);
            console.error('保存配置错误:', error);
        }
    }
    
    // 测试API连接
    async function testApiConnection() {
        const btn = elements.testEnvBtn;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading"></span> 测试中...';
        
        try {
            const config = {
                apiKey: elements.apiKey.value,
                baseUrl: elements.apiUrl.value,
                model: elements.modelSelect.value
            };
            
            if (!config.apiKey) {
                showError('请先填写API密钥');
                return;
            }
            
            const result = await window.electronAPI.testApiConnection(config);
            if (result.success) {
                showToast('API连接成功', 'success');
            } else {
                showError(`连接失败: ${result.error}`);
            }
        } catch (error) {
            showError('测试失败: ' + error.message);
            console.error('测试API错误:', error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-icon">🧪</span> 测试配置';
        }
    }
    
    // 启动Claude Code
    async function startClaudeCode() {
        const btn = elements.startClaudeBtn;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading"></span> 启动中...';
        
        try {
            // 先保存配置
            await saveConfig();
            
            // 启动代理
            const proxyResult = await window.electronAPI.startProxy(state.config);
            if (!proxyResult.success) {
                throw new Error(proxyResult.error);
            }
            
            state.isProxyRunning = true;
            updateGlobalStatus(true);
            showToast(`代理已启动在端口 ${proxyResult.port}`, 'success');
            
            // 启动Claude Code
            const claudeResult = await window.electronAPI.startClaudeCode({
                maxTokens: 32000
            });
            
            if (claudeResult.success) {
                showToast('Claude Code 已启动', 'success');
            } else {
                showError(`启动失败: ${claudeResult.error}`);
            }
        } catch (error) {
            showError('启动失败: ' + error.message);
            console.error('启动错误:', error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-icon">🚀</span> 启动 Claude Code';
        }
    }
    
    // 快速操作功能
    async function openTerminal() {
        try {
            if (window.electronAPI.platform === 'darwin') {
                await window.electronAPI.openExternal('iterm://');
            } else if (window.electronAPI.platform === 'win32') {
                await window.electronAPI.openExternal('wt://');
            } else {
                await window.electronAPI.openExternal('x-terminal-emulator://');
            }
            showToast('正在打开终端', 'success');
        } catch (error) {
            // 备用方案
            try {
                if (window.electronAPI.platform === 'darwin') {
                    await window.electronAPI.openExternal('/System/Applications/Utilities/Terminal.app');
                }
            } catch (e) {
                showError('打开终端失败');
            }
        }
    }
    
    async function copyEnvVariables() {
        const envText = elements.envPreview.textContent;
        try {
            await navigator.clipboard.writeText(envText);
            showToast('环境变量已复制到剪贴板', 'success');
        } catch (error) {
            showError('复制失败');
            console.error('复制错误:', error);
        }
    }
    
    async function exportScript() {
        const script = `#!/bin/bash
# Claude Code Proxy Pro 启动脚本

export OPENAI_API_KEY="${state.config.apiKey}"
export OPENAI_BASE_URL="${state.config.apiUrl}"
export BIG_MODEL="${state.config.model}"
export PROXY_PORT="${state.config.proxyPort}"

# 启动代理
claude-code-proxy &

# 等待代理启动
sleep 2

# 启动Claude Code
export ANTHROPIC_BASE_URL="http://localhost:${state.config.proxyPort}"
export ANTHROPIC_AUTH_TOKEN="api-key"
claude
`;
        
        try {
            await navigator.clipboard.writeText(script);
            showToast('启动脚本已复制到剪贴板', 'success');
        } catch (error) {
            showError('导出失败');
            console.error('导出错误:', error);
        }
    }
    
    async function resetConfig() {
        if (confirm('确定要重置所有配置吗？')) {
            elements.apiKey.value = '';
            elements.apiUrl.value = 'https://api.openai.com/v1';
            elements.modelSelect.value = 'gpt-4-turbo-preview';
            elements.proxyPort.value = '8082';
            
            state.config = {
                apiKey: '',
                apiUrl: 'https://api.openai.com/v1',
                model: 'gpt-4-turbo-preview',
                proxyPort: 8082
            };
            
            updateEnvPreview();
            await window.electronAPI.saveConfig(state.config);
            showToast('配置已重置', 'success');
        }
    }
    
    // 绑定事件
    function bindEvents() {
        console.log('🔗 绑定事件监听器...');
        
        // 环境检测按钮
        elements.checkEnvBtn?.addEventListener('click', checkEnvironments);
        
        // 配置相关按钮
        elements.toggleApiKey?.addEventListener('click', toggleApiKeyVisibility);
        elements.saveEnvBtn?.addEventListener('click', saveConfig);
        elements.testEnvBtn?.addEventListener('click', testApiConnection);
        elements.startClaudeBtn?.addEventListener('click', startClaudeCode);
        
        // 快速操作按钮
        elements.openTerminalBtn?.addEventListener('click', openTerminal);
        elements.copyEnvBtn?.addEventListener('click', copyEnvVariables);
        elements.exportScriptBtn?.addEventListener('click', exportScript);
        elements.resetConfigBtn?.addEventListener('click', resetConfig);
        
        // 配置输入监听
        const configInputs = [elements.apiKey, elements.apiUrl, elements.modelSelect, elements.proxyPort];
        configInputs.forEach(el => {
            if (el) {
                el.addEventListener('input', () => {
                    state.config = {
                        apiKey: elements.apiKey.value,
                        apiUrl: elements.apiUrl.value,
                        model: elements.modelSelect.value,
                        proxyPort: parseInt(elements.proxyPort.value) || 8082
                    };
                    updateEnvPreview();
                });
            }
        });
        
        // 监听代理状态更新
        if (window.electronAPI.onProxyStatusUpdate) {
            window.electronAPI.onProxyStatusUpdate((status) => {
                state.isProxyRunning = status.running;
                updateGlobalStatus(status.running);
            });
        }
        
        console.log('✅ 事件绑定完成');
    }
    
    // 加载初始数据
    async function loadInitialData() {
        console.log('📊 加载初始数据...');
        
        try {
            // 获取版本号
            const version = await window.electronAPI.getAppVersion();
            elements.version.textContent = `v${version}`;
            
            // 加载配置
            const config = await window.electronAPI.getConfig();
            if (config && config.api) {
                // 适配新的配置结构
                state.config = {
                    apiKey: config.api.apiKey || '',
                    apiUrl: config.api.baseUrl || 'https://api.openai.com/v1',
                    model: config.api.model || 'gpt-4-turbo-preview',
                    proxyPort: config.proxy?.port || 8082
                };
            } else if (config) {
                // 兼容旧配置
                state.config = {
                    apiKey: config.apiKey || '',
                    apiUrl: config.apiUrl || config.baseUrl || 'https://api.openai.com/v1',
                    model: config.model || 'gpt-4-turbo-preview',
                    proxyPort: config.proxyPort || config.port || 8082
                };
            }
            
            // 更新界面
            elements.apiKey.value = state.config.apiKey;
            elements.apiUrl.value = state.config.apiUrl;
            elements.modelSelect.value = state.config.model;
            elements.proxyPort.value = state.config.proxyPort;
            updateEnvPreview();
            
            // 检查代理状态
            const proxyStatus = await window.electronAPI.getProxyStatus();
            if (proxyStatus.running) {
                state.isProxyRunning = true;
                updateGlobalStatus(true);
            }
            
            console.log('✅ 初始数据加载完成');
            
            // 自动检测环境
            checkEnvironments();
        } catch (error) {
            console.error('❌ 初始化失败:', error);
            showError('初始化失败: ' + error.message);
        }
    }
    
    // 执行初始化
    bindEvents();
    await loadInitialData();
    
    console.log('✅ 应用初始化完成！');
}

// 启动应用
waitForReady().then(() => {
    initializeApp().catch(error => {
        console.error('❌ 应用初始化失败:', error);
    });
});

// 全局错误处理
window.addEventListener('error', (e) => {
    console.error('❌ 全局错误:', e.message);
    console.error('文件:', e.filename);
    console.error('行号:', e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ 未处理的Promise拒绝:', e.reason);
});