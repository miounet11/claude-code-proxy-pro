const { exec, execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { logger } = require('./logger');

// 获取平台特定的额外PATH
function getAdditionalPaths(platform) {
  switch (platform) {
    case 'win32':
      return [
        'C:\\Program Files\\nodejs',
        'C:\\Program Files (x86)\\nodejs',
        'C:\\Python312\\Scripts',
        'C:\\Python311\\Scripts',
        'C:\\Python310\\Scripts',
        'C:\\tools\\python\\Scripts',
        process.env.LOCALAPPDATA + '\\Programs\\Python\\Python312\\Scripts',
        process.env.LOCALAPPDATA + '\\Programs\\Python\\Python311\\Scripts',
        process.env.APPDATA + '\\npm',
        process.env.PROGRAMFILES + '\\Git\\cmd'
      ].filter(p => p); // 过滤掉undefined
    case 'darwin':
      return [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        process.env.HOME + '/.local/bin',
        process.env.HOME + '/.cargo/bin',
        process.env.HOME + '/.rye/shims',
        '/usr/local/opt/node/bin',
        '/Applications/Claude.app/Contents/MacOS'
      ].filter(p => p);
    case 'linux':
      return [
        '/usr/local/bin',
        '/usr/bin',
        process.env.HOME + '/.local/bin',
        process.env.HOME + '/.cargo/bin',
        '/snap/bin',
        '/opt/node/bin',
        process.env.HOME + '/.nvm/versions/node/*/bin'
      ].filter(p => p);
    default:
      return [];
  }
}

// 扩展PATH环境变量
function extendPath() {
  const platform = process.platform;
  const additionalPaths = getAdditionalPaths(platform);
  const currentPath = process.env.PATH || '';
  const separator = platform === 'win32' ? ';' : ':';
  
  const pathArray = currentPath.split(separator);
  additionalPaths.forEach(p => {
    if (p && !pathArray.includes(p)) {
      // 检查路径是否存在再添加
      try {
        if (fs.existsSync(p)) {
          pathArray.push(p);
        }
      } catch (e) {
        // 忽略无法访问的路径
      }
    }
  });
  
  process.env.PATH = pathArray.join(separator);
  logger.info('Environment', 'Extended PATH for platform', { platform, addedPaths: additionalPaths.length });
}

// 获取操作系统特定的命令
function getOSSpecificCommand(cmd, platform) {
  const commands = {
    checknodejs: {
      darwin: 'node --version',
      win32: 'node.exe --version || node --version',
      linux: 'node --version'
    },
    checkgit: {
      darwin: 'git --version',
      win32: 'git.exe --version || git --version', 
      linux: 'git --version'
    },
    checkclaudeCode: {
      darwin: 'claude-code --version || claude --version',
      win32: 'claude-code.cmd --version || claude.cmd --version || claude-code --version',
      linux: 'claude-code --version || claude --version'
    },
    checkuv: {
      darwin: 'uv --version',
      win32: 'uv.exe --version || uv --version',
      linux: 'uv --version'  
    }
  };
  
  return commands[cmd] ? commands[cmd][platform] || commands[cmd].linux : cmd;
}

// 环境配置
const environments = {
  nodejs: {
    name: 'Node.js',
    checkCmd: 'node --version',
    versionRegex: /v?(\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && nvm install node',
      win32: 'winget install OpenJS.NodeJS || choco install nodejs',
      linux: 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs'
    },
    fallbackInstall: {
      darwin: 'brew install node || Download from https://nodejs.org/',
      win32: 'Download from https://nodejs.org/ or use Chocolatey: choco install nodejs',
      linux: 'sudo apt-get update && sudo apt-get install nodejs npm || sudo dnf install nodejs npm'
    },
    minVersion: '16.0.0'
  },
  git: {
    name: 'Git',
    checkCmd: 'git --version',
    versionRegex: /git version (\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'brew install git',
      win32: 'winget install Git.Git || choco install git',
      linux: 'sudo apt-get install git || sudo dnf install git'
    },
    fallbackInstall: {
      darwin: 'xcode-select --install || brew install git',
      win32: 'Download from https://git-scm.com/',
      linux: 'sudo apt update && sudo apt install git-all'
    },
    minVersion: '2.0.0'
  },
  uv: {
    name: 'UV',
    checkCmd: 'uv --version',
    versionRegex: /uv (\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'curl -LsSf https://astral.sh/uv/install.sh | sh',
      win32: 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
      linux: 'curl -LsSf https://astral.sh/uv/install.sh | sh'
    },
    fallbackInstall: {
      darwin: 'brew install uv || pip install uv',
      win32: 'pip install uv || Download from https://github.com/astral-sh/uv',
      linux: 'pip install uv || pipx install uv'
    },
    minVersion: '0.1.0'
  },
  claudeCode: {
    name: 'Claude Code',
    checkCmd: 'claude-code --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'npm install -g @anthropic-ai/claude-code',
      win32: 'npm install -g @anthropic-ai/claude-code',
      linux: 'sudo npm install -g @anthropic-ai/claude-code'
    },
    fallbackInstall: {
      darwin: 'npm install -g claude-code || yarn global add claude-code',
      win32: 'npm install -g claude-code || Download from npm registry',
      linux: 'sudo npm install -g claude-code || npm install -g claude-code --unsafe-perm'
    },
    minVersion: '1.0.0'
  }
};

