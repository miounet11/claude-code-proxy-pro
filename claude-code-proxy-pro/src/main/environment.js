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
    }
  },
  git: {
    name: 'Git',
    checkCmd: 'git --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'brew install git',
      win32: 'winget install Git.Git',
      linux: 'sudo apt-get install git'
    }
  },
  uv: {
    name: 'UV',
    checkCmd: 'uv --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'curl -LsSf https://astral.sh/uv/install.sh | sh',
      win32: 'powershell -c "irm https://astral.sh/uv/install.ps1 | iex"',
      linux: 'curl -LsSf https://astral.sh/uv/install.sh | sh'
    }
  },
  claudeCode: {
    name: 'Claude Code',
    checkCmd: 'claude --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    installCmd: {
      darwin: 'npm install -g @anthropic-ai/claude-code',
      win32: 'npm install -g @anthropic-ai/claude-code',
      linux: 'npm install -g @anthropic-ai/claude-code'
    }
  }
};

// 检测单个环境
async function checkEnvironment(key) {
  const env = environments[key];
  try {
    const { stdout } = await execAsync(env.checkCmd);
    const match = stdout.match(env.versionRegex);
    return {
      name: env.name,
      status: 'installed',
      version: match ? match[1] : 'unknown',
      installCmd: env.installCmd[os.platform()]
    };
  } catch {
    return {
      name: env.name,
      status: 'not_installed',
      version: null,
      installCmd: env.installCmd[os.platform()]
    };
  }
}

// 并行检测所有环境
async function checkAllEnvironments() {
  const keys = Object.keys(environments);
  const results = await Promise.all(keys.map(key => checkEnvironment(key)));
  return Object.fromEntries(keys.map((key, i) => [key, results[i]]));
}

// 一键安装
async function installEnvironment(key) {
  const env = environments[key];
  const platform = os.platform();
  const cmd = env.installCmd[platform];
  if (!cmd) return { success: false, error: `不支持的平台: ${platform}` };
  
  try {
    // 特殊处理需要shell执行的命令
    const options = {
      shell: true,
      timeout: 300000 // 5分钟超时
    };
    
    // macOS 上某些命令可能需要用户交互
    if (platform === 'darwin' && (key === 'nodejs' || key === 'git')) {
      // 检查是否安装了 Homebrew
      try {
        await execAsync('which brew');
      } catch {
        return { 
          success: false, 
          error: '需要先安装 Homebrew。请访问 https://brew.sh 安装' 
        };
      }
    }
    
    const { stdout, stderr } = await execAsync(cmd, options);
    
    // 验证安装是否成功
    const verifyResult = await checkEnvironment(key);
    if (verifyResult.status === 'installed') {
      return { success: true, message: `${env.name} 安装成功` };
    } else {
      return { 
        success: false, 
        error: '安装可能未完成，请检查终端输出',
        details: stderr || stdout
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: `${env.name} 安装失败: ${error.message}`,
      details: error.stderr || error.stdout
    };
  }
}

module.exports = { checkAllEnvironments, installEnvironment, checkEnvironment };