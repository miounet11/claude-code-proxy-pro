const path = require('path');
const fs = require('fs').promises;

class ShellIntegration {
  constructor() {
    // Shell integration scripts for different shells
    this.integrationScripts = {
      bash: this.getBashIntegration(),
      zsh: this.getZshIntegration(),
      fish: this.getFishIntegration(),
      pwsh: this.getPowerShellIntegration()
    };
  }

  isSupported(shellPath) {
    const shellName = path.basename(shellPath).toLowerCase();
    return ['bash', 'zsh', 'fish', 'pwsh', 'powershell'].some(name => 
      shellName.includes(name)
    );
  }

  async inject(terminal) {
    const shellName = this.detectShellType(terminal.shell);
    const script = this.integrationScripts[shellName];
    
    if (script) {
      // Wait a bit for shell to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send the integration script
      terminal.write(script + '\n');
      
      return true;
    }
    
    return false;
  }

  detectShellType(shellPath) {
    const shellName = path.basename(shellPath).toLowerCase();
    
    if (shellName.includes('bash')) return 'bash';
    if (shellName.includes('zsh')) return 'zsh';
    if (shellName.includes('fish')) return 'fish';
    if (shellName.includes('pwsh') || shellName.includes('powershell')) return 'pwsh';
    
    return null;
  }

  getBashIntegration() {
    return `
# VS Code Shell Integration for Bash
if [[ "$TERM_PROGRAM" != "vscode" ]]; then
  __vsc_prompt_start() {
    printf "\\033]633;A\\007"
  }
  
  __vsc_prompt_end() {
    printf "\\033]633;B;%s\\007" "$?"
  }
  
  __vsc_update_cwd() {
    printf "\\033]633;P;cwd=%s\\007" "$PWD"
  }
  
  # Set up prompt command
  if [[ -n "$PROMPT_COMMAND" ]]; then
    PROMPT_COMMAND="__vsc_prompt_start; $PROMPT_COMMAND; __vsc_prompt_end"
  else
    PROMPT_COMMAND="__vsc_prompt_start; __vsc_prompt_end"
  fi
  
  # Update CWD on each command
  PROMPT_COMMAND="$PROMPT_COMMAND; __vsc_update_cwd"
  
  # Send initial CWD
  __vsc_update_cwd
fi`.trim();
  }

  getZshIntegration() {
    return `
# VS Code Shell Integration for Zsh
if [[ "$TERM_PROGRAM" != "vscode" ]]; then
  __vsc_prompt_start() {
    printf "\\033]633;A\\007"
  }
  
  __vsc_prompt_end() {
    printf "\\033]633;B;%s\\007" "$?"
  }
  
  __vsc_update_cwd() {
    printf "\\033]633;P;cwd=%s\\007" "$PWD"
  }
  
  # Hook into Zsh's prompt system
  autoload -Uz add-zsh-hook
  
  add-zsh-hook preexec __vsc_prompt_start
  add-zsh-hook precmd __vsc_prompt_end
  add-zsh-hook chpwd __vsc_update_cwd
  
  # Send initial CWD
  __vsc_update_cwd
fi`.trim();
  }

  getFishIntegration() {
    return `
# VS Code Shell Integration for Fish
if test "$TERM_PROGRAM" != "vscode"
  function __vsc_prompt_start --on-event fish_preexec
    printf "\\033]633;A\\007"
  end
  
  function __vsc_prompt_end --on-event fish_prompt
    printf "\\033]633;B;%s\\007" $status
  end
  
  function __vsc_update_cwd --on-variable PWD
    printf "\\033]633;P;cwd=%s\\007" $PWD
  end
  
  # Send initial CWD
  __vsc_update_cwd
end`.trim();
  }

  getPowerShellIntegration() {
    return `
# VS Code Shell Integration for PowerShell
if ($env:TERM_PROGRAM -ne "vscode") {
  function Global:__VSCode-Prompt-Start {
    Write-Host -NoNewline ([char]27 + "]633;A" + [char]7)
  }
  
  function Global:__VSCode-Prompt-End {
    $LastExitCode = if ($?) { 0 } else { 1 }
    Write-Host -NoNewline ([char]27 + "]633;B;$LastExitCode" + [char]7)
  }
  
  function Global:__VSCode-Update-Cwd {
    Write-Host -NoNewline ([char]27 + "]633;P;cwd=$PWD" + [char]7)
  }
  
  # Hook into PowerShell's prompt
  $Global:__VSCodeOriginalPrompt = $function:prompt
  
  function Global:prompt {
    __VSCode-Prompt-End
    __VSCode-Update-Cwd
    
    # Call original prompt
    & $Global:__VSCodeOriginalPrompt
    
    __VSCode-Prompt-Start
    
    # Return empty to prevent double prompt
    return ""
  }
  
  # Send initial CWD
  __VSCode-Update-Cwd
}`.trim();
  }

  // Generate a shell integration configuration file
  async generateConfigFile(shellType, targetPath) {
    const script = this.integrationScripts[shellType];
    if (script) {
      await fs.writeFile(targetPath, script, 'utf8');
      return true;
    }
    return false;
  }

  // Get shell integration status from terminal data
  parseIntegrationStatus(data) {
    // Check for VS Code sequences in the data
    const hasCommandTracking = data.includes('\x1b]633;A\x07') || 
                              data.includes('\x1b]633;B;');
    const hasCwdTracking = data.includes('\x1b]633;P;cwd=');
    
    if (hasCommandTracking && hasCwdTracking) {
      return 'full';
    } else if (hasCommandTracking || hasCwdTracking) {
      return 'partial';
    } else {
      return 'none';
    }
  }
}

module.exports = ShellIntegration;