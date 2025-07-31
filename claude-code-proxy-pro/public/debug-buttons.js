// 调试脚本 - 检查按钮状态
console.log('=== 按钮调试开始 ===');

// 等待DOM加载
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM已加载');
    
    // 检查electronAPI
    console.log('electronAPI状态:', window.electronAPI ? '✅ 已加载' : '❌ 未加载');
    
    // 检查所有按钮
    const buttonIds = [
        'checkEnvBtn',
        'toggleApiKey',
        'saveEnvBtn',
        'testEnvBtn',
        'startClaudeBtn',
        'openTerminalBtn',
        'copyEnvBtn',
        'exportScriptBtn',
        'resetConfigBtn'
    ];
    
    console.log('\n按钮检查:');
    buttonIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            console.log(`✅ ${id}: 找到`);
            
            // 检查是否有事件监听器
            const listeners = getEventListeners ? getEventListeners(btn) : null;
            if (listeners && listeners.click) {
                console.log(`   - 点击事件: ${listeners.click.length}个`);
            }
            
            // 检查按钮状态
            console.log(`   - 禁用状态: ${btn.disabled}`);
            console.log(`   - 类名: ${btn.className}`);
        } else {
            console.log(`❌ ${id}: 未找到`);
        }
    });
    
    // 添加测试点击功能
    window.testButton = function(buttonId) {
        const btn = document.getElementById(buttonId);
        if (btn) {
            console.log(`\n测试点击按钮: ${buttonId}`);
            btn.click();
        } else {
            console.log(`按钮 ${buttonId} 不存在`);
        }
    };
    
    console.log('\n💡 提示: 使用 testButton("buttonId") 来测试按钮点击');
    console.log('例如: testButton("checkEnvBtn")');
});

// 监听全局错误
window.addEventListener('error', (e) => {
    console.error('❌ JavaScript错误:', e.message);
    console.error('文件:', e.filename);
    console.error('行号:', e.lineno);
});

// 监听未处理的Promise拒绝
window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ 未处理的Promise拒绝:', e.reason);
});