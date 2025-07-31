const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { logger } = require('./logger');

class I18nManager {
  constructor() {
    this.currentLocale = 'zh-CN'; // 默认中文
    this.translations = {};
    this.supportedLocales = ['zh-CN', 'en', 'ja', 'zh-TW'];
  }

  init() {
    // 获取系统语言
    const systemLocale = app.getLocale();
    
    // 匹配支持的语言
    if (systemLocale.startsWith('zh')) {
      if (systemLocale.includes('TW') || systemLocale.includes('HK')) {
        this.currentLocale = 'zh-TW';
      } else {
        this.currentLocale = 'zh-CN';
      }
    } else if (systemLocale.startsWith('ja')) {
      this.currentLocale = 'ja';
    } else if (systemLocale.startsWith('en')) {
      this.currentLocale = 'en';
    }

    this.loadTranslations();
    logger.info('I18n', 'Initialized', { 
      systemLocale, 
      currentLocale: this.currentLocale 
    });
  }

  loadTranslations() {
    for (const locale of this.supportedLocales) {
      try {
        const filePath = path.join(__dirname, '..', '..', 'locales', `${locale}.json`);
        this.translations[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        logger.error('I18n', `Failed to load locale: ${locale}`, error);
      }
    }
  }

  setLocale(locale) {
    if (this.supportedLocales.includes(locale)) {
      this.currentLocale = locale;
      logger.info('I18n', 'Locale changed', { locale });
      return true;
    }
    return false;
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations[this.currentLocale];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = key; // 返回原始key作为后备
        break;
      }
    }

    // 替换参数
    if (typeof value === 'string') {
      Object.keys(params).forEach(param => {
        value = value.replace(`{{${param}}}`, params[param]);
      });
    }

    return value || key;
  }

  getLocale() {
    return this.currentLocale;
  }

  getSupportedLocales() {
    return this.supportedLocales;
  }
}

module.exports = new I18nManager();