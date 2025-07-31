// 增强版渲染进程脚本

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    // 检查 electronAPI 是否存在
    if (!window.electronAPI) {
        console.error('electronAPI 未定义！请检查 preload 脚本是否正确加载。');
        showErrorMessage('应用程序初始化失败：electronAPI 未定义');
        return;
    }

    const { electronAPI } = window;

    // DOM元素
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

    // 验证所有必需的 DOM 元素
    const missingElements = [];
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            missingElements.push(key);
        }
    }

    if (missingElements.length > 0) {
        console.error('缺少以下 DOM 元素：', missingElements);
        showErrorMessage(`界面元素加载失败：${missingElements.join(', ')}`);
        return;
    }

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

    // Toast提示
    window.showToast = function showToast(message, type = 'info') {
    const toast = elements.toast;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
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
        const envs = await electronAPI.checkEnvironments();
        state.environments = envs;
        renderEnvironments(envs);
        showToast('环境检测完成', 'success');
    } catch (error) {
        showToast('环境检测失败: ' + error.message, 'error');
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
        const result = await electronAPI.installEnvironment(key);
        if (result.success) {
            showToast(`${state.environments[key].name} 安装成功`, 'success');
            checkEnvironments(); // 重新检测
        } else {
            showToast(`安装失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast('安装失败: ' + error.message, 'error');
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
        await electronAPI.saveConfig(state.config);
        showToast('配置保存成功', 'success');
    } catch (error) {
        showToast('保存失败: ' + error.message, 'error');
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
        
        const result = await electronAPI.testApiConnection(config);
        if (result.success) {
            showToast('API连接成功', 'success');
        } else {
            showToast(`连接失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast('测试失败: ' + error.message, 'error');
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
        const proxyResult = await electronAPI.startProxy(state.config);
        if (!proxyResult.success) {
            throw new Error(proxyResult.error);
        }
        
        state.isProxyRunning = true;
        updateGlobalStatus(true);
        showToast(`代理已启动在端口 ${proxyResult.port}`, 'success');
        
        // 启动Claude Code
        const claudeResult = await electronAPI.startClaudeCode({
            maxTokens: 32000
        });
        
        if (claudeResult.success) {
            showToast('Claude Code 已启动', 'success');
        } else {
            showToast(`启动失败: ${claudeResult.error}`, 'error');
        }
    } catch (error) {
        showToast('启动失败: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">🚀</span> 启动 Claude Code';
    }
}

// 快速操作功能
async function openTerminal() {
    try {
        if (electronAPI.platform === 'darwin') {
            await electronAPI.openExternal('iterm://');
        } else if (electronAPI.platform === 'win32') {
            await electronAPI.openExternal('wt://');
        } else {
            await electronAPI.openExternal('x-terminal-emulator://');
        }
        showToast('正在打开终端', 'success');
    } catch (error) {
        // 备用方案
        try {
            if (electronAPI.platform === 'darwin') {
                await electronAPI.openExternal('/System/Applications/Utilities/Terminal.app');
            }
        } catch (e) {
            showToast('打开终端失败', 'error');
        }
    }
}

async function copyEnvVariables() {
    const envText = elements.envPreview.textContent;
    try {
        await navigator.clipboard.writeText(envText);
        showToast('环境变量已复制到剪贴板', 'success');
    } catch (error) {
        showToast('复制失败', 'error');
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
        showToast('导出失败', 'error');
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
        await electronAPI.saveConfig(state.config);
        showToast('配置已重置', 'success');
    }
}

// 初始化
async function init() {
    try {
        // 获取版本号
        const version = await electronAPI.getAppVersion();
        elements.version.textContent = `v${version}`;
        
        // 加载配置
        const config = await electronAPI.getConfig();
        if (config) {
            state.config = config;
            elements.apiKey.value = config.apiKey || '';
            elements.apiUrl.value = config.apiUrl || 'https://api.openai.com/v1';
            elements.modelSelect.value = config.model || 'gpt-4-turbo-preview';
            elements.proxyPort.value = config.proxyPort || 8082;
            updateEnvPreview();
        }
        
        // 检查代理状态
        const proxyStatus = await electronAPI.getProxyStatus();
        if (proxyStatus.running) {
            state.isProxyRunning = true;
            updateGlobalStatus(true);
        }
        
        // 自动检测环境
        checkEnvironments();
    } catch (error) {
        console.error('初始化失败:', error);
        showToast('初始化失败', 'error');
    }
}

    // 绑定事件 - 使用安全的事件绑定
    function bindEvents() {
        try {
            // 主要按钮事件
            if (elements.checkEnvBtn) {
                elements.checkEnvBtn.addEventListener('click', checkEnvironments);
            }
            if (elements.toggleApiKey) {
                elements.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
            }
            if (elements.saveEnvBtn) {
                elements.saveEnvBtn.addEventListener('click', saveConfig);
            }
            if (elements.testEnvBtn) {
                elements.testEnvBtn.addEventListener('click', testApiConnection);
            }
            if (elements.startClaudeBtn) {
                elements.startClaudeBtn.addEventListener('click', startClaudeCode);
            }

            // 快速操作按钮
            if (elements.openTerminalBtn) {
                elements.openTerminalBtn.addEventListener('click', openTerminal);
            }
            if (elements.copyEnvBtn) {
                elements.copyEnvBtn.addEventListener('click', copyEnvVariables);
            }
            if (elements.exportScriptBtn) {
                elements.exportScriptBtn.addEventListener('click', exportScript);
            }
            if (elements.resetConfigBtn) {
                elements.resetConfigBtn.addEventListener('click', resetConfig);
            }

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
            if (electronAPI && electronAPI.onProxyStatusUpdate) {
                electronAPI.onProxyStatusUpdate((status) => {
                    state.isProxyRunning = status.running;
                    updateGlobalStatus(status.running);
                });
            }

            console.log('所有事件监听器已成功绑定');
        } catch (error) {
            console.error('绑定事件时出错：', error);
            showToast('界面初始化出现错误', 'error');
        }
    }

    // 绑定事件
    bindEvents();

    // 启动应用
    init();
}

// 显示错误消息的备用函数
function showErrorMessage(message) {
    // 如果 toast 不可用，使用 alert
    if (window.showToast) {
        window.showToast(message, 'error');
    } else {
        console.error(message);
        alert(message);
    }
}