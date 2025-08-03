/**
 * 前端错误处理和状态管理 - 安全版本
 */

// 错误类型
const ErrorType = {
  NETWORK: 'NETWORK',
  API: 'API',
  VALIDATION: 'VALIDATION',
  SYSTEM: 'SYSTEM',
  UNKNOWN: 'UNKNOWN'
};

// 错误处理器类
class FrontendErrorHandler {
  constructor() {
    this.errorQueue = [];
    this.maxErrors = 10;
    // 延迟设置全局处理器，确保 DOM 加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupGlobalHandlers());
    } else {
      this.setupGlobalHandlers();
    }
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalHandlers() {
    try {
      // 捕获未处理的错误
      window.addEventListener('error', (event) => {
        this.handleError(new Error(event.message), ErrorType.SYSTEM, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      // 捕获未处理的Promise拒绝
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(
          new Error(event.reason?.message || event.reason || 'Unhandled Promise rejection'),
          ErrorType.SYSTEM
        );
        event.preventDefault();
      });
    } catch (error) {
      console.error('Failed to setup error handlers:', error);
    }
  }

  /**
   * 处理错误
   */
  handleError(error, type = ErrorType.UNKNOWN, details = {}) {
    const errorInfo = {
      message: error.message,
      type,
      details,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };

    // 添加到错误队列
    this.errorQueue.push(errorInfo);
    if (this.errorQueue.length > this.maxErrors) {
      this.errorQueue.shift();
    }

    // 控制台输出
    console.error('[Error]', errorInfo);

    // 显示用户提示
    this.showErrorToast(errorInfo);

    return errorInfo;
  }

  /**
   * 显示错误提示
   */
  showErrorToast(errorInfo) {
    // 使用全局的 showToast（如果存在）
    if (typeof window.showToast === 'function') {
      window.showToast(this.getErrorMessage(errorInfo), 'error');
    }
  }

  /**
   * 获取友好的错误消息
   */
  getErrorMessage(errorInfo) {
    const messages = {
      NETWORK: '网络连接错误，请检查网络设置',
      API: 'API 请求失败，请稍后重试',
      VALIDATION: '输入验证失败，请检查输入',
      SYSTEM: '系统错误，请刷新页面重试',
      UNKNOWN: '未知错误，请联系技术支持'
    };
    return messages[errorInfo.type] || errorInfo.message;
  }

  /**
   * 清除错误队列
   */
  clearErrors() {
    this.errorQueue = [];
  }

  /**
   * 获取最近的错误
   */
  getRecentErrors(count = 5) {
    return this.errorQueue.slice(-count);
  }
}

// 加载状态管理器
class LoadingStateManager {
  constructor() {
    this.loadingStates = new Map();
  }

  /**
   * 设置加载状态
   */
  setLoading(key, isLoading, message = '加载中...') {
    if (isLoading) {
      this.loadingStates.set(key, { isLoading: true, message });
      this.updateLoadingUI(true, message);
    } else {
      this.loadingStates.delete(key);
      if (this.loadingStates.size === 0) {
        this.updateLoadingUI(false);
      }
    }
  }

  /**
   * 更新加载UI
   */
  updateLoadingUI(show, message = '') {
    // 延迟执行，确保 DOM 存在
    setTimeout(() => {
      const overlay = document.getElementById('loadingOverlay');
      const text = document.getElementById('loadingText');
      
      if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
      }
      
      if (text && message) {
        text.textContent = message;
      }
    }, 0);
  }

  /**
   * 检查是否正在加载
   */
  isLoading() {
    return this.loadingStates.size > 0;
  }
}

// API 请求包装器
class APIWrapper {
  constructor(errorHandler, loadingManager) {
    this.errorHandler = errorHandler;
    this.loadingManager = loadingManager;
  }

  /**
   * 包装 electronAPI 调用
   */
  async call(method, ...args) {
    const loadingKey = `api-${method}-${Date.now()}`;
    
    try {
      // 检查 electronAPI 是否存在
      if (!window.electronAPI || typeof window.electronAPI[method] !== 'function') {
        throw new Error(`API method ${method} not found`);
      }
      
      this.loadingManager.setLoading(loadingKey, true, `正在${this.getMethodDescription(method)}...`);
      const result = await window.electronAPI[method](...args);
      return result;
    } catch (error) {
      this.errorHandler.handleError(error, ErrorType.API, { method, args });
      throw error;
    } finally {
      this.loadingManager.setLoading(loadingKey, false);
    }
  }

  /**
   * 获取方法描述
   */
  getMethodDescription(method) {
    const descriptions = {
      'startProxy': '启动代理',
      'stopProxy': '停止代理',
      'testConfig': '测试配置',
      'saveProfiles': '保存配置',
      'loadProfiles': '加载配置'
    };
    return descriptions[method] || '处理请求';
  }
}

// 表单验证器
class FormValidator {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
  }

  /**
   * 验证表单
   */
  validate(formData, rules) {
    const errors = {};
    
    for (const [field, rule] of Object.entries(rules)) {
      const value = formData[field];
      const error = this.validateField(value, rule, field);
      
      if (error) {
        errors[field] = error;
      }
    }
    
    if (Object.keys(errors).length > 0) {
      this.errorHandler.handleError(
        new Error('表单验证失败'),
        ErrorType.VALIDATION,
        { errors }
      );
      return { valid: false, errors };
    }
    
    return { valid: true, errors: {} };
  }

  /**
   * 验证单个字段
   */
  validateField(value, rule, fieldName) {
    if (rule.required && !value) {
      return `${fieldName} 是必填项`;
    }
    
    if (rule.pattern && !rule.pattern.test(value)) {
      return rule.message || `${fieldName} 格式不正确`;
    }
    
    if (rule.minLength && value.length < rule.minLength) {
      return `${fieldName} 至少需要 ${rule.minLength} 个字符`;
    }
    
    if (rule.custom && typeof rule.custom === 'function') {
      const customError = rule.custom(value);
      if (customError) {
        return customError;
      }
    }
    
    return null;
  }
}

// 验证规则
const ValidationRules = {
  profileName: {
    required: true,
    minLength: 2,
    message: '配置名称至少需要2个字符'
  },
  apiUrl: {
    required: true,
    pattern: /^https?:\/\/.+/,
    message: 'API地址必须是有效的URL'
  },
  apiKey: {
    required: true,
    minLength: 10,
    message: 'API密钥格式不正确'
  },
  proxyPort: {
    required: true,
    pattern: /^\d+$/,
    custom: (value) => {
      const port = parseInt(value);
      if (port < 1024 || port > 65535) {
        return '端口号必须在 1024-65535 之间';
      }
      return null;
    }
  }
};

// 创建全局实例 - 安全初始化
let errorHandler, loadingManager, apiWrapper, formValidator;

function initializeErrorHandling() {
  if (!errorHandler) {
    errorHandler = new FrontendErrorHandler();
    loadingManager = new LoadingStateManager();
    apiWrapper = new APIWrapper(errorHandler, loadingManager);
    formValidator = new FormValidator(errorHandler);
    
    // 导出到全局
    window.ErrorHandler = {
      errorHandler,
      loadingManager,
      apiWrapper,
      formValidator,
      ValidationRules,
      ErrorType
    };
  }
}

// 确保在 DOM 加载后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeErrorHandling);
} else {
  initializeErrorHandling();
}