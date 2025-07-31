const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const PathValidator = require('./path-validator');

/**
 * 日志级别
 */
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

/**
 * 日志记录器
 */
class Logger {
  constructor(options = {}) {
    this.level = options.level || LogLevel.INFO;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;
    
    // 创建日志目录
    const userDataPath = app.getPath('userData');
    this.logDir = PathValidator.safeJoin(userDataPath, 'logs');
    if (this.enableFile) {
      this.ensureLogDirectory();
    }
    
    this.currentLogFile = this.getLogFileName();
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 获取日志文件名
   */
  getLogFileName() {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    return path.join(this.logDir, `claude-proxy-${dateStr}.log`);
  }

  /**
   * 检查并轮转日志文件
   */
  rotateLogIfNeeded() {
    if (!this.enableFile) return;
    
    try {
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size > this.maxFileSize) {
        this.rotateLogs();
      }
    } catch (error) {
      // 文件不存在，无需轮转
    }
  }

  /**
   * 轮转日志文件
   */
  rotateLogs() {
    try {
      // 获取所有日志文件
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith('claude-proxy-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          mtime: fs.statSync(path.join(this.logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      // 删除超出数量限制的旧文件
      if (files.length >= this.maxFiles) {
        files.slice(this.maxFiles - 1).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
      
      // 重命名当前文件
      const timestamp = new Date().getTime();
      const newName = this.currentLogFile.replace('.log', `-${timestamp}.log`);
      fs.renameSync(this.currentLogFile, newName);
      
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  /**
   * 清理旧日志文件
   */
  cleanOldLogs(daysToKeep = 7) {
    if (!this.enableFile) return;
    
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const files = fs.readdirSync(this.logDir);
      
      files.forEach(file => {
        if (file.startsWith('claude-proxy-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
          }
        }
      });
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * 格式化日志消息
   */
  formatMessage(level, category, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const levelStr = this.getLevelString(level);
    
    let logMessage = `[${timestamp}] [${levelStr}] [${category}] ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  }

  /**
   * 获取日志级别字符串
   */
  getLevelString(level) {
    switch (level) {
      case LogLevel.ERROR: return 'ERROR';
      case LogLevel.WARN: return 'WARN';
      case LogLevel.INFO: return 'INFO';
      case LogLevel.DEBUG: return 'DEBUG';
      default: return 'UNKNOWN';
    }
  }

  /**
   * 写入日志
   */
  log(level, category, message, meta = {}) {
    if (level > this.level) return;
    
    const formattedMessage = this.formatMessage(level, category, message, meta);
    
    // 输出到控制台
    if (this.enableConsole) {
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }
    
    // 写入文件
    if (this.enableFile) {
      this.writeToFile(formattedMessage);
    }
  }

  /**
   * 写入日志文件
   */
  writeToFile(message) {
    try {
      this.rotateLogIfNeeded();
      fs.appendFileSync(this.currentLogFile, message + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  /**
   * 便捷方法
   */
  error(category, message, meta) {
    this.log(LogLevel.ERROR, category, message, meta);
  }

  warn(category, message, meta) {
    this.log(LogLevel.WARN, category, message, meta);
  }

  info(category, message, meta) {
    this.log(LogLevel.INFO, category, message, meta);
  }

  debug(category, message, meta) {
    this.log(LogLevel.DEBUG, category, message, meta);
  }

  /**
   * 设置日志级别
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * 获取日志文件路径
   */
  getLogFiles() {
    if (!this.enableFile) return [];
    
    try {
      return fs.readdirSync(this.logDir)
        .filter(file => file.startsWith('claude-proxy-') && file.endsWith('.log'))
        .map(file => path.join(this.logDir, file));
    } catch (error) {
      return [];
    }
  }
}

// 创建全局日志实例
const logger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: true
});

module.exports = {
  Logger,
  LogLevel,
  logger
};