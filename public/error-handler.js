/**
 * 前端错误处理和状态管理
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
    this.setupGlobalHandlers();
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalHandlers() {
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

    // 记录到控制台
    console.error('[Error]', errorInfo);

    // 显示用户友好的错误消息
    this.showErrorToUser(errorInfo);

    return errorInfo;
  }

  /**
   * 显示错误给用户
   */
  showErrorToUser(errorInfo) {
    const message = this.getUserFriendlyMessage(errorInfo);
    
    // 使用现有的toast系统
    if (window.showToast) {
      window.showToast(message, 'error');
    }
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(errorInfo) {
    const messages = {
      [ErrorType.NETWORK]: '网络连接失败，请检查网络设置',
      [ErrorType.API]: 'API请求失败，请检查配置',
      [ErrorType.VALIDATION]: '输入验证失败，请检查输入内容',
      [ErrorType.SYSTEM]: '系统错误，请重试或联系支持',
      [ErrorType.UNKNOWN]: '未知错误，请重试'
    };

    return messages[errorInfo.type] || errorInfo.message;
  }

  /**
   * 获取错误历史
   */
  getErrorHistory() {
    return [...this.errorQueue];
  }

  /**
   * 清除错误历史
   */
  clearErrorHistory() {
    this.errorQueue = [];
  }
}

// 加载状态管理器
class LoadingStateManager {
  constructor() {
    this.loadingStates = new Map();
    this.globalLoadingCount = 0;
  }

  /**
   * 开始加载
   */
  startLoading(key, element = null) {
    this.loadingStates.set(key, {
      startTime: Date.now(),
      element
    });
    
    this.globalLoadingCount++;
    
    if (element) {
      this.setElementLoading(element, true);
    }
    
    this.updateGlobalLoadingIndicator();
  }

  /**
   * 结束加载
   */
  endLoading(key) {
    const state = this.loadingStates.get(key);
    if (!state) return;
    
    const duration = Date.now() - state.startTime;
    
    if (state.element) {
      // 确保最小加载时间，避免闪烁
      const minDuration = 300;
      const remainingTime = Math.max(0, minDuration - duration);
      
      setTimeout(() => {
        this.setElementLoading(state.element, false);
      }, remainingTime);
    }
    
    this.loadingStates.delete(key);
    this.globalLoadingCount = Math.max(0, this.globalLoadingCount - 1);
    
    this.updateGlobalLoadingIndicator();
  }

  /**
   * 设置元素加载状态
   */
  setElementLoading(element, isLoading) {
    if (!element) return;
    
    if (isLoading) {
      element.classList.add('loading');
      element.disabled = true;
      
      // 保存原始内容
      if (!element.dataset.originalContent) {
        element.dataset.originalContent = element.innerHTML;
      }
      
      // 添加加载动画
      if (element.tagName === 'BUTTON') {
        element.innerHTML = '<span class="spinner"></span> 加载中...';
      }
    } else {
      element.classList.remove('loading');
      element.disabled = false;
      
      // 恢复原始内容
      if (element.dataset.originalContent) {
        element.innerHTML = element.dataset.originalContent;
        delete element.dataset.originalContent;
      }
    }
  }

  /**
   * 更新全局加载指示器
   */
  updateGlobalLoadingIndicator() {
    let indicator = document.getElementById('global-loading-indicator');
    
    if (this.globalLoadingCount > 0) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'global-loading-indicator';
        indicator.className = 'global-loading-indicator';
        indicator.innerHTML = '<div class="loading-bar"></div>';
        document.body.appendChild(indicator);
      }
      indicator.classList.add('active');
    } else if (indicator) {
      indicator.classList.remove('active');
      setTimeout(() => {
        if (this.globalLoadingCount === 0 && indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 300);
    }
  }

  /**
   * 是否正在加载
   */
  isLoading(key = null) {
    if (key) {
      return this.loadingStates.has(key);
    }
    return this.globalLoadingCount > 0;
  }
}

