# sloth: 类 Claude Code 编程助手实现计划

## 背景
基于 Claude Code 泄漏源码的架构分析，从零构建一个功能完整的 CLI 编程助手。
支持多种大模型后端:
- 国际: Claude (Anthropic), GPT (OpenAI)
- 国内: GLM (智谱), DeepSeek (深度求索), Qwen (通义千问), 豆包 (字节跳动), MiMo (小米)
- 本地: Ollama (任意本地模型)
项目路径: `D:/learn/sloth`

## 项目结构

```
sloth/
  src/
    index.ts                    # 入口文件
    cli/
      repl.tsx                  # 交互式 REPL 循环 (Ink 框架)
      ui/
        App.tsx                 # 根组件
        MessageList.tsx         # 对话消息渲染
        InputArea.tsx           # 用户输入区域
        ToolApproval.tsx        # 工具权限确认弹窗
        StatusBar.tsx           # 底部状态栏 (模型/token数/费用)
    core/
      engine.ts                 # 查询引擎 - 核心主循环
      conversation.ts           # 对话历史管理
      context.ts                # 上下文窗口 + 压缩策略
      config.ts                 # 配置加载 (全局 + 项目级)
    providers/
      types.ts                  # 模型提供商接口定义
      anthropic.ts              # Claude API 提供商 (独立协议)
      openai-compat.ts          # OpenAI 兼容提供商 (统一接入多家)
      ollama.ts                 # Ollama 本地模型提供商
      presets/                  # 各模型预配置
        deepseek.ts             # DeepSeek V4/V3.2 (api.deepseek.com)
        qwen.ts                 # 通义千问 Qwen3 (dashscope.aliyuncs.com)
        glm.ts                  # 智谱 GLM-5.1 (open.bigmodel.cn)
        doubao.ts               # 字节豆包 Doubao Seed (ark.cn-beijing.volces.com)
        mimo.ts                 # 小米 MiMo V2 (api.mimo.xiaomi.com)
      index.ts                  # 提供商工厂/注册表
    tools/
      types.ts                  # 工具接口定义
      registry.ts               # 工具注册表
      files/read.ts             # 文件读取工具
      files/write.ts            # 文件写入工具
      files/edit.ts             # 文件编辑工具 (字符串替换)
      search/grep.ts            # 内容搜索工具
      search/glob.ts            # 文件匹配搜索工具
      bash.ts                   # Shell 命令执行工具
      web.ts                    # 网页搜索/抓取工具
      notebook.ts               # Jupyter Notebook 编辑工具
      index.ts                  # 注册所有工具
    permissions/
      manager.ts                # 权限检查管理器
      store.ts                  # 持久化权限存储
    memory/
      manager.ts                # 记忆读写管理
      compactor.ts              # 对话上下文压缩
    agents/
      coordinator.ts            # 任务分解协调器
      sub-agent.ts              # 子 Agent 执行器
    mcp/
      client.ts                 # MCP 协议客户端 (stdio 传输)
      types.ts                  # MCP 协议类型定义
    git/
      operations.ts             # Git 安全操作封装
```

## 核心接口设计

```typescript
// 模型提供商接口
interface LLMProvider {
  name: string;
  chat(messages: Message[], tools: ToolDef[]): AsyncIterable<StreamEvent>;
  countTokens(text: string): number;
}

// 流式事件
type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: any }
  | { type: 'tool_result'; output: string; error?: boolean }
  | { type: 'done' }

// 工具接口
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;        // 参数的 JSON Schema
  permissionLevel: 'allow' | 'ask' | 'confirm' | 'deny';
  execute(params: any, ctx: ToolContext): Promise<ToolResult>;
}
```

## 核心查询循环

```
1. 接收用户输入，添加到对话历史
2. 构建系统提示词 (工具描述 + 记忆 + 上下文)
3. 调用 LLM，流式接收响应
4. 遇到 tool_call 时:
   a. 检查权限等级
   b. 需要确认则弹出提示让用户审批
   c. 执行工具，获取结果
   d. 将结果注入对话，继续调用 LLM
5. 重复步骤 4 直到 LLM 不再发起工具调用
6. 检查 token 用量，必要时压缩历史对话
7. 等待下一轮用户输入
```

## 实现阶段

