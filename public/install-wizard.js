/**
 * 安装向导 JavaScript
 * 处理安装流程的所有交互逻辑
 */

let currentStep = 1;
let installStatus = {
    checks: {},
    toInstall: [],
    config: {
        apiKey: '',
        port: 8082,
        baseUrl: 'https://api.anthropic.com'
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    startEnvironmentCheck();
});

/**
 * 开始环境检查
 */
async function startEnvironmentCheck() {
    const checks = [
        { id: 'os', name: '操作系统', check: checkOS },
        { id: 'nodejs', name: 'Node.js', check: checkNodeJS },
        { id: 'git', name: 'Git', check: checkGit },
        { id: 'network', name: '网络连接', check: checkNetwork },
        { id: 'port', name: '端口 8082', check: checkPort }
    ];

    let allPassed = true;

    for (const item of checks) {
        const element = document.getElementById(`check-${item.id}`);
        
        try {
            updateCheckItem(element, 'checking');
            const result = await item.check();
            installStatus.checks[item.id] = result;
            
            if (result.success) {
                updateCheckItem(element, 'success', result.message);
            } else {
                updateCheckItem(element, 'error', result.message, result.hint);
                allPassed = false;
                
                // 添加到安装列表
                if (result.canInstall) {
                    installStatus.toInstall.push({
                        id: item.id,
                        name: item.name,
                        installer: result.installer
                    });
                }
            }
        } catch (error) {
            updateCheckItem(element, 'error', `检查失败: ${error.message}`);
            allPassed = false;
        }
        
        // 添加延迟以显示动画
        await sleep(500);
    }

    // 更新底部状态
    updateFooterStatus(allPassed ? '环境检查完成，可以继续' : '发现一些问题，但我们可以帮您修复');
    document.getElementById('btn-next').disabled = false;
}

/**
 * 环境检查函数
 */
async function checkOS() {
    const platform = await window.electronAPI.getPlatform();
    const supportedPlatforms = ['darwin', 'win32', 'linux'];
    
    if (supportedPlatforms.includes(platform)) {
        return {
            success: true,
            message: `${getPlatformName(platform)} - 支持`
        };
    }
    
    return {
        success: false,
        message: `${platform} - 不支持`,
        canInstall: false
    };
}

async function checkNodeJS() {
    try {
        const result = await window.electronAPI.checkCommand('node --version');
        if (result.success) {
            return {
                success: true,
                message: `已安装 ${result.output}`
            };
        }
    } catch (error) {}
    
    return {
        success: false,
        message: '未安装 Node.js',
        hint: '需要 Node.js 16.0 或更高版本',
        canInstall: true,
        installer: 'nodejs'
    };
}

async function checkGit() {
    try {
        const result = await window.electronAPI.checkCommand('git --version');
        if (result.success) {
            return {
                success: true,
                message: `已安装 ${result.output.split(' ')[2]}`
            };
        }
    } catch (error) {}
    
    return {
        success: false,
        message: '未安装 Git',
        hint: 'Git 用于克隆和更新代理服务',
        canInstall: true,
        installer: 'git'
    };
}

async function checkNetwork() {
    try {
        const result = await window.electronAPI.checkNetwork();
        if (result.success) {
            return {
                success: true,
                message: `网络正常 (IP: ${result.ip})`
            };
        }
    } catch (error) {}
    
    return {
        success: false,
        message: '网络连接失败',
        hint: '请检查您的网络连接',
        canInstall: false
    };
}

async function checkPort() {
    try {
        const result = await window.electronAPI.checkPort(8082);
        if (result.available) {
            return {
                success: true,
                message: '端口可用'
            };
        } else {
            return {
                success: false,
                message: `端口被占用 (${result.process || '未知进程'})`,
                hint: '我们将自动处理端口冲突',
                canInstall: false
            };
        }
    } catch (error) {
        return {
            success: true,
            message: '端口检查跳过'
        };
    }
}

/**
 * 更新检查项状态
 */
function updateCheckItem(element, status, message, hint) {
    element.className = `check-item ${status}`;
    
    const iconDiv = element.querySelector('.check-icon');
    const statusDiv = element.querySelector('.check-status');
    
    switch (status) {
        case 'checking':
            iconDiv.innerHTML = '<div class="spinner"></div>';
            statusDiv.textContent = '检查中...';
            break;
        case 'success':
            iconDiv.innerHTML = '✅';
            statusDiv.textContent = message || '通过';
            break;
        case 'error':
            iconDiv.innerHTML = '❌';
            statusDiv.innerHTML = message || '失败';
            if (hint) {
                statusDiv.innerHTML += `<div class="manual-fix-hint">${hint}</div>`;
            }
            break;
    }
}

/**
 * 下一步
 */
async function nextStep() {
    if (currentStep >= 4) return;
    
    currentStep++;
    updateStepIndicator();
    showStep(currentStep);
    
    // 根据步骤执行相应操作
    switch (currentStep) {
        case 2:
            prepareInstallation();
            break;
        case 3:
            loadConfiguration();
            break;
        case 4:
            finishInstallation();
            break;
    }
}

/**
 * 上一步
 */
function previousStep() {
    if (currentStep <= 1) return;
    
    currentStep--;
    updateStepIndicator();
    showStep(currentStep);
}

/**
 * 准备安装
 */