// 异步检查单个环境
async function checkEnvironment(key) {
  // 首先扩展PATH
  extendPath();
  
  const env = environments[key];
  if (!env) {
    throw new Error(`Unknown environment: ${key}`);
  }

  const platform = process.platform;
  const checkCmd = getOSSpecificCommand(`check${key}`, platform);

  try {
    // 使用同步执行以获得更可靠的结果
    const output = execSync(checkCmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: process.env
    }).toString().trim();
    
    const versionMatch = output.match(env.versionRegex);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    
    logger.info('Environment', `${env.name} detected`, { version, platform });
    
    return {
      name: env.name,
      status: 'installed',
      version: version,
      platform: platform,
      minVersion: env.minVersion,
      meetsRequirement: compareVersions(version, env.minVersion) >= 0
    };
  } catch (error) {
    logger.warn('Environment', `${env.name} not found`, { error: error.message, platform });
    
    // 提供详细的安装建议
    const suggestions = [
      env.installCmd[platform],
      env.fallbackInstall[platform]
    ].filter(Boolean);
    
    return {
      name: env.name,
      status: 'not_installed',
      version: null,
      platform: platform,
      installCmd: env.installCmd[platform],
      fallbackInstall: env.fallbackInstall[platform],
      suggestions: suggestions,
      error: error.message
    };
  }
}

// 检查所有环境
async function checkAllEnvironments() {
  logger.info('Environment', 'Starting comprehensive environment check');
  
  const results = {};
  const keys = Object.keys(environments);
  
  for (const key of keys) {
    try {
      results[key] = await checkEnvironment(key);
    } catch (error) {
      logger.error('Environment', `Failed to check ${key}`, error);
      results[key] = {
        name: environments[key].name,
        status: 'error',
        error: error.message
      };
    }
  }
  
  logger.info('Environment', 'Environment check completed', { 
    summary: Object.entries(results).map(([k, v]) => `${k}: ${v.status}`).join(', ')
  });
  
  return results;
}

// 安装环境
async function installEnvironment(key) {
  const env = environments[key];
  if (!env) {
    throw new Error(`Unknown environment: ${key}`);
  }

  const platform = process.platform;
  const installCmd = env.installCmd[platform];
  
  logger.info('Environment', `Installing ${env.name}`, { platform, command: installCmd });

  try {
    // Windows需要特殊处理
    const options = {
      encoding: 'utf8',
      shell: platform === 'win32' ? 'powershell.exe' : true,
      windowsHide: true
    };
    
    const { stdout, stderr } = await execAsync(installCmd, options);
    
    logger.info('Environment', `${env.name} installation completed`, { stdout });
    
    // 验证安装
    const checkResult = await checkEnvironment(key);
    
    return {
      success: checkResult.status === 'installed',
      output: stdout,
      error: stderr,
      checkResult
    };
  } catch (error) {
    logger.error('Environment', `Failed to install ${env.name}`, error);
    
    // 提供备选安装方法
    return {
      success: false,
      error: error.message,
      fallbackInstall: env.fallbackInstall[platform],
      suggestions: [
        `Try manual installation: ${env.fallbackInstall[platform]}`,
        `Platform: ${platform}`,
        `Error: ${error.message}`
      ]
    };
  }
}

// 版本比较函数
function compareVersions(v1, v2) {
  if (!v1 || v1 === 'unknown') return -1;
  if (!v2) return 1;
  
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

module.exports = {
  checkEnvironment,
  checkAllEnvironments,
  installEnvironment,
  extendPath
};