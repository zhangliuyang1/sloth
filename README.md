# Sloth

类 Claude Code 的终端 AI 编程助手，支持多种大模型。面向中文开发者，支持 GLM、DeepSeek、Qwen、Doubao、MiMo 等。

## 功能特性

- **多模型支持** — GLM、DeepSeek、Qwen、Doubao、MiMo、Anthropic Claude、OpenAI
- **流式输出** — 终端实时显示 AI 响应
- **内置工具** — 文件读写编辑（Read/Write/Edit）、代码搜索（Grep/Glob）、命令执行（Bash）
- **Token 用量与费用追踪** — 实时显示输入/输出 token 数和费用
- **权限管控** — 危险操作（写文件、执行命令）需用户确认
- **斜杠命令** — `/help`、`/clear`、`/compact`、`/model`、`/cost`、`/exit`，支持 Tab 自动补全
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

输入 `/` 后按 Tab 自动补全：

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/model` | 查看当前模型 |
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

## 配置

配置文件位置：`~/.sloth/config.json`

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

### 支持的模型

| 供应商 | 环境变量 | 默认模型 |
|--------|---------|---------|
| GLM（默认） | `GLM_API_KEY` | glm-5.1 |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |
| Qwen | `QWEN_API_KEY` | qwen-plus |
| Doubao | `DOUBAO_API_KEY` | doubao-pro-32k |
| MiMo | `MIMO_API_KEY` | mimo-7b |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| OpenAI | `OPENAI_API_KEY` | gpt-4o |

## CLI 参数

```
sloth [options]

Options:
  --provider, -p <name>   指定供应商 (glm, deepseek, qwen, doubao, mimo, anthropic, openai)
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