async function prepareInstallation() {
    const installList = document.getElementById('install-list');
    installList.innerHTML = '';
    
    // 添加必要的安装项
    const requiredInstalls = [
        { id: 'uv', name: 'uv 包管理器', description: '用于安装 Claude Code CLI' },
        { id: 'claude-code', name: 'Claude Code CLI', description: '命令行工具' },
        { id: 'proxy', name: '代理服务', description: '本地代理服务器' }
    ];
    
    // 添加缺失的依赖
    const allInstalls = [...installStatus.toInstall, ...requiredInstalls];
    
    allInstalls.forEach(item => {
        const div = document.createElement('div');
        div.className = 'check-item';
        div.id = `install-${item.id}`;
        div.innerHTML = `
            <div class="check-icon">⏳</div>
            <div class="check-info">
                <div class="check-title">${item.name}</div>
                <div class="check-status">${item.description || '等待安装'}</div>
            </div>
        `;
        installList.appendChild(div);
    });
    
    // 启用下一步按钮
    document.getElementById('btn-next').disabled = false;
    document.getElementById('btn-back').disabled = false;
    updateFooterStatus('准备安装依赖项');
    
    // 开始自动安装
    setTimeout(() => startInstallation(allInstalls), 1000);
}

/**
 * 开始安装
 */
async function startInstallation(items) {
    const progressBar = document.getElementById('install-progress');
    const statusText = document.getElementById('install-status');
    
    let completed = 0;
    const total = items.length;
    
    for (const item of items) {
        const element = document.getElementById(`install-${item.id}`);
        updateCheckItem(element, 'checking', '安装中...');
        statusText.textContent = `正在安装 ${item.name}...`;
        
        try {
            // 调用后端安装接口
            const result = await window.electronAPI.installDependency(item.id);
            
            if (result.success) {
                updateCheckItem(element, 'success', '安装成功');
            } else {
                updateCheckItem(element, 'error', result.error || '安装失败');
            }
        } catch (error) {
            updateCheckItem(element, 'error', `安装失败: ${error.message}`);
        }
        
        completed++;
        const progress = (completed / total) * 100;
        progressBar.style.width = `${progress}%`;
        
        await sleep(500);
    }
    
    statusText.textContent = '安装完成！';
    updateFooterStatus('所有依赖已安装完成');
    document.getElementById('btn-next').disabled = false;
}

/**
 * 加载配置
 */
async function loadConfiguration() {
    // 尝试加载已保存的配置
    try {
        const savedConfig = await window.electronAPI.getConfig();
        if (savedConfig.apiKey) {
            document.getElementById('api-key').value = savedConfig.apiKey;
            document.getElementById('save-key').checked = true;
        }
        if (savedConfig.port) {
            document.getElementById('proxy-port').value = savedConfig.port;
        }
    } catch (error) {
        console.error('加载配置失败:', error);
    }
    
    updateFooterStatus('请配置您的 API Key');
    document.getElementById('btn-back').disabled = false;
    
    // 验证输入
    const apiKeyInput = document.getElementById('api-key');
    apiKeyInput.addEventListener('input', validateApiKey);
    validateApiKey();
}

/**
 * 验证 API Key
 */
function validateApiKey() {
    const apiKey = document.getElementById('api-key').value;
    const isValid = apiKey.startsWith('sk-ant-') && apiKey.length > 20;
    
    document.getElementById('btn-next').disabled = !isValid;
    
    if (apiKey && !isValid) {
        updateFooterStatus('请输入有效的 API Key');
    } else if (isValid) {
        updateFooterStatus('配置有效，可以继续');
    } else {
        updateFooterStatus('请输入您的 API Key');
    }
}

/**
 * 完成安装
 */
async function finishInstallation() {
    // 保存配置
    installStatus.config.apiKey = document.getElementById('api-key').value;
    installStatus.config.port = parseInt(document.getElementById('proxy-port').value);
    installStatus.config.baseUrl = document.getElementById('base-url').value;
    
    if (document.getElementById('save-key').checked) {
        await window.electronAPI.saveConfig(installStatus.config);
    }
    
    // 设置环境变量
    await window.electronAPI.setEnvironment({
        ANTHROPIC_BASE_URL: `http://localhost:${installStatus.config.port}/v1`,
        ANTHROPIC_API_KEY: 'proxy-key'
    });
    
    updateFooterStatus('安装和配置已完成！');
    document.getElementById('btn-next').style.display = 'none';
    document.getElementById('btn-back').style.display = 'none';
}

/**
 * 启动代理服务
 */
async function startProxy() {
    try {
        const result = await window.electronAPI.startProxy(installStatus.config);
        if (result.success) {
            alert('代理服务已启动！');
            window.close();
        } else {
            alert('启动失败: ' + result.error);
        }
    } catch (error) {
        alert('启动失败: ' + error.message);
    }
}

/**
 * 打开主应用
 */
function openMainApp() {
    window.electronAPI.openMainApp();
    window.close();
}

/**
 * 更新步骤指示器
 */
function updateStepIndicator() {
    document.querySelectorAll('.step').forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNum === currentStep) {
            step.classList.add('active');
        } else if (stepNum < currentStep) {
            step.classList.add('completed');
            step.querySelector('.step-circle').innerHTML = '✓';
        }
    });
}

/**
 * 显示指定步骤
 */
function showStep(step) {
    document.querySelectorAll('.step-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    
    document.getElementById(`step${step}`).style.display = 'block';
}

/**
 * 更新底部状态
 */
function updateFooterStatus(message) {
    document.getElementById('footer-status').textContent = message;
}

/**
 * 获取平台名称
 */
function getPlatformName(platform) {
    const names = {
        'darwin': 'macOS',
        'win32': 'Windows',
        'linux': 'Linux'
    };
    return names[platform] || platform;
}

/**
 * 延迟函数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}