// API请求包装器
class APIWrapper {
  constructor(errorHandler, loadingManager) {
    this.errorHandler = errorHandler;
    this.loadingManager = loadingManager;
  }

  /**
   * 包装API调用
   */
  async call(apiMethod, ...args) {
    const loadingKey = `api-${apiMethod}-${Date.now()}`;
    
    try {
      this.loadingManager.startLoading(loadingKey);
      
      const result = await window.electronAPI[apiMethod](...args);
      
      // 检查API返回的错误
      if (result && !result.success && result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      // 判断错误类型
      let errorType = ErrorType.UNKNOWN;
      
      if (error.message.includes('network') || error.message.includes('timeout')) {
        errorType = ErrorType.NETWORK;
      } else if (error.message.includes('API') || error.message.includes('auth')) {
        errorType = ErrorType.API;
      }
      
      this.errorHandler.handleError(error, errorType);
      throw error;
    } finally {
      this.loadingManager.endLoading(loadingKey);
    }
  }

  /**
   * 带重试的API调用
   */
  async callWithRetry(apiMethod, args = [], options = {}) {
    const { maxRetries = 3, retryDelay = 1000, showError = true } = options;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.call(apiMethod, ...args);
      } catch (error) {
        if (i === maxRetries - 1) {
          if (showError) {
            this.errorHandler.showErrorToUser({
              message: error.message,
              type: ErrorType.API
            });
          }
          throw error;
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
      }
    }
  }
}

// 表单验证器
class FormValidator {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
    this.rules = new Map();
  }

  /**
   * 添加验证规则
   */
  addRule(fieldName, rules) {
    this.rules.set(fieldName, rules);
  }

  /**
   * 验证字段
   */
  validateField(fieldName, value) {
    const fieldRules = this.rules.get(fieldName);
    if (!fieldRules) return { valid: true };
    
    for (const rule of fieldRules) {
      const result = rule.validate(value);
      if (!result.valid) {
        return result;
      }
    }
    
    return { valid: true };
  }

  /**
   * 验证表单
   */
  validateForm(formData) {
    const errors = {};
    let isValid = true;
    
    for (const [fieldName, value] of Object.entries(formData)) {
      const result = this.validateField(fieldName, value);
      if (!result.valid) {
        errors[fieldName] = result.message;
        isValid = false;
      }
    }
    
    if (!isValid) {
      this.errorHandler.handleError(
        new Error('表单验证失败'),
        ErrorType.VALIDATION,
        { errors }
      );
    }
    
    return { valid: isValid, errors };
  }
}

// 验证规则
const ValidationRules = {
  required: (message = '此字段为必填项') => ({
    validate: (value) => ({
      valid: value !== null && value !== undefined && value !== '',
      message
    })
  }),
  
  minLength: (min, message = `最少需要${min}个字符`) => ({
    validate: (value) => ({
      valid: value && value.length >= min,
      message
    })
  }),
  
  maxLength: (max, message = `最多${max}个字符`) => ({
    validate: (value) => ({
      valid: !value || value.length <= max,
      message
    })
  }),
  
  pattern: (regex, message = '格式不正确') => ({
    validate: (value) => ({
      valid: !value || regex.test(value),
      message
    })
  }),
  
  port: (message = '端口号必须在1-65535之间') => ({
    validate: (value) => {
      const port = parseInt(value);
      return {
        valid: !isNaN(port) && port >= 1 && port <= 65535,
        message
      };
    }
  })
};

// 创建全局实例
const errorHandler = new FrontendErrorHandler();
const loadingManager = new LoadingStateManager();
const apiWrapper = new APIWrapper(errorHandler, loadingManager);
const formValidator = new FormValidator(errorHandler);

// 导出
window.ErrorHandler = {
  errorHandler,
  loadingManager,
  apiWrapper,
  formValidator,
  ValidationRules,
  ErrorType
};