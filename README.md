# Sloth

A Claude Code-like CLI programming assistant with multi-model support. Built for Chinese developers, supporting GLM, DeepSeek, Qwen, Doubao, MiMo and more.

## Features

- Multi-model support — GLM, DeepSeek, Qwen, Doubao, MiMo, Anthropic Claude, OpenAI
- Streaming responses in terminal with Markdown rendering
- Built-in tools: file read/write/edit, grep, glob, bash execution
- Conversation management with auto-compaction
- Token usage & cost tracking
- Slash commands (`/help`, `/model`, `/cost`, `/compact`, `/clear`, `/exit`)

## Install

```bash
npm install -g sloth-cli
```

## Quick Start

Set your API key as environment variable:

```bash
# GLM (default)
export GLM_API_KEY=your_key_here

# Or other providers
export DEEPSEEK_API_KEY=your_key_here
export QWEN_API_KEY=your_key_here
```

Then run:

```bash
sloth
```

## Configuration

Config file location: `~/.sloth/config.json`

```json
{
  "provider": "glm",
  "providers": {
    "glm": {
      "apiKey": "your-key",
      "model": "glm-4-plus"
    },
    "deepseek": {
      "apiKey": "your-key"
    }
  }
}
```

### Supported Providers

| Provider | Env Variable | Default Model |
|----------|-------------|---------------|
| GLM (default) | `GLM_API_KEY` | glm-4-plus |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |
| Qwen | `QWEN_API_KEY` | qwen-plus |
| Doubao | `DOUBAO_API_KEY` | doubao-1.5-pro |
| MiMo | `MIMO_API_KEY` | mimo-7b |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| OpenAI | `OPENAI_API_KEY` | gpt-4o |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/model <name>` | Switch model provider |
| `/cost` | Show token usage & cost |
| `/compact` | Compress conversation history |
| `/clear` | Clear current conversation |
| `/exit` | Exit Sloth |

## Development

```bash
git clone https://github.com/zhangliuyang1/sloth.git
cd sloth
npm install
npm run dev        # Run in dev mode
npm run build      # Compile to dist/
npm test           # Run tests
```

## License

MIT
