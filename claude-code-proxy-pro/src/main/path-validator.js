const path = require('path');
const fs = require('fs');

/**
 * 路径安全验证器
 */
class PathValidator {
  /**
   * 验证路径是否安全（防止路径遍历攻击）
   * @param {string} userPath - 用户提供的路径
   * @param {string} basePath - 基础路径
   * @returns {string|null} - 返回安全的绝对路径或null
   */
  static validatePath(userPath, basePath) {
    if (!userPath || !basePath) {
      return null;
    }

    // 规范化路径
    const normalizedBase = path.resolve(basePath);
    const normalizedPath = path.resolve(basePath, userPath);

    // 确保结果路径在基础路径内
    if (!normalizedPath.startsWith(normalizedBase)) {
      return null;
    }

    return normalizedPath;
  }

  /**
   * 安全地连接路径
   * @param {string} basePath - 基础路径
   * @param {...string} paths - 要连接的路径部分
   * @returns {string} - 安全的绝对路径
   */
  static safeJoin(basePath, ...paths) {
    const resolvedBase = path.resolve(basePath);
    const joined = path.join(resolvedBase, ...paths);
    const resolved = path.resolve(joined);

    // 确保结果路径在基础路径内
    if (!resolved.startsWith(resolvedBase)) {
      throw new Error('Path traversal attempt detected');
    }

    return resolved;
  }

  /**
   * 验证文件名是否安全
   * @param {string} filename - 文件名
   * @returns {boolean} - 是否安全
   */
  static isValidFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return false;
    }

    // 检查危险字符
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      return false;
    }

    // 检查路径遍历尝试
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return false;
    }

    // 检查保留名称（Windows）
    const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
    if (reservedNames.test(filename)) {
      return false;
    }

    return true;
  }

  /**
   * 获取安全的临时文件路径
   * @param {string} prefix - 文件名前缀
   * @param {string} extension - 文件扩展名
   * @returns {string} - 安全的临时文件路径
   */
  static getTempFilePath(prefix = 'temp', extension = 'tmp') {
    const { app } = require('electron');
    const tempDir = app.getPath('temp');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const filename = `${prefix}-${timestamp}-${random}.${extension}`;
    
    return this.safeJoin(tempDir, filename);
  }

  /**
   * 确保目录存在且安全
   * @param {string} dirPath - 目录路径
   * @param {string} basePath - 基础路径
   * @returns {boolean} - 是否成功
   */
  static ensureSafeDirectory(dirPath, basePath) {
    const safePath = this.validatePath(dirPath, basePath);
    if (!safePath) {
      return false;
    }

    try {
      if (!fs.existsSync(safePath)) {
        fs.mkdirSync(safePath, { recursive: true });
      }
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = PathValidator;