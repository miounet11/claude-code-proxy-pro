const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');
const { logger } = require('./logger');

class UpdateManager {
  constructor() {
    this.mainWindow = null;
    this.isManualCheck = false;
    
    // 配置更新服务器
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    // 设置更新检查间隔（仅在生产环境）
    if (process.env.NODE_ENV !== 'development') {
      autoUpdater.checkForUpdatesAndNotify();
    }
    
    this.setupEventHandlers();
  }
  
  setMainWindow(window) {
    this.mainWindow = window;
  }
  
  setupEventHandlers() {
    // 检查更新时
    autoUpdater.on('checking-for-update', () => {
      logger.info('Updater', '正在检查更新...');
      this.sendStatusToWindow('checking-for-update');
    });
    
    // 发现新版本
    autoUpdater.on('update-available', (info) => {
      logger.info('Updater', '发现新版本', info);
      this.sendStatusToWindow('update-available', info);
      
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${info.version}，是否下载？`,
        detail: `当前版本：${app.getVersion()}\n最新版本：${info.version}\n\n更新内容：\n${info.releaseNotes || '暂无更新说明'}`,
        buttons: ['立即下载', '稍后提醒'],
        defaultId: 0,
        cancelId: 1
      }).then(result => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    });
    
    // 没有新版本
    autoUpdater.on('update-not-available', (info) => {
      logger.info('Updater', '当前已是最新版本', info);
      this.sendStatusToWindow('update-not-available');
      
      if (this.isManualCheck) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: '检查更新',
          message: '当前已是最新版本',
          detail: `当前版本：${app.getVersion()}`
        });
      }
    });
    
    // 更新错误
    autoUpdater.on('error', (err) => {
      logger.error('Updater', '更新检查失败', err);
      this.sendStatusToWindow('update-error', err);
      
      if (this.isManualCheck) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'error',
          title: '更新失败',
          message: '检查更新时发生错误',
          detail: err.message
        });
      }
    });
    
    // 下载进度
    autoUpdater.on('download-progress', (progressObj) => {
      let logMessage = `下载速度: ${this.formatBytes(progressObj.bytesPerSecond)}/s`;
      logMessage += ` - 已下载 ${progressObj.percent.toFixed(2)}%`;
      logMessage += ` (${this.formatBytes(progressObj.transferred)}/${this.formatBytes(progressObj.total)})`;
      
      logger.info('Updater', logMessage);
      this.sendStatusToWindow('download-progress', progressObj);
    });
    
    // 下载完成
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Updater', '更新下载完成', info);
      this.sendStatusToWindow('update-downloaded', info);
      
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: '更新已就绪',
        message: '新版本已下载完成，是否立即安装？',
        detail: '应用将重启以完成更新',
        buttons: ['立即安装', '稍后安装'],
        defaultId: 0,
        cancelId: 1
      }).then(result => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }
  
  // 手动检查更新
  checkForUpdates() {
    this.isManualCheck = true;
    autoUpdater.checkForUpdates();
    
    // 重置手动检查标志
    setTimeout(() => {
      this.isManualCheck = false;
    }, 30000);
  }
  
  // 发送状态到渲染进程
  sendStatusToWindow(status, data = null) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-status', { status, data });
    }
  }
  
  // 格式化字节大小
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // 设置更新服务器 URL
  setFeedURL(url) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: url
    });
  }
}

module.exports = UpdateManager;