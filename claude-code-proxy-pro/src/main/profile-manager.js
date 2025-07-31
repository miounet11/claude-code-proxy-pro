const Store = require('electron-store');
const path = require('path');

/**
 * 配置文件管理器 - 支持多配置文件
 */
class ProfileManager {
  constructor() {
    this.store = new Store({
      name: 'profiles',
      defaults: {
        profiles: [],
        currentProfileId: null
      }
    });
    
    // 默认免费配置
    this.defaultProfile = {
      id: 'default',
      name: '免费配置',
      apiUrl: 'http://www.miaoda.vip/v1',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      bigModel: 'claude-3-7-sonnet-20250219',
      smallModel: 'claude-3-5-haiku-20241022',
      proxyPort: 8082,
      isDefault: true
    };
    
    // 初始化默认配置
    this.initializeProfiles();
  }
  
  /**
   * 初始化配置文件
   */
  initializeProfiles() {
    const profiles = this.getProfiles();
    
    // 如果没有配置，添加默认配置
    if (profiles.length === 0) {
      this.addProfile(this.defaultProfile);
    }
  }
  
  /**
   * 获取所有配置文件
   */
  getProfiles() {
    return this.store.get('profiles', []);
  }
  
  /**
   * 保存所有配置文件
   */
  saveProfiles(profiles) {
    this.store.set('profiles', profiles);
  }
  
  /**
   * 添加配置文件
   */
  addProfile(profile) {
    const profiles = this.getProfiles();
    profiles.push(profile);
    this.saveProfiles(profiles);
  }
  
  /**
   * 获取指定配置
   */
  getProfile(profileId) {
    const profiles = this.getProfiles();
    return profiles.find(p => p.id === profileId);
  }
  
  /**
   * 更新配置
   */
  updateProfile(profileId, updates) {
    const profiles = this.getProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    
    if (index !== -1) {
      profiles[index] = { ...profiles[index], ...updates };
      this.saveProfiles(profiles);
      return true;
    }
    
    return false;
  }
  
  /**
   * 删除配置
   */
  deleteProfile(profileId) {
    const profiles = this.getProfiles();
    const filtered = profiles.filter(p => p.id !== profileId);
    
    if (filtered.length < profiles.length) {
      this.saveProfiles(filtered);
      return true;
    }
    
    return false;
  }
  
  /**
   * 获取当前配置ID
   */
  getCurrentProfileId() {
    return this.store.get('currentProfileId', 'default');
  }
  
  /**
   * 设置当前配置ID
   */
  setCurrentProfileId(profileId) {
    this.store.set('currentProfileId', profileId);
  }
  
  /**
   * 获取当前配置
   */
  getCurrentProfile() {
    const profileId = this.getCurrentProfileId();
    return this.getProfile(profileId) || this.defaultProfile;
  }
  
  /**
   * 导出配置
   */
  exportProfiles() {
    return {
      profiles: this.getProfiles(),
      currentProfileId: this.getCurrentProfileId()
    };
  }
  
  /**
   * 导入配置
   */
  importProfiles(data) {
    if (data.profiles && Array.isArray(data.profiles)) {
      this.saveProfiles(data.profiles);
      
      if (data.currentProfileId) {
        this.setCurrentProfileId(data.currentProfileId);
      }
      
      return true;
    }
    
    return false;
  }
}

module.exports = ProfileManager;