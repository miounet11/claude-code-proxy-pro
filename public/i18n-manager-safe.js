// 多语言管理器 - 安全版本
class I18nManager {
  constructor() {
    this.translations = {};
    this.currentLocale = 'zh-CN';
    this.initialized = false;
    this.listeners = new Set();
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // 等待 electronAPI 可用
      await this.waitForElectronAPI();
      
      // 获取当前语言设置
      this.currentLocale = await window.electronAPI.getLocale();
      
      // 获取翻译内容
      this.translations = await window.electronAPI.getTranslations();
      
      // 监听语言变化
      window.electronAPI.onLocaleChanged(async (locale) => {
        this.currentLocale = locale;
        this.translations = await window.electronAPI.getTranslations();
        this.notifyListeners();
        this.updateUI();
      });
      
      this.initialized = true;
      this.updateUI();
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
      // 设置默认值，避免后续代码崩溃
      this.translations = {};
      this.currentLocale = 'zh-CN';
      this.initialized = true;
    }
  }
  
  // 等待 electronAPI 可用
  async waitForElectronAPI(maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
      if (window.electronAPI) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('ElectronAPI not available after timeout');
  }

  // 获取翻译文本
  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // 返回原始key作为后备
      }
    }

    // 替换参数
    if (typeof value === 'string') {
      Object.keys(params).forEach(param => {
        value = value.replace(`{${param}}`, params[param]);
      });
    }

    return value || key;
  }

  // 获取支持的语言列表
  async getSupportedLocales() {
    try {
      if (!window.electronAPI) return [];
      return await window.electronAPI.getSupportedLocales();
    } catch (error) {
      console.error('Failed to get supported locales:', error);
      return [];
    }
  }

  // 设置语言
  async setLocale(locale) {
    try {
      if (!window.electronAPI) return;
      await window.electronAPI.setLocale(locale);
    } catch (error) {
      console.error('Failed to set locale:', error);
    }
  }

  // 添加监听器
  addListener(listener) {
    this.listeners.add(listener);
  }

  // 移除监听器
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  // 通知监听器
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentLocale);
      } catch (error) {
        console.error('Error in i18n listener:', error);
      }
    });
  }

  // 更新UI
  updateUI() {
    // 更新所有带有 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        element.textContent = this.t(key);
      }
    });

    // 更新所有带有 data-i18n-placeholder 属性的元素
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (key) {
        element.placeholder = this.t(key);
      }
    });

    // 更新所有带有 data-i18n-title 属性的元素
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      if (key) {
        element.title = this.t(key);
      }
    });
  }

  // 创建语言选择器
  createLanguageSelector() {
    const container = document.createElement('div');
    container.className = 'language-selector';
    
    const select = document.createElement('select');
    select.className = 'language-select';
    
    this.getSupportedLocales().then(locales => {
      locales.forEach(locale => {
        const option = document.createElement('option');
        option.value = locale.code;
        option.textContent = locale.name;
        if (locale.code === this.currentLocale) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    });
    
    select.addEventListener('change', (e) => {
      this.setLocale(e.target.value);
    });
    
    container.appendChild(select);
    return container;
  }
}

// 创建全局实例
window.i18n = new I18nManager();

// 尝试自动初始化，但不阻塞
window.i18n.init().catch(error => {
  console.warn('i18n auto-init failed, will retry later:', error);
});