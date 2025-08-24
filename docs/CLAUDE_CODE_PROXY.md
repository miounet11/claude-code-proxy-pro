## Claude Code Proxy: 快速安装与配置

### 目标
- 本机无 Docker，安装并运行 `claude-code-proxy` 在 `127.0.0.1:8082`
- 用户按向导填写 LLM 配置（OpenAI Key 等）
- 将 Claude Code 的请求中转到本地代理

### 1) 一键安装与启动（推荐）

```bash
# 安装并启动（默认端口 8082）
bash scripts/install-claude-proxy.sh \
  --openai-key sk-xxxx \
  --anthropic-key my-proxy-key \
  --port 8082
```

完成后日志位置：`~/.cache/claude-code-proxy/server.log`

如需自定义目录或 Base URL：
```bash
bash scripts/install-claude-proxy.sh \
  --dir "$HOME/.local/claude-code-proxy" \
  --openai-base-url https://api.openai.com/v1 \
  --openai-key sk-xxxx \
  --port 8082
```

### 2) 配置 Claude Code 使用本地代理

根据官方指南设置，但将 Base URL 指向本地代理。

- 方式 A：仅当前终端有效
```bash
bash scripts/configure-claude-code.sh --anthropic-key my-proxy-key --port 8082
```

- 方式 B：持久化到 `~/.bashrc`
```bash
bash scripts/configure-claude-code.sh --anthropic-key my-proxy-key --port 8082 --persist
```

完成后，Claude Code 会通过 `http://127.0.0.1:8082` 中转请求。

### 3) 启动 Claude Code（CLI 示例）
```bash
claude --model claude-3-5-sonnet-20241022
```
模型会被代理映射到 `.env` 中配置的 `BIG_MODEL`/`MIDDLE_MODEL`/`SMALL_MODEL`（默认 `gpt-4o` / `gpt-4o` / `gpt-4o-mini`）。

### 4) 常用维护命令
- 查看日志：
```bash
tail -f ~/.cache/claude-code-proxy/server.log
```
- 重启代理：
```bash
pkill -f 'uv run claude-code-proxy' || pkill -f 'uvicorn.*8082'
source "$HOME/.local/claude-code-proxy/.env"
nohup uv run claude-code-proxy >~/.cache/claude-code-proxy/server.log 2>&1 &
```

### 说明
- 若 `.env` 中未设置 `ANTHROPIC_API_KEY`，客户端可用任意值作为 `ANTHROPIC_API_KEY`。
- 若设置了 `ANTHROPIC_API_KEY`，客户端必须传入完全一致的值才可访问代理。
- 参考配置指南：`https://claudecode.blueshirtmap.com/guide.html`

## 跨平台持久化与稳定性

### 多终端持久化（Linux/macOS）
- 当前会话：
```bash
bash scripts/configure-claude-code.sh --anthropic-key my-proxy-key --port 8082
```
- 持久化（自动更新且去重 `.bashrc`/`.zshrc`/`.profile`/`.zprofile`/`fish`）：
```bash
bash scripts/configure-claude-code.sh --anthropic-key my-proxy-key --port 8082 --persist
```
- 代理绕过：脚本会为 `NO_PROXY/no_proxy` 合并加入 `localhost,127.0.0.1`，避免系统代理影响本地回环访问。

### Windows（PowerShell）
- 当前会话：
```powershell
powershell -ExecutionPolicy Bypass -File scripts/configure-claude-code.ps1 -AnthropicKey my-proxy-key -Port 8082
```
- 持久化到用户环境变量：
```powershell
powershell -ExecutionPolicy Bypass -File scripts/configure-claude-code.ps1 -AnthropicKey my-proxy-key -Port 8082 -Persist
```
说明：持久化后需重启相关应用（如 VS Code 或终端）以加载新环境变量。

### 端口占用与自动选择
安装脚本会检测端口占用，若 `8082` 被占用，将在 `8082-8102` 范围内自动选择可用端口并写入 `.env`。对应地，请在配置脚本中使用相同端口。

### 重复参数与文件冲突
配置脚本会在 rc 文件内去重同名变量，先移除旧条目再写入新的导出，避免重复定义导致的歧义。

### 典型问题排查
- Claude Code 未走本地代理：确认环境变量在启动 Claude Code 的同一会话中生效；GUI 启动的应用需重启或从配置脚本持久化设置。
- 系统代理干扰：确认 `NO_PROXY/no_proxy` 包含 `localhost,127.0.0.1`。
- 端口连接失败：检查日志 `~/.cache/claude-code-proxy/server.log`，或确认端口未被占用。

## 系统体检 Doctor（推荐）
- 打开应用，左下角点击“系统体检”，一键体检。
- 体检范围：代理健康、uv/Python、OpenAI Key、ANTHROPIC_* 环境、NO_PROXY、端口冲突、rc 重复项。
- 点击“应用建议修复”自动执行修复（安装/配置/拉起代理）。
- 点击“导出诊断包”可打包日志与配置（Key 脱敏）便于排障。

## 配置快照 / 回滚
- 在右下角状态面板点击“保存快照”，会保存当前配置副本（保留最近 10 个）。
- 点击“回滚最近”可一键恢复到上一个快照，防止误配置。

### 常见问答（补充）
- 代理不通但体检显示端口占用：说明已有进程占用端口，执行“一键修复”或更换端口后重启。
- VS Code/终端没继承环境变量：执行“持久化”配置并重启应用/终端。