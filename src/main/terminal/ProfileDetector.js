const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ProfileDetector {
  constructor() {
    this.platform = process.platform;
  }

  async detectProfiles() {
    const profiles = {};

    switch (this.platform) {
      case 'win32':
        Object.assign(profiles, await this.detectWindowsProfiles());
        break;
      case 'darwin':
        Object.assign(profiles, await this.detectMacProfiles());
        break;
      case 'linux':
        Object.assign(profiles, await this.detectLinuxProfiles());
        break;
    }

    return profiles;
  }

  async detectWindowsProfiles() {
    const profiles = {};

    // PowerShell
    const pwshPath = await this.findExecutable('pwsh.exe');
    if (pwshPath) {
      profiles['PowerShell'] = {
        path: pwshPath,
        args: ['-NoLogo'],
        icon: 'terminal-powershell'
      };
    }

    // Windows PowerShell
    profiles['Windows PowerShell'] = {
      path: 'powershell.exe',
      args: ['-NoLogo'],
      icon: 'terminal-powershell'
    };

    // Command Prompt
    profiles['Command Prompt'] = {
      path: 'cmd.exe',
      icon: 'terminal-cmd'
    };

    // Git Bash
    const gitBashPath = await this.findGitBash();
    if (gitBashPath) {
      profiles['Git Bash'] = {
        path: gitBashPath,
        args: ['--login'],
        icon: 'terminal-bash'
      };
    }

    // WSL
    const wslDistros = await this.detectWSLDistros();
    for (const distro of wslDistros) {
      profiles[`WSL (${distro})`] = {
        path: 'wsl.exe',
        args: ['-d', distro],
        icon: 'terminal-linux'
      };
    }

    return profiles;
  }

  async detectMacProfiles() {
    const profiles = {};

    // Bash
    if (await this.fileExists('/bin/bash')) {
      profiles['bash'] = {
        path: '/bin/bash',
        args: ['-l'],
        icon: 'terminal-bash'
      };
    }

    // Zsh
    if (await this.fileExists('/bin/zsh')) {
      profiles['zsh'] = {
        path: '/bin/zsh',
        args: ['-l'],
        icon: 'terminal-bash'
      };
    }

    // Fish
    const fishPath = await this.findExecutable('fish');
    if (fishPath) {
      profiles['fish'] = {
        path: fishPath,
        args: ['-l'],
        icon: 'terminal-bash'
      };
    }

    return profiles;
  }

  async detectLinuxProfiles() {
    const profiles = {};

    // Bash
    if (await this.fileExists('/bin/bash')) {
      profiles['bash'] = {
        path: '/bin/bash',
        args: ['-l'],
        icon: 'terminal-bash'
      };
    }

    // Zsh
    const zshPath = await this.findExecutable('zsh');
    if (zshPath) {
      profiles['zsh'] = {
        path: zshPath,
        args: ['-l'],
        icon: 'terminal-bash'
      };
    }

    // Fish
    const fishPath = await this.findExecutable('fish');
    if (fishPath) {
      profiles['fish'] = {
        path: fishPath,
        args: ['-l'],
        icon: 'terminal-bash'
      };
    }

    // Sh
    if (await this.fileExists('/bin/sh')) {
      profiles['sh'] = {
        path: '/bin/sh',
        icon: 'terminal-bash'
      };
    }

    return profiles;
  }

  async findGitBash() {
    const possiblePaths = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      'C:\\Git\\bin\\bash.exe'
    ];

    for (const gitPath of possiblePaths) {
      if (await this.fileExists(gitPath)) {
        return gitPath;
      }
    }

    return null;
  }

  async detectWSLDistros() {
    try {
      const { stdout } = await execAsync('wsl.exe -l -q');
      return stdout.trim().split('\n').filter(line => line.length > 0);
    } catch {
      return [];
    }
  }

  async findExecutable(command) {
    try {
      const cmd = this.platform === 'win32' ? `where ${command}` : `which ${command}`;
      const { stdout } = await execAsync(cmd);
      return stdout.trim().split('\n')[0];
    } catch {
      return null;
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Get default profile based on environment
  getDefaultProfile(profiles) {
    if (this.platform === 'win32') {
      // Prefer PowerShell Core, then Windows PowerShell
      if (profiles['PowerShell']) return 'PowerShell';
      return 'Windows PowerShell';
    } else {
      // Prefer user's default shell
      const userShell = process.env.SHELL;
      if (userShell) {
        const shellName = path.basename(userShell);
        if (profiles[shellName]) return shellName;
      }
      // Fallback to zsh or bash
      if (profiles['zsh']) return 'zsh';
      if (profiles['bash']) return 'bash';
    }
    
    // Return first available profile
    return Object.keys(profiles)[0];
  }
}

module.exports = ProfileDetector;