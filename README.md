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
npm install -g sloth-cc
```

Or use without installing:

```bash
npx sloth-cc
```

## Usage

### 1. Set API Key

```bash
# GLM (default, recommended for Chinese users)
export GLM_API_KEY=your_key_here

# Or use other providers
export DEEPSEEK_API_KEY=your_key_here
export QWEN_API_KEY=your_key_here
```

You can also create a `.env` file in your project directory:

```bash
cp .env.example .env
# Edit .env and fill in your API key
```

### 2. Run

```bash
sloth
```

### 3. Start Chatting

Just type your question and press Enter. Sloth will read files, edit code, run commands, and more.

```
> help me refactor the auth module
> find all TODO comments in the src directory
> explain what this function does
```

### 4. Slash Commands

Use `/` prefix for built-in commands:

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/model <name>` | Switch model (e.g. `/model deepseek`) |
| `/cost` | Show token usage & cost |
| `/compact` | Compress conversation history |
| `/clear` | Clear current conversation |
| `/exit` | Exit Sloth |

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
