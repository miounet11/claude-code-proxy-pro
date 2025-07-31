// 多语言管理器
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
    }
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
        value = value.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
      });
    }

    return value || key;
  }

  // 切换语言
  async setLocale(locale) {
    const result = await window.electronAPI.setLocale(locale);
    if (result.success) {
      this.currentLocale = locale;
      this.translations = await window.electronAPI.getTranslations();
      this.notifyListeners();
      this.updateUI();
    }
    return result.success;
  }

  // 获取当前语言
  getLocale() {
    return this.currentLocale;
  }

  // 获取支持的语言列表
  async getSupportedLocales() {
    return await window.electronAPI.getSupportedLocales();
  }

  // 添加监听器
  addListener(callback) {
    this.listeners.add(callback);
  }

  // 移除监听器
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // 通知所有监听器
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.currentLocale));
  }

  // 更新UI文本
  updateUI() {
    // 更新所有带有 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const text = this.t(key);
      
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        if (element.placeholder) {
          element.placeholder = text;
        }
      } else {
        element.textContent = text;
      }
    });

    // 更新所有带有 data-i18n-title 属性的元素
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = this.t(key);
    });

    // 更新所有带有 data-i18n-placeholder 属性的元素
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.t(key);
    });

    // 更新文档标题
    document.title = this.t('app.title');
  }

  // 创建语言选择器
  createLanguageSelector() {
    const localeMap = {
      'zh-CN': '简体中文',
      'en': 'English',
      'ja': '日本語',
      'zh-TW': '繁體中文'
    };

    const selector = document.createElement('select');
    selector.className = 'language-selector';
    selector.value = this.currentLocale;

    this.getSupportedLocales().then(locales => {
      locales.forEach(locale => {
        const option = document.createElement('option');
        option.value = locale;
        option.textContent = localeMap[locale] || locale;
        selector.appendChild(option);
      });
    });

    selector.addEventListener('change', (e) => {
      this.setLocale(e.target.value);
    });

    return selector;
  }
}

// 创建全局实例
window.i18n = new I18nManager();