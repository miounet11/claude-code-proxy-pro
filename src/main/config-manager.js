const Store = require('electron-store');
const path = require('path');
const fs = require('fs');

/**
 * 配置管理器 - 集中管理应用配置
 */
class ConfigManager {
  constructor() {
    this.store = new Store({
      name: 'claude-code-proxy-config',
      defaults: this.getDefaultConfig()
    });
    
    this.configChangeCallbacks = [];
  }

  /**
   * 获取所有配置文件
   */
  getProfiles() {
    return this.store.get('profiles', []);
  }

  /**
   * 保存配置文件
   */
  saveProfile(profile) {
    const profiles = this.getProfiles();
    const index = profiles.findIndex(p => p.id === profile.id);
    
    if (index >= 0) {
      profiles[index] = profile;
    } else {
      profiles.push(profile);
    }
    
    this.store.set('profiles', profiles);
    return profile;
  }

  /**
   * 删除配置文件
   */
  deleteProfile(id) {
    const profiles = this.getProfiles();
    const filtered = profiles.filter(p => p.id !== id);
    this.store.set('profiles', filtered);
    return true;
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      api: {
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: '',
        model: 'claude-3-opus-20240229',
        maxTokens: 32000,
        timeout: 30000
      },
      proxy: {
        port: 3080,
        autoStart: false,
        enableLogging: true,
        macosSpecificLogging: true,  // 新增macOS特定日志记录
        maxRetries: 3,
        retryDelay: 1000
      },
      ui: {
        theme: 'light',
        language: 'zh-CN',
        showNotifications: true
      },
      advanced: {
        enableDebugMode: false,
        logLevel: 'info',
        maxLogSize: 10 * 1024 * 1024, // 10MB
        keepLogs: 7 // days
      }
    };
  }

  /**
   * 获取完整配置
   */
  getAll() {
    try {
      return this.store.get('config', this.getDefaultConfig());
    } catch (error) {
      console.error('Failed to get config:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * 获取配置（getAll 的别名，保持向后兼容）
   */
  getConfig() {
    return this.getAll();
  }

  /**
   * 保存配置（update 的别名，保持向后兼容）
   */
  saveConfig(config) {
    return this.update(config);
  }

  /**
   * 获取特定配置项
   */
  get(key, defaultValue = undefined) {
    try {
      const config = this.getAll();
      const keys = key.split('.');
      let value = config;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return defaultValue;
        }
      }
      
      return value;
    } catch (error) {
      console.error(`Failed to get config key ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * 设置配置项
   */
  set(key, value) {
    try {
      const config = this.getAll();
      const keys = key.split('.');
      let current = config;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!current[k] || typeof current[k] !== 'object') {
          current[k] = {};
        }
        current = current[k];
      }
      
      current[keys[keys.length - 1]] = value;
      this.store.set('config', config);
      this.notifyChange(key, value);
      
      return true;
    } catch (error) {
      console.error(`Failed to set config key ${key}:`, error);
      return false;
    }
  }

  /**
   * 更新多个配置项
   */
  update(updates) {
    try {
      const config = this.getAll();
      const mergedConfig = this.deepMerge(config, updates);
      this.store.set('config', mergedConfig);
      
      Object.keys(updates).forEach(key => {
        this.notifyChange(key, updates[key]);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to update config:', error);
      return false;
    }
  }

  /**
   * 重置配置到默认值
   */
  reset() {
    try {
      const defaultConfig = this.getDefaultConfig();
      this.store.set('config', defaultConfig);
      this.notifyChange('*', defaultConfig);
      return true;
    } catch (error) {
      console.error('Failed to reset config:', error);
      return false;
    }
  }

  /**
   * 验证配置
   */
  validate(config = null) {
    const toValidate = config || this.getAll();
    const errors = [];

    // 验证API配置
    if (!toValidate.api?.baseUrl) {
      errors.push('API base URL is required');
    }
    
    if (!toValidate.api?.apiKey) {
      errors.push('API key is required');
    }
    
    if (!toValidate.api?.model) {
      errors.push('Model is required');
    }
    
    // 验证端口号
    if (toValidate.proxy?.port) {
      const port = parseInt(toValidate.proxy.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push('Proxy port must be between 1 and 65535');
      }
    }
    
    // 验证最大令牌数
    if (toValidate.api?.maxTokens) {
      const maxTokens = parseInt(toValidate.api.maxTokens);
      if (isNaN(maxTokens) || maxTokens < 1) {
        errors.push('Max tokens must be a positive number');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 导出配置到文件
   */
  exportConfig(filePath) {
    try {
      const config = this.getAll();
      // 移除敏感信息
      const exportConfig = { ...config };
      if (exportConfig.api?.apiKey) {
        exportConfig.api.apiKey = '<REDACTED>';
      }
      
      fs.writeFileSync(filePath, JSON.stringify(exportConfig, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to export config:', error);
      return false;
    }
  }

  /**
   * 导入配置从文件
   */
  importConfig(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const importedConfig = JSON.parse(content);
      
      // 不导入API密钥
      if (importedConfig.api?.apiKey === '<REDACTED>') {
        delete importedConfig.api.apiKey;
      }
      
      const validation = this.validate(importedConfig);
      if (!validation.valid) {
        throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
      }
      
      this.update(importedConfig);
      return true;
    } catch (error) {
      console.error('Failed to import config:', error);
      return false;
    }
  }

  /**
   * 监听配置变化
   */
  onChange(callback) {
    this.configChangeCallbacks.push(callback);
    return () => {
      const index = this.configChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.configChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 通知配置变化
   */
  notifyChange(key, value) {
    this.configChangeCallbacks.forEach(callback => {
      try {
        callback(key, value);
      } catch (error) {
        console.error('Config change callback error:', error);
      }
    });
  }

  /**
   * 深度合并对象
   */
  deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
            output[key] = this.deepMerge(target[key], source[key]);
          } else {
            output[key] = source[key];
          }
        } else {
          output[key] = source[key];
        }
      }
    }
    
    return output;
  }
}

module.exports = ConfigManager;