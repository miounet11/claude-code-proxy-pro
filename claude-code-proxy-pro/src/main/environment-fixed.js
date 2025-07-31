const { exec } = require('child_process');
const os = require('os');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 环境配置
const environments = {
  nodejs: {
    name: 'Node.js',
    checkCmd: 'node --version',
    versionRegex: /v(\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'brew install node',
      win32: 'winget install OpenJS.NodeJS',
      linux: 'sudo apt-get install nodejs'
    },
    installUrl: 'https://nodejs.org/'
  },
  git: {
    name: 'Git',
    checkCmd: 'git --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'brew install git',
      win32: 'winget install Git.Git',
      linux: 'sudo apt-get install git'
    },
    installUrl: 'https://git-scm.com/'
  },
  uv: {
    name: 'UV',
    checkCmd: 'uv --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'curl -LsSf https://astral.sh/uv/install.sh | sh',
      win32: 'powershell -c "irm https://astral.sh/uv/install.ps1 | iex"',
      linux: 'curl -LsSf https://astral.sh/uv/install.sh | sh'
    },
    installUrl: 'https://docs.astral.sh/uv/'
  },
  'claude-code': {  // 使用连字符命名以匹配前端
    name: 'Claude Code',
    checkCmd: 'claude --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'npm install -g @anthropic-ai/claude-code',
      win32: 'npm install -g @anthropic-ai/claude-code',
      linux: 'npm install -g @anthropic-ai/claude-code'
    },
    installUrl: 'https://docs.anthropic.com/claude/docs/claude-code',
    dependsOn: 'nodejs'  // 标记依赖关系
  }
};

// 检测单个环境（优化版）
async function checkEnvironment(key) {
  const env = environments[key];
  if (!env) {
    return null;
  }
  
  try {
    const { stdout } = await execAsync(env.checkCmd, {
      timeout: 5000,  // 5秒超时
      encoding: 'utf8'
    });
    
    const match = stdout.match(env.versionRegex);
    return {
      key,
      name: env.name,
      installed: true,  // 使用前端期望的字段名
      version: match ? match[1] : 'unknown',
      installCmd: env.installCmd[os.platform()],
      installUrl: env.installUrl,
      dependsOn: env.dependsOn
    };
  } catch (error) {
    return {
      key,
      name: env.name,
      installed: false,  // 使用前端期望的字段名
      version: null,
      installCmd: env.installCmd[os.platform()],
      installUrl: env.installUrl,
      dependsOn: env.dependsOn,
      error: error.message
    };
  }
}

// 并行检测所有环境（优化版）
async function checkAllEnvironments() {
  const keys = Object.keys(environments);
  
  try {
    // 并行执行所有检测
    const results = await Promise.allSettled(
      keys.map(key => checkEnvironment(key))
    );
    
    // 处理结果，确保即使部分失败也能返回
    const environmentStatus = {};
    
    results.forEach((result, index) => {
      const key = keys[index];
      if (result.status === 'fulfilled' && result.value) {
        environmentStatus[key] = result.value;
      } else {
        // 检测失败时的默认值
        environmentStatus[key] = {
          key,
          name: environments[key].name,
          installed: false,
          version: null,
          error: result.reason?.message || '检测失败'
        };
      }
    });
    
    return environmentStatus;
  } catch (error) {
    console.error('Environment check failed:', error);
    // 返回所有环境的默认状态
    return Object.fromEntries(
      keys.map(key => [key, {
        key,
        name: environments[key].name,
        installed: false,
        version: null,
        error: error.message
      }])
    );
  }
}

// 智能安装环境（处理依赖关系）
async function installEnvironment(key) {
  const env = environments[key];
  if (!env) {
    return { success: false, error: `未知环境: ${key}` };
  }
  
  const platform = os.platform();
  const cmd = env.installCmd[platform];
  if (!cmd) {
    return { 
      success: false, 
      error: `不支持的平台: ${platform}`,
      installUrl: env.installUrl
    };
  }
  
  try {
    // 检查依赖
    if (env.dependsOn) {
      const dependency = await checkEnvironment(env.dependsOn);
      if (!dependency.installed) {
        return {
          success: false,
          error: `需要先安装 ${dependency.name}`,
          dependency: env.dependsOn
        };
      }
    }
    
    // 特殊处理需要shell执行的命令
    const options = {
      shell: true,
      timeout: 300000, // 5分钟超时
      encoding: 'utf8'
    };
    
    // macOS 上检查 Homebrew
    if (platform === 'darwin' && cmd.includes('brew')) {
      try {
        await execAsync('which brew', { timeout: 2000 });
      } catch {
        return { 
          success: false, 
          error: '需要先安装 Homebrew',
          installUrl: 'https://brew.sh'
        };
      }
    }
    
    // 执行安装命令
    const { stdout, stderr } = await execAsync(cmd, options);
    
    // 验证安装是否成功
    const verifyResult = await checkEnvironment(key);
    if (verifyResult.installed) {
      return { 
        success: true, 
        message: `${env.name} 安装成功`,
        version: verifyResult.version
      };
    } else {
      return { 
        success: false, 
        error: '安装可能未完成，请检查终端输出',
        details: stderr || stdout,
        installUrl: env.installUrl
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: `${env.name} 安装失败: ${error.message}`,
      details: error.stderr || error.stdout,
      installUrl: env.installUrl
    };
  }
}

// 获取环境的安装说明
function getInstallInstructions(key) {
  const env = environments[key];
  if (!env) return null;
  
  const platform = os.platform();
  return {
    name: env.name,
    command: env.installCmd[platform],
    url: env.installUrl,
    dependsOn: env.dependsOn,
    platformName: {
      darwin: 'macOS',
      win32: 'Windows',
      linux: 'Linux'
    }[platform]
  };
}

module.exports = { 
  checkAllEnvironments, 
  installEnvironment, 
  checkEnvironment,
  getInstallInstructions
};