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