### 第一阶段: 核心可运行循环
创建项目基础，实现能跑通的主循环:
- `package.json` + `tsconfig.json` — 项目配置
- `providers/types.ts` + `providers/anthropic.ts` + `providers/openai-compat.ts` + `providers/presets/*` — 多模型支持
- `tools/types.ts` + `tools/registry.ts` — 工具注册框架
- 6 个核心工具: 文件读/写/编辑、Bash 执行、Grep 搜索、Glob 匹配
- `permissions/manager.ts` + `permissions/store.ts` — 4 级权限系统
- `core/conversation.ts` + `core/engine.ts` — 对话管理 + 查询引擎
- `core/config.ts` — 配置加载
- `cli/repl.tsx` + `cli/ui/*` — Ink 终端界面

### 第二阶段: 记忆与上下文管理
- `memory/manager.ts` — 基于 .sloth/memory/ 的文件记忆系统
- `memory/compactor.ts` — 对话压缩 (保留关键决策，丢弃冗余细节)
- `core/context.ts` — Token 计数，上下文窗口管理
- 项目指令文件加载 (类似 CLAUDE.md)

### 第三阶段: 多 Agent 与 MCP
- `providers/ollama.ts` — Ollama 本地模型支持
- `agents/coordinator.ts` — 任务分解，将复杂任务拆给子 Agent
- `agents/sub-agent.ts` — 子 Agent 并行执行
- `mcp/client.ts` — MCP 协议客户端，连接外部工具服务器

### 第四阶段: Git 集成与完善
- `git/operations.ts` — Git 安全操作 (提交/推送前的检查)
- 费用追踪 + 状态栏显示
- Web 搜索工具、Notebook 编辑工具
- 打包发布 (npm link 全局安装)

## 国内模型接入方式

所有国内模型均走 OpenAI 兼容协议，只需配置不同的 `baseURL` 和 `apiKey`:

| 模型 | baseURL | 模型名示例 | 备注 |
|------|---------|-----------|------|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-v4-pro`, `deepseek-v4-flash`, `deepseek-v3.2` | V4: 1.6T参数/49B激活, 1M上下文; V3.2 Speciale: Agent推理模型 |
| 通义千问 Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen3-235b-a22b`, `qwen3-coder-480b-a35b-instruct`, `qwen-max` | Qwen3.5/Qwen3.6 Plus 为最新旗舰 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-5.1`, `glm-4.6`, `glm-4-air-250414` | GLM-5.1 最新旗舰; 支持 Coding 专项优化 |
| 字节豆包 Doubao | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seed-1-6-251228`, `doubao-seed-code`, `doubao-seed-2.0-code` | 需在火山方舟创建接入点; 编程模型支持视觉理解 |
| 小米 MiMo | `https://api.mimo.xiaomi.com/v1` (待确认) | `mimo-v2-pro`, `mimo-v2-flash`, `mimo-v2.5-pro` | V2-Pro: 1T参数/1M上下文; V2-Flash 开源; 也可通过 Ollama 本地运行 |

配置文件格式 (`~/.sloth/config.json`):
```json
{
  "provider": "deepseek",
  "providers": {
    "deepseek": {
      "apiKey": "sk-xxx",
      "model": "deepseek-v4-pro"
    },
    "qwen": {
      "apiKey": "sk-xxx",
      "model": "qwen3-coder-480b-a35b-instruct"
    },
    "glm": {
      "apiKey": "xxx.xxx",
      "model": "glm-5.1"
    },
    "doubao": {
      "apiKey": "xxx",
      "model": "doubao-seed-code",
      "endpoint": "ep-xxx"
    },
    "mimo": {
      "apiKey": "xxx",
      "model": "mimo-v2.5-pro"
    }
  }
}
```

## 依赖列表
| 包名 | 用途 |
|------|------|
| ink + react | 终端 UI 框架 (与 Claude Code 相同) |
| @anthropic-ai/sdk | Claude API 调用 |
| openai | OpenAI 兼容 API 调用 |
| tiktoken | Token 计数 |
| chalk | 终端彩色输出 |
| glob | 文件模式匹配 |
| marked + marked-terminal | Markdown 终端渲染 |
| zod | 参数校验 |

## 验证方法
1. `npm run dev` 启动 REPL
2. 输入编程请求 → LLM 发起工具调用 → 工具执行并弹权限确认 → 返回结果
3. 多轮对话保持上下文连贯
4. 分别测试 `--provider deepseek` / `--provider qwen` / `--provider glm` / `--provider anthropic` / `--provider ollama`
