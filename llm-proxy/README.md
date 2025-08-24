## Quickstart: Local LLM Proxy for Claude Code

### 1) Prepare env

Copy `.env.example` to `.env` and set keys:

```bash
cp .env.example .env
$EDITOR .env
```

Required:
- `OPENAI_API_KEY`: your OpenAI key
- `LITELLM_MASTER_KEY`: any secret to protect the gateway

Optional:
- `OPENAI_API_BASE` (default `https://api.openai.com`)

### 2) Start proxy

```bash
docker compose up -d
# or: docker-compose up -d
```

This starts LiteLLM gateway on `http://127.0.0.1:4000`.

### 3) Configure Claude Code to use proxy

Set Anthropic enterprise/proxy envs before starting Claude Code (VSCode or CLI):

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:4000
export ANTHROPIC_API_KEY=${LITELLM_MASTER_KEY:-sk-your-proxy-key}
```

Then in Claude Code select the model id exposed by the proxy, e.g.:
- `claude-3-5-sonnet-20241022`

If using Claude CLI:

```bash
claude --model claude-3-5-sonnet-20241022
```

### 4) Swap backend model

Edit `config.yaml` → change `litellm_params.model` to any supported backend, e.g. `openai/gpt-4o`, `openai/o3`, etc. Restart compose after changes.

### Notes
- Auth: requests must include `x-api-key: $LITELLM_MASTER_KEY` (Claude Code uses `ANTHROPIC_API_KEY`).
- Anthropic compatibility route is enabled so Claude Code can talk to `/v1/messages`.