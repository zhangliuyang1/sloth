# Sloth

类 Claude Code 的终端 AI 编程助手，支持多种大模型。面向中文开发者，支持 GLM、DeepSeek、Qwen、Doubao、MiMo 等。

## 功能特性

- **多模型支持** — GLM、DeepSeek、Qwen、Doubao、MiMo、Anthropic Claude、OpenAI
- **自定义 Provider** — 支持添加任意 OpenAI 兼容或 Anthropic 兼容的 API
- **运行时切换模型** — `/model` 命令无需重启即可切换模型
- **Thinking Effort** — 支持 low/medium/high 思考强度配置
- **流式输出** — 终端实时显示 AI 响应
- **内置工具** — 文件读写编辑（Read/Write/Edit）、代码搜索（Grep/Glob）、命令执行（Bash）
- **Token 用量与费用追踪** — 实时显示输入/输出 token 数和费用
- **权限管控** — 危险操作（写文件、执行命令）需用户确认
- **斜杠命令** — `/help`、`/clear`、`/compact`、`/model`、`/config`、`/cost`、`/exit`
- **项目指令** — 支持加载 `.sloth/SLOTH.md` 或 `SLOTH.md` 项目自定义指令
- **对话管理** — 支持清空对话、压缩历史

## 安装

```bash
npm install -g sloth-cc
```

免安装直接使用：

```bash
npx sloth-cc
```

查看版本：

```bash
sloth -v
```

## 使用

### 1. 设置 API Key

```bash
# GLM（默认，推荐国内用户）
export GLM_API_KEY=your_key_here

# 或使用其他模型
export DEEPSEEK_API_KEY=your_key_here
export QWEN_API_KEY=your_key_here
```

也可以在项目目录创建 `.env` 文件：

```bash
cp .env.example .env
# 编辑 .env 填入 API Key
```

### 2. 启动

```bash
sloth                    # 使用默认模型（GLM）
sloth -p deepseek        # 指定 DeepSeek
sloth -p qwen -m qwen-max  # 指定模型和具体版本
sloth --prompt "解释这段代码"  # 非交互模式，单次问答
```

### 3. 开始对话

直接输入问题，按回车发送。Sloth 会读取文件、编辑代码、执行命令等。

```
> 帮我重构 auth 模块
> 找出 src 目录下所有 TODO 注释
> 解释这个函数的作用
```

### 4. 斜杠命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/model` | 查看当前模型 |
| `/model <provider>` | 运行时切换到指定 provider |
| `/model <provider> <model>` | 切换 provider 并指定模型 |
| `/config` | 交互式配置管理 |
| `/cost` | 显示 Token 用量和费用 |
| `/compact` | 压缩对话历史 |
| `/clear` | 清空当前对话 |
| `/exit` | 退出 Sloth |

### 5. 项目自定义指令

在项目根目录创建 `.sloth/SLOTH.md` 或 `SLOTH.md`，Sloth 会自动加载其中的指令作为系统提示的一部分。

```markdown
# SLOTH.md
- 本项目使用 React + TypeScript
- 代码风格遵循 ESLint 配置
- 测试使用 vitest
```

## 模型配置

配置文件位置：`~/.sloth/config.json`

### 方式一：交互式配置（推荐）

在 REPL 中输入 `/config`，按引导操作：

```
/config
  选择操作:
    1. 添加自定义 provider
    2. 编辑 provider 配置
    3. 删除自定义 provider
    4. 切换默认 provider
    5. 设置 thinking effort
    6. 查看当前配置
```

### 方式二：编辑配置文件

直接编辑 `~/.sloth/config.json`：

```json
{
  "provider": "glm",
  "thinkingEffort": "medium",
  "providers": {
    "glm": {
      "apiKey": "your-key",
      "model": "glm-5.1"
    },
    "deepseek": {
      "apiKey": "your-key"
    },
    "my-custom": {
      "type": "openai-compat",
      "baseURL": "https://my-api.example.com/v1",
      "model": "my-model-v1",
      "apiKey": "sk-xxx",
      "thinkingEffort": "high"
    }
  }
}
```

### 自定义 Provider 配置项

每个 provider 支持以下字段：

| 字段 | 说明 | 必填 |
|------|------|------|
| `type` | API 类型：`openai-compat` 或 `anthropic` | 自定义 provider 必填 |
| `baseURL` | API 地址 | `openai-compat` 必填 |
| `model` | 模型名称 | 是 |
| `apiKey` | API Key（也可用环境变量） | 否 |
| `thinkingEffort` | 思考强度：`low`/`medium`/`high` | 否 |
| `maxTokens` | 最大输出 token 数 | 否 |

### 全局配置项

| 字段 | 说明 |
|------|------|
| `provider` | 默认 provider 名称 |
| `thinkingEffort` | 全局默认思考强度（被 provider 级别覆盖） |
| `maxTokens` | 全局默认最大 token 数 |

### 运行时切换模型

无需重启，在对话中直接切换：

```
/model                    # 查看当前模型和可用 provider
/model deepseek           # 切换到 deepseek
/model glm glm-4-plus     # 切换到 glm 并指定模型
```

### Thinking Effort

支持三个级别的思考强度，适用于所有模型：

| 级别 | 说明 |
|------|------|
| `low` | 快速响应，较少推理 |
| `medium` | 平衡模式 |
| `high` | 深度思考，更多推理 |

配置方式：
- 全局：`config.json` 中的 `thinkingEffort` 字段
- 单个 provider：`config.json` 中 provider 的 `thinkingEffort` 字段
- provider 级别优先于全局设置

### 内置 Provider

| 供应商 | 环境变量 | 默认模型 |
|--------|---------|---------|
| GLM（默认） | `GLM_API_KEY` | glm-5.1 |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-v4-pro |
| Qwen | `QWEN_API_KEY` | qwen3-coder-480b-a35b-instruct |
| Doubao | `DOUBAO_API_KEY` | doubao-seed-code |
| MiMo | `MIMO_API_KEY` | mimo-v2.5-pro |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| OpenAI | `OPENAI_API_KEY` | gpt-4o |

## CLI 参数

```
sloth [options]

Options:
  --provider, -p <name>   指定 provider（内置或自定义）
  --model, -m <model>     指定模型名称
  --prompt <text>         非交互模式，执行单次提问后退出
  --version, -v           显示版本号
  --help, -h              显示帮助
```

## 开发

```bash
git clone https://github.com/zhangliuyang1/sloth.git
cd sloth
npm install
npm run dev        # 开发模式运行
npm run build      # 编译到 dist/
npm test           # 运行测试
```

## License

MIT
