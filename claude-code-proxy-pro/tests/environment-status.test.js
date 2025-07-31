/**
 * Claude Code Proxy Pro - 环境状态显示功能测试用例
 * 
 * 测试目标：
 * 1. 验证环境检测逻辑的正确性
 * 2. 验证数据传递和格式转换的准确性
 * 3. 验证 UI 更新的完整性
 * 4. 验证错误处理和边界情况
 */

describe('环境状态显示功能测试', () => {
  
  describe('1. 环境检测模块测试', () => {
    
    test('1.1 应正确检测已安装的环境', async () => {
      // 模拟已安装 Node.js 的情况
      const result = await checkEnvironment('nodejs');
      expect(result).toMatchObject({
        name: 'Node.js',
        status: 'installed',
        version: expect.stringMatching(/\d+\.\d+\.\d+/),
        installCmd: expect.any(String)
      });
    });
    
    test('1.2 应正确检测未安装的环境', async () => {
      // 模拟未安装的环境
      const result = await checkEnvironment('uv');
      expect(result).toMatchObject({
        name: 'UV',
        status: 'not_installed',
        version: null,
        installCmd: expect.any(String)
      });
    });
    
    test('1.3 应正确处理命令执行超时', async () => {
      // 模拟超时情况
      jest.setTimeout(6000);
      const result = await checkEnvironment('slow-command');
      expect(result.status).toBe('not_installed');
    });
    
    test('1.4 应正确处理无效的环境键名', async () => {
      const result = await checkEnvironment('invalid-env');
      expect(result).toBeUndefined();
    });
  });
  
  describe('2. IPC 通信测试', () => {
    
    test('2.1 主进程应正确响应环境检测请求', async () => {
      const response = await ipcRenderer.invoke('check-environments');
      expect(response).toHaveProperty('nodejs');
      expect(response).toHaveProperty('git');
      expect(response).toHaveProperty('uv');
      expect(response).toHaveProperty('claudeCode');
    });
    
    test('2.2 应正确处理 IPC 通信错误', async () => {
      // 模拟网络错误
      mockIpcError();
      try {
        await ipcRenderer.invoke('check-environments');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
    
    test('2.3 数据格式转换应正确', async () => {
      const backendData = {
        nodejs: { status: 'installed', version: '20.0.0' },
        git: { status: 'not_installed', version: null }
      };
      
      const frontendData = transformEnvironmentData(backendData);
      expect(frontendData).toEqual({
        nodejs: { installed: true },
        git: { installed: false }
      });
    });
  });
  
  describe('3. UI 更新测试', () => {
    
    test('3.1 已安装环境应显示绿色勾号', () => {
      const element = document.getElementById('nodejs-status');
      updateEnvironmentStatus({ nodejs: { installed: true } });
      
      expect(element.textContent).toBe('✅');
      expect(element.classList.contains('installed')).toBe(true);
      expect(element.classList.contains('missing')).toBe(false);
    });
    
    test('3.2 未安装环境应显示灰色方块', () => {
      const element = document.getElementById('git-status');
      updateEnvironmentStatus({ git: { installed: false } });
      
      expect(element.textContent).toBe('⬜');
      expect(element.classList.contains('missing')).toBe(true);
      expect(element.classList.contains('installed')).toBe(false);
    });
    
    test('3.3 应正确处理键名映射', () => {
      const element = document.getElementById('claude-code-status');
      updateEnvironmentStatus({ 'claude-code': { installed: true } });
      
      expect(element.textContent).toBe('✅');
    });
    
    test('3.4 应忽略不存在的元素', () => {
      // 不应抛出错误
      expect(() => {
        updateEnvironmentStatus({ 'non-existent': { installed: true } });
      }).not.toThrow();
    });
  });
  
  describe('4. 异步加载和性能测试', () => {
    
    test('4.1 应在页面加载后自动检测环境', async () => {
      const checkEnvSpy = jest.spyOn(window.proxyManager, 'checkEnvironments');
      await new ProxyManager().init();
      
      expect(checkEnvSpy).toHaveBeenCalled();
    });
    
    test('4.2 环境检测应并行执行', async () => {
      const startTime = Date.now();
      await checkAllEnvironments();
      const duration = Date.now() - startTime;
      
      // 并行执行应该在 2 秒内完成所有检测
      expect(duration).toBeLessThan(2000);
    });
    
    test('4.3 应显示加载状态', async () => {
      const manager = new ProxyManager();
      const promise = manager.checkEnvironments();
      
      // 检查是否显示加载状态
      expect(document.querySelector('.env-loading')).toBeTruthy();
      
      await promise;
      
      // 加载完成后应移除加载状态
      expect(document.querySelector('.env-loading')).toBeFalsy();
    });
  });
  
  describe('5. 错误处理和边界情况', () => {
    
    test('5.1 环境检测失败时应显示错误状态', async () => {
      mockCheckEnvironmentError();
      await proxyManager.checkEnvironments();
      
      const element = document.getElementById('nodejs-status');
      expect(element.textContent).toBe('❌');
      expect(element.title).toContain('检测失败');
    });
    
    test('5.2 应处理部分环境检测失败', async () => {
      // 模拟 Node.js 检测成功，Git 检测失败
      mockPartialFailure();
      await proxyManager.checkEnvironments();
      
      expect(document.getElementById('nodejs-status').textContent).toBe('✅');
      expect(document.getElementById('git-status').textContent).toBe('❌');
    });
    
    test('5.3 应处理空响应', async () => {
      mockEmptyResponse();
      await proxyManager.checkEnvironments();
      
      // 所有状态应保持默认
      ['nodejs', 'git', 'uv', 'claude-code'].forEach(env => {
        const element = document.getElementById(`${env}-status`);
        expect(element.textContent).toBe('⚪');
      });
    });
  });
  
  describe('6. 用户交互测试', () => {
    
    test('6.1 点击未安装环境应显示安装提示', async () => {
      const envItem = document.querySelector('[data-env="nodejs"]');
      const statusIcon = document.getElementById('nodejs-status');
      statusIcon.classList.add('missing');
      
      envItem.click();
      
      const tooltip = document.querySelector('.install-tooltip');
      expect(tooltip).toBeTruthy();
      expect(tooltip.textContent).toContain('点击安装 Node.js');
    });
    
    test('6.2 鼠标悬停应显示版本信息', async () => {
      const envItem = document.querySelector('[data-env="nodejs"]');
      envItem.dataset.version = '20.0.0';
      
      const event = new MouseEvent('mouseenter');
      envItem.dispatchEvent(event);
      
      const tooltip = document.querySelector('.version-tooltip');
      expect(tooltip.textContent).toBe('版本: 20.0.0');
    });
    
    test('6.3 应支持键盘导航', () => {
      const envItems = document.querySelectorAll('.env-item');
      envItems[0].focus();
      
      // 按 Enter 键应触发点击事件
      const clickSpy = jest.fn();
      envItems[0].addEventListener('click', clickSpy);
      
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      envItems[0].dispatchEvent(event);
      
      expect(clickSpy).toHaveBeenCalled();
    });
  });
  
  describe('7. 安装流程测试', () => {
    
    test('7.1 点击安装应显示确认对话框', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      await installEnvironmentWithUI('nodejs');
      
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('确定要安装 Node.js 吗？')
      );
    });
    
    test('7.2 安装过程应显示进度', async () => {
      const promise = installEnvironmentWithUI('git');
      
      // 应立即显示安装中状态
      const statusIcon = document.getElementById('git-status');
      expect(statusIcon.textContent).toBe('⏳');
      expect(statusIcon.classList.contains('installing')).toBe(true);
      
      await promise;
    });
    
    test('7.3 安装成功应更新状态', async () => {
      mockSuccessfulInstall();
      await installEnvironmentWithUI('uv');
      
      const statusIcon = document.getElementById('uv-status');
      expect(statusIcon.textContent).toBe('✅');
      expect(statusIcon.classList.contains('installed')).toBe(true);
    });
    
    test('7.4 安装失败应显示错误', async () => {
      mockFailedInstall();
      await installEnvironmentWithUI('claude-code');
      
      const toast = document.querySelector('.toast.error');
      expect(toast.textContent).toContain('安装失败');
    });
  });
});

// 辅助函数
function transformEnvironmentData(backendData) {
  const result = {};
  for (const [key, value] of Object.entries(backendData)) {
    result[key] = {
      installed: value.status === 'installed'
    };
  }
  return result;
}