const { app, dialog } = require('electron');
const { logger } = require('./logger');

/**
 * 错误类型定义
 */
const ErrorType = {
  NETWORK: 'NETWORK',
  API: 'API',
  PROXY: 'PROXY',
  CONFIG: 'CONFIG',
  SYSTEM: 'SYSTEM',
  UNKNOWN: 'UNKNOWN'
};

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, type = ErrorType.UNKNOWN, details = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * 全局错误处理器
 */
class ErrorHandler {
  constructor() {
    this.errorCallbacks = [];
    this.setupGlobalHandlers();
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalHandlers() {
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      logger.error('ErrorHandler', 'Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      
      this.handleError(error, ErrorType.SYSTEM);
      
      // 给一些时间记录错误，然后退出
      setTimeout(() => {
        app.quit();
      }, 1000);
    });

    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('ErrorHandler', 'Unhandled Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack
      });
      
      this.handleError(
        new Error(`Unhandled Promise Rejection: ${reason}`),
        ErrorType.SYSTEM
      );
    });

    // Electron崩溃报告
    app.on('render-process-gone', (event, webContents, details) => {
      logger.error('ErrorHandler', 'Renderer Process Crashed', details);
      this.handleError(
        new Error('Renderer process crashed'),
        ErrorType.SYSTEM,
        details
      );
    });

    app.on('child-process-gone', (event, details) => {
      logger.error('ErrorHandler', 'Child Process Crashed', details);
      
      // GPU 和 Utility 进程崩溃通常不是致命的，不需要特殊处理
      if (details.type === 'GPU' || details.type === 'Utility') {
        logger.info('ErrorHandler', 'Non-fatal process crash, ignoring', { type: details.type });
        return;
      }
      
      this.handleError(
        new Error('Child process crashed'),
        ErrorType.SYSTEM,
        details
      );
    });
  }

  /**
   * 处理错误
   */
  handleError(error, type = ErrorType.UNKNOWN, details = {}) {
    // 创建标准化错误对象
    const appError = error instanceof AppError ? error : new AppError(
      error.message || 'Unknown error',
      type,
      {
        ...details,
        originalError: error.name,
        stack: error.stack
      }
    );

    // 记录错误
    logger.error('ErrorHandler', appError.message, {
      type: appError.type,
      details: appError.details
    });

    // 通知错误回调
    this.notifyCallbacks(appError);

    // 根据错误类型决定是否显示对话框
    if (this.shouldShowDialog(appError)) {
      this.showErrorDialog(appError);
    }

    return appError;
  }

  /**
   * 判断是否应该显示错误对话框
   */
  shouldShowDialog(error) {
    // 某些错误类型不需要打扰用户
    const silentTypes = [ErrorType.NETWORK, ErrorType.API];
    return !silentTypes.includes(error.type);
  }

  /**
   * 显示错误对话框
   */
  showErrorDialog(error) {
    // 确保 app 已经 ready
    if (!app.isReady()) {
      // 如果 app 还没 ready，等待后再显示
      app.whenReady().then(() => {
        this.showErrorDialog(error);
      });
      return;
    }

    const options = {
      type: 'error',
      title: '错误',
      message: this.getErrorMessage(error),
      detail: this.getErrorDetail(error),
      buttons: ['确定']
    };

    // 如果是严重错误，添加退出选项
    if (error.type === ErrorType.SYSTEM) {
      options.buttons.push('退出应用');
      options.defaultId = 1;
    }

    dialog.showMessageBox(options).then(result => {
      if (result.response === 1 && error.type === ErrorType.SYSTEM) {
        app.quit();
      }
    });
  }

  /**
   * 获取用户友好的错误消息
   */
  getErrorMessage(error) {
    const messages = {
      [ErrorType.NETWORK]: '网络连接错误',
      [ErrorType.API]: 'API 请求失败',
      [ErrorType.PROXY]: '代理服务错误',
      [ErrorType.CONFIG]: '配置错误',
      [ErrorType.SYSTEM]: '系统错误',
      [ErrorType.UNKNOWN]: '未知错误'
    };

    return messages[error.type] || error.message;
  }

  /**
   * 获取错误详情
   */
  getErrorDetail(error) {
    let detail = error.message;

    if (error.details) {
      if (error.details.code) {
        detail += `\n错误代码: ${error.details.code}`;
      }
      if (error.details.statusCode) {
        detail += `\n状态码: ${error.details.statusCode}`;
      }
    }

    return detail;
  }

  /**
   * 注册错误回调
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 通知错误回调
   */
  notifyCallbacks(error) {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (e) {
        logger.error('ErrorHandler', 'Error in error callback', {
          error: e.message
        });
      }
    });
  }

  /**
   * 包装异步函数以处理错误
   */
  wrapAsync(fn, errorType = ErrorType.UNKNOWN) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        throw this.handleError(error, errorType);
      }
    };
  }

  /**
   * 包装IPC处理器
   */
  wrapIpcHandler(handler, errorType = ErrorType.UNKNOWN) {
    return async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (error) {
        const appError = this.handleError(error, errorType);
        return {
          success: false,
          error: appError.message,
          details: appError.details
        };
      }
    };
  }
}

// 创建全局错误处理器实例
const errorHandler = new ErrorHandler();

module.exports = {
  ErrorHandler,
  ErrorType,
  AppError,
  errorHandler
};