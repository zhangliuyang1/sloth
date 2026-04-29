# sloth 详细设计文档

> 本文档是 `giggly-napping-sloth.md` 的补充，覆盖系统提示词、工具规格、协议适配、辅助系统等详细设计。

---

## 一、系统提示词设计

系统提示词是整个产品最关键的部分。它决定 LLM 的行为质量，占产品能力的 70%。

### 1.1 提示词架构

系统提示词由以下模块按顺序拼接：

```
[身份与角色定义]
[核心行为规则]
[工具使用策略]
[安全与风险控制]
[输出格式规范]
[上下文注入块] ← 动态生成
  ├── 项目指令 (.sloth/SLOTH.md)
  ├── 记忆文件内容
  ├── 当前工作目录信息
  └── 已加载 MCP 服务器描述
```

### 1.2 身份与角色定义

```
你是 Sloth，一个运行在终端中的 AI 编程助手。你帮助用户完成软件工程任务。

核心能力：
- 读取、编写、编辑代码文件
- 执行 shell 命令
- 搜索代码库
- 管理对话上下文与记忆
- 通过 MCP 协议调用外部工具

工作方式：
- 你通过工具调用来完成任务，不是仅仅给出建议
- 先理解需求，再制定方案，最后动手实现
- 每次只做一件事，逐步推进
- 遇到不确定的地方主动询问用户
```

### 1.3 核心行为规则

```
## 通用规则

1. 先读后改 — 修改文件前必须先用 Read 工具读取当前内容
2. 优先使用专用工具 — Read/Edit/Write 优于 Bash 中的 cat/sed/echo
3. 小步快跑 — 每次工具调用只做一件事
4. 错误先诊断 — 遇到错误时先分析根因，不要盲目重试
5. 保持简洁 — 回复简短，不说废话，不重复用户已知的信息
6. 主动使用工具 — 不要只是建议用户做某事，自己动手完成
7. 确认风险操作 — 删除文件、推送代码等不可逆操作前先确认

## 代码编辑规则

1. 优先使用 Edit 工具修改现有文件，而非 Write 全量覆盖
2. Edit 的 old_string 必须是文件中的精确匹配（含缩进）
3. 如果 old_string 在文件中不唯一，扩大上下文使其唯一
4. 不要在 old_string 中包含行号前缀
5. 修改前先 Read 确认当前文件内容
6. 创建新文件用 Write，修改现有文件用 Edit

## Bash 规则

1. 优先使用专用工具（Grep/Glob/Read），Bash 是最后手段
2. 命令必须指定超时时间（默认 120 秒）
3. 不执行破坏性命令（rm -rf、git push --force）除非用户明确要求
4. 长时间运行的命令使用后台模式
5. 不在命令中使用交互式输入（git rebase -i 等）

## 搜索规则

1. 已知文件路径时用 Read 直接读取，不要搜索
2. 按文件名查找用 Glob
3. 按内容查找用 Grep
4. 不确定位置时，先用 Glob 定位文件，再用 Grep 搜索内容
5. 搜索结果过多时加限定条件（glob 过滤、目录限定）
```

### 1.4 工具使用策略

```
## 工具选择优先级

读取文件内容 → Read（不要用 Bash 的 cat）
修改已有文件 → Edit（不要用 Bash 的 sed）
创建新文件   → Write
搜索文件名   → Glob（不要用 Bash 的 find）
搜索文件内容 → Grep（不要用 Bash 的 grep）
执行命令     → Bash（只有上述工具无法完成时才用）
```

### 1.5 安全与风险控制

```
## 安全规则

1. 不执行可能导致数据丢失的命令，除非用户明确确认
2. 不在代码中引入已知安全漏洞（SQL 注入、XSS、命令注入等）
3. 不提交包含密钥/令牌的文件（.env、credentials.json 等）
4. 修改共享资源（数据库、远程服务）前先确认
5. 不执行来自外部源的不可信命令
```

### 1.6 输出格式规范

```
## 输出规则

1. 回复使用中文（与用户语言一致）
2. 代码引用使用 `file_path:line_number` 格式
3. 引用代码时不重复整个文件，只引用关键片段
4. 工具调用前用一句话说明意图
5. 关键节点给出简短更新（发现关键信息、改变方向、遇到阻碍）
6. 结尾用一两句话总结：改了什么、下一步做什么
7. 不使用 emoji（除非用户要求）
```

### 1.7 动态上下文注入

```typescript
interface SystemPromptContext {
  cwd: string;                    // 当前工作目录
  platform: string;               // 操作系统
  shell: string;                  // 默认 shell
  projectInstructions: string;    // .sloth/SLOTH.md 内容
  memoryFiles: string[];          // 记忆文件内容
  mcpServerDescriptions: string[];// 已连接 MCP 服务器的工具描述
  gitBranch?: string;             // 当前 git 分支
  gitRepo?: boolean;              // 是否在 git 仓库中
}

function buildSystemPrompt(ctx: SystemPromptContext): string {
  return [
    STATIC_PROMPT,                    // 1.1-1.6 的静态部分
    '\n## 当前环境',
    `工作目录: ${ctx.cwd}`,
    `平台: ${ctx.platform}`,
    `Shell: ${ctx.shell}`,
    ctx.gitRepo ? `Git 分支: ${ctx.gitBranch}` : '',
    ctx.projectInstructions ? `\n## 项目指令\n${ctx.projectInstructions}` : '',
    ctx.memoryFiles.length ? `\n## 记忆\n${ctx.memoryFiles.join('\n')}` : '',
    ctx.mcpServerDescriptions.length
      ? `\n## 外部工具 (MCP)\n${ctx.mcpServerDescriptions.join('\n')}`
      : '',
  ].filter(Boolean).join('\n');
}
```

---

## 二、工具详细规格

### 2.1 工具描述设计原则

工具的 `description` 字段是 LLM 决定何时调用的唯一依据。设计规则：
1. 第一句话说明工具用途
2. "何时使用"段落说明选择条件
3. "使用注意"段落列出常见错误
4. 参数说明嵌入 JSON Schema 的 description 字段

### 2.2 Read 工具

```typescript
const readTool: ToolDefinition = {
  name: 'Read',
  description: `读取文件内容。返回带行号的文件内容。

何时使用：
- 需要查看文件内容时
- 修改文件前了解当前内容时
- 用户要求查看某个文件时

使用注意：
- file_path 必须是绝对路径
- 大文件用 offset + limit 分段读取
- 不要用 Bash 的 cat 命令替代此工具`,
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '要读取的文件的绝对路径',
      },
      offset: {
        type: 'number',
        description: '起始行号（0-based），用于读取大文件的一部分',
      },
      limit: {
        type: 'number',
        description: '最多读取的行数',
      },
    },
    required: ['file_path'],
  },
  permission: 'allow',  // 读操作默认允许
};
```

### 2.3 Write 工具

```typescript
const writeTool: ToolDefinition = {
  name: 'Write',
  description: `创建新文件或完全覆盖现有文件。写入前会用 Read 工具检查文件是否已存在。

何时使用：
- 创建新文件时
- 需要完全重写文件内容时（文件内容变化超过 50%）

使用注意：
- file_path 必须是绝对路径
- 对于已存在文件的局部修改，优先使用 Edit 工具
- 写入前确保目标目录存在`,
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '要写入的文件的绝对路径',
      },
      content: {
        type: 'string',
        description: '要写入的完整文件内容',
      },
    },
    required: ['file_path', 'content'],
  },
  permission: 'ask',  // 写操作需要确认
};
```

### 2.4 Edit 工具

```typescript
const editTool: ToolDefinition = {
  name: 'Edit',
  description: `对现有文件进行精确的字符串替换编辑。

工作原理：
- 在文件中查找 old_string 的精确匹配
- 将匹配到的内容替换为 new_string
- old_string 必须在文件中是唯一的，否则编辑会失败

何时使用：
- 修改现有文件的局部内容时（首选方式）
- 重命名变量、修改函数、修复 bug 时

使用注意：
- old_string 必须与文件中的内容完全匹配（包括缩进和空格）
- 不要在 old_string 中包含行号
- 如果 old_string 不唯一，扩大上下文使其唯一
- 使用 replace_all: true 可以替换所有匹配项（用于重命名等场景）
- 修改前必须先用 Read 读取文件确认当前内容`,
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '要编辑的文件的绝对路径',
      },
      old_string: {
        type: 'string',
        description: '要被替换的原始文本（必须与文件内容精确匹配）',
      },
      new_string: {
        type: 'string',
        description: '替换后的新文本',
      },
      replace_all: {
        type: 'boolean',
        description: '是否替换所有匹配项（默认 false）。用于重命名变量等场景。',
        default: false,
      },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  permission: 'ask',
};
```

### 2.5 Grep 工具

```typescript
const grepTool: ToolDefinition = {
  name: 'Grep',
  description: `在文件内容中搜索匹配的文本。支持正则表达式。

何时使用：
- 查找某个函数/变量/类的定义位置
- 查找所有引用某段代码的位置
- 搜索代码模式（如 TODO、FIXME、console.log）

使用注意：
- pattern 参数支持正则表达式
- 使用 glob 参数限定文件类型（如 "*.ts", "*.{js,jsx}"）
- 结果过多时使用 head_limit 限制数量
- 已知文件路径时直接用 Read，不要搜索`,
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: '要搜索的正则表达式模式',
      },
      path: {
        type: 'string',
        description: '搜索的目录路径（默认当前工作目录）',
      },
      glob: {
        type: 'string',
        description: '文件类型过滤（如 "*.ts", "*.{js,jsx}"）',
      },
      output_mode: {
        type: 'string',
        enum: ['files_with_matches', 'content', 'count'],
        description: '输出模式：files_with_matches 只返回文件名；content 返回匹配行；count 返回匹配数',
      },
      head_limit: {
        type: 'number',
        description: '限制返回结果数量',
      },
      context: {
        type: 'number',
        description: '显示匹配行前后各多少行（仅 content 模式）',
      },
    },
    required: ['pattern'],
  },
  permission: 'allow',
};
```

### 2.6 Glob 工具

```typescript
const globTool: ToolDefinition = {
  name: 'Glob',
  description: `按文件名模式匹配查找文件。

何时使用：
- 查找某个文件的位置
- 列出某类文件（如所有测试文件、所有组件文件）
- 不确定文件名但知道部分模式时

使用注意：
- pattern 支持 glob 语法（如 "**/*.ts", "src/**/*.tsx"）
- 返回按修改时间排序的文件列表
- 不要用 Bash 的 find 命令替代此工具`,
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'glob 模式（如 "**/*.ts", "src/**/*.tsx"）',
      },
      path: {
        type: 'string',
        description: '搜索的目录路径（默认当前工作目录）',
      },
    },
    required: ['pattern'],
  },
  permission: 'allow',
};
```

### 2.7 Bash 工具

```typescript
const bashTool: ToolDefinition = {
  name: 'Bash',
  description: `执行 shell 命令并返回输出。

何时使用：
- 运行构建、测试、安装依赖等命令
- 执行专用工具无法完成的操作
- 使用只有命令行才能提供的功能

使用注意：
- command 中不要使用交互式输入
- 设置合理的 timeout（默认 120000ms）
- 不执行破坏性命令（rm -rf、git push --force 等）除非用户明确要求
- 优先使用专用工具（Read/Edit/Write/Grep/Glob）
- 工作目录在命令之间保持，但 shell 状态（环境变量等）不保持
- 多个独立命令可以并行调用，有依赖关系的命令必须顺序调用`,
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的 shell 命令',
      },
      timeout: {
        type: 'number',
        description: '超时时间（毫秒），默认 120000（2 分钟），最大 600000（10 分钟）',
      },
      description: {
        type: 'string',
        description: '命令用途的简短描述（用于权限确认提示）',
      },
      run_in_background: {
        type: 'boolean',
        description: '是否在后台运行（不需要立即获取结果时使用）',
        default: false,
      },
    },
    required: ['command'],
  },
  permission: 'ask',  // 默认需要确认，用户可配置白名单
};
```

### 2.8 工具注册表

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;  // JSON Schema
  permission: PermissionLevel;
}

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private executors: Map<string, ToolExecutor> = new Map();

  register(tool: ToolDefinition, executor: ToolExecutor): void;
  get(name: string): ToolDefinition | undefined;
  getAll(): ToolDefinition[];
  getToolDefsForLLM(): ToolDef[];  // 转换为各 Provider 的工具格式
}
```

---

## 三、流式协议与 Provider 适配

### 3.1 核心抽象层

```typescript
// ===== 统一事件类型 =====
type StreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; args_delta: string }
  | { type: 'tool_call_end'; id: string; name: string; args: string }
  | { type: 'thinking_delta'; text: string }
  | { type: 'usage'; input_tokens: number; output_tokens: number }
  | { type: 'done'; stop_reason: string };

// ===== Provider 接口 =====
interface LLMProvider {
  name: string;
  chat(params: ChatParams): AsyncIterable<StreamEvent>;
  countTokens(text: string): Promise<number>;
  getToolFormat(): 'anthropic' | 'openai';  // 工具定义格式
}

interface ChatParams {
  messages: Message[];           // 统一消息格式
  system: string;                // 系统提示词
  tools: ToolDef[];              // 工具定义
  maxTokens: number;
  temperature?: number;
  stream: true;
}
```

### 3.2 统一消息格式

```typescript
// 引擎内部只使用这一种消息格式
interface Message {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
  | { type: 'tool_result'; tool_use_id: string; output: string; is_error?: boolean };
```

### 3.3 Anthropic 适配器

Anthropic 的原始协议：
- 消息 content 是 `ContentBlock[]` 数组
- tool_use 是独立的 content block 类型
- 流式: `content_block_start` / `content_block_delta` / `content_block_stop`
- tool_use 的 input 通过 `input_json_delta` 增量传输

```typescript
class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;

  async *chat(params: ChatParams): AsyncIterable<StreamEvent> {
    // 1. 转换消息格式 — Anthropic 原生就使用 content blocks
    const anthropicMsgs = params.messages.map(this.convertMessage);

    // 2. 转换工具定义
    const tools = params.tools.map(this.convertToolDef);

    // 3. 发起流式请求
    const stream = this.client.messages.stream({
      model: this.model,
      system: params.system,
      messages: anthropicMsgs,
      tools,
      max_tokens: params.maxTokens,
    });

    // 4. 解析流式事件
    let currentToolCall: { id: string; name: string; args: string } | null = null;

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start':
          if (event.content_block.type === 'text') {
            yield { type: 'text_delta', text: '' };
          } else if (event.content_block.type === 'tool_use') {
            currentToolCall = {
              id: event.content_block.id,
              name: event.content_block.name,
              args: '',
            };
            yield {
              type: 'tool_call_start',
              id: currentToolCall.id,
              name: currentToolCall.name,
            };
          }
          break;

        case 'content_block_delta':
          if (event.delta.type === 'text_delta') {
            yield { type: 'text_delta', text: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            currentToolCall!.args += event.delta.partial_json;
            yield {
              type: 'tool_call_delta',
              id: currentToolCall!.id,
              args_delta: event.delta.partial_json,
            };
          }
          break;

        case 'content_block_stop':
          if (currentToolCall) {
            yield {
              type: 'tool_call_end',
              id: currentToolCall.id,
              name: currentToolCall.name,
              args: currentToolCall.args,
            };
            currentToolCall = null;
          }
          break;

        case 'message_delta':
          if (event.usage) {
            yield {
              type: 'usage',
              input_tokens: event.usage.input_tokens ?? 0,
              output_tokens: event.usage.output_tokens ?? 0,
            };
          }
          break;

        case 'message_stop':
          yield { type: 'done', stop_reason: 'end_turn' };
          break;
      }
    }
  }

  private convertMessage(msg: Message): AnthropicMessage {
    return {
      role: msg.role,
      content: msg.content.map(block => {
        if (block.type === 'text') return { type: 'text', text: block.text };
        if (block.type === 'tool_use') {
          return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
        }
        if (block.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: block.tool_use_id,
            content: block.output,
            is_error: block.is_error,
          };
        }
        return block;
      }),
    };
  }

  private convertToolDef(tool: ToolDef): AnthropicTool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as any,  // Anthropic 用 input_schema
    };
  }
}
```

### 3.4 OpenAI 兼容适配器

OpenAI 的原始协议：
- 消息 content 是 `string`（非 tool_call 时）
- tool_calls 嵌套在 assistant message 中
- 流式: `choices[0].delta` 包含 `content` 或 `tool_calls`
- tool_calls 的 function.arguments 是 JSON 字符串增量

```typescript
class OpenAICompatProvider implements LLMProvider {
  name: string;
  private client: OpenAI;
  private baseURL: string;
  private model: string;

  async *chat(params: ChatParams): AsyncIterable<StreamEvent> {
    // 1. 转换消息格式 — OpenAI 使用不同的结构
    const openaiMsgs = params.messages.flatMap(this.convertMessage);
    openaiMsgs.unshift({ role: 'system', content: params.system });

    // 2. 转换工具定义
    const tools = params.tools.map(this.convertToolDef);

    // 3. 发起流式请求
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMsgs,
      tools: tools.length ? tools : undefined,
      max_tokens: params.maxTokens,
      stream: true,
    });

    // 4. 解析流式事件
    // OpenAI 的 tool_calls 是按 index 分组的增量
    const toolCallAccumulators: Map<number, { id: string; name: string; args: string }> = new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // 文本内容
      if (delta.content) {
        yield { type: 'text_delta', text: delta.content };
      }

      // 工具调用
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;

          if (!toolCallAccumulators.has(idx)) {
            // 新的工具调用开始
            toolCallAccumulators.set(idx, {
              id: tc.id || '',
              name: tc.function?.name || '',
              args: '',
            });
            yield {
              type: 'tool_call_start',
              id: tc.id || '',
              name: tc.function?.name || '',
            };
          }

          const acc = toolCallAccumulators.get(idx)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) {
            acc.args += tc.function.arguments;
            yield {
              type: 'tool_call_delta',
              id: acc.id,
              args_delta: tc.function.arguments,
            };
          }
        }
      }

      // 完成信号
      const finishReason = chunk.choices[0]?.finish_reason;
      if (finishReason === 'tool_calls') {
        // 刷新所有未完成的 tool calls
        for (const [, acc] of toolCallAccumulators) {
          yield {
            type: 'tool_call_end',
            id: acc.id,
            name: acc.name,
            args: acc.args,
          };
        }
        toolCallAccumulators.clear();
      }

      if (finishReason === 'stop') {
        yield { type: 'done', stop_reason: 'end_turn' };
      }

      // 用量
      if (chunk.usage) {
        yield {
          type: 'usage',
          input_tokens: chunk.usage.prompt_tokens,
          output_tokens: chunk.usage.completion_tokens,
        };
      }
    }
  }

  private convertMessage(msg: Message): OpenAIMessage[] {
    const results: OpenAIMessage[] = [];

    if (msg.role === 'assistant') {
      // assistant 消息需要拆分 text 和 tool_calls
      const textBlocks = msg.content.filter(b => b.type === 'text');
      const toolBlocks = msg.content.filter(b => b.type === 'tool_use');

      if (textBlocks.length || toolBlocks.length === 0) {
        results.push({
          role: 'assistant',
          content: textBlocks.map(b => (b as any).text).join('') || null,
        });
      }
      if (toolBlocks.length) {
        results.push({
          role: 'assistant',
          content: null,
          tool_calls: toolBlocks.map(b => ({
            id: (b as any).id,
            type: 'function',
            function: {
              name: (b as any).name,
              arguments: JSON.stringify((b as any).input),
            },
          })),
        });
      }
    } else {
      // user 消息：tool_result 需要映射为 tool role
      const textBlocks = msg.content.filter(b => b.type === 'text');
      const resultBlocks = msg.content.filter(b => b.type === 'tool_result');

      if (textBlocks.length) {
        results.push({
          role: 'user',
          content: textBlocks.map(b => (b as any).text).join(''),
        });
      }
      for (const rb of resultBlocks) {
        results.push({
          role: 'tool',
          tool_call_id: (rb as any).tool_use_id,
          content: (rb as any).output,
        });
      }
    }

    return results;
  }

  private convertToolDef(tool: ToolDef): OpenAITool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,  // OpenAI 用 parameters
      },
    };
  }
}
```

### 3.5 Ollama 适配器

```typescript
class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseURL: string;
  private model: string;

  // Ollama 使用 /api/chat 端点，兼容 OpenAI 格式
  // 直接复用 OpenAICompatProvider 的逻辑
  // 唯一区别：baseURL 指向本地 Ollama 服务
}
```

### 3.6 Provider 工厂

```typescript
interface ProviderConfig {
  type: 'anthropic' | 'openai-compat' | 'ollama';
  apiKey?: string;
  baseURL?: string;
  model: string;
}

function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case 'anthropic':
      return new AnthropicProvider(config.apiKey!, config.model);
    case 'openai-compat':
      return new OpenAICompatProvider(config.apiKey!, config.baseURL!, config.model);
    case 'ollama':
      return new OllamaProvider(config.baseURL || 'http://localhost:11434', config.model);
  }
}

// Presets 提供预配置
const PRESETS: Record<string, ProviderConfig> = {
  deepseek: {
    type: 'openai-compat',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-pro',
  },
  qwen: {
    type: 'openai-compat',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3-coder-480b-a35b-instruct',
  },
  glm: {
    type: 'openai-compat',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.1',
  },
  doubao: {
    type: 'openai-compat',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-code',
  },
  mimo: {
    type: 'openai-compat',
    baseURL: 'https://api.mimo.xiaomi.com/v1',
    model: 'mimo-v2.5-pro',
  },
};
```

---

## 四、Hook 系统

### 4.1 设计目标

Hook 允许用户在特定事件发生时执行自定义 shell 命令，用于：
- 自动格式化代码（保存后）
- 安全审计（命令执行前）
- 通知（任务完成后）
- 自定义校验（提交前）

### 4.2 Hook 类型

```typescript
type HookEvent =
  | 'pre_tool_use'        // 工具执行前
  | 'post_tool_use'       // 工具执行后
  | 'user_prompt_submit'  // 用户提交输入前
  | 'notification'        // 系统通知时
  | 'stop'                // Agent 停止时
  ;

interface Hook {
  event: HookEvent;
  command: string;         // 要执行的 shell 命令
  timeout?: number;        // 超时（毫秒），默认 30000
}

// Hook 执行结果
interface HookResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}
```

### 4.3 Hook 配置

```json
// ~/.sloth/settings.json
{
  "hooks": {
    "pre_tool_use": [
      {
        "command": "echo 'Executing {{tool_name}} with {{tool_params}}'",
        "timeout": 5000
      }
    ],
    "post_tool_use": [
      {
        "command": "npx prettier --write {{file_path}}",
        "timeout": 10000
      }
    ],
    "user_prompt_submit": [
      {
        "command": "echo '{{prompt}}' >> ~/.sloth/prompt_log.txt"
      }
    ]
  }
}
```

### 4.4 Hook 执行器

```typescript
class HookRunner {
  private hooks: Map<HookEvent, Hook[]> = new Map();

  loadFromConfig(config: Record<string, Hook[]>): void {
    for (const [event, hookList] of Object.entries(config)) {
      this.hooks.set(event as HookEvent, hookList);
    }
  }

  async run(event: HookEvent, context: Record<string, string>): Promise<HookResult[]> {
    const hooks = this.hooks.get(event) || [];
    const results: HookResult[] = [];

    for (const hook of hooks) {
      // 替换模板变量
      const command = this.interpolate(hook.command, context);

      try {
        const result = await execCommand(command, {
          timeout: hook.timeout || 30000,
        });
        results.push({ success: true, stdout: result.stdout, stderr: result.stderr });

        // pre_tool_use hook 可以阻止工具执行
        if (event === 'pre_tool_use' && result.exitCode !== 0) {
          return results;  // 阻止后续 hook 和工具执行
        }
      } catch (err: any) {
        results.push({ success: false, stderr: err.message, exitCode: err.exitCode });
        if (event === 'pre_tool_use') return results;
      }
    }

    return results;
  }

  private interpolate(template: string, ctx: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] || '');
  }
}
```

---

## 五、Slash 命令系统

### 5.1 内置命令

```typescript
interface SlashCommand {
  name: string;
  description: string;
  execute(args: string, ctx: CommandContext): Promise<void>;
}

const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    name: 'help',
    description: '显示帮助信息',
    execute: async (args, ctx) => { /* 显示可用命令列表 */ },
  },
  {
    name: 'clear',
    description: '清空当前对话',
    execute: async (args, ctx) => { ctx.conversation.clear(); },
  },
  {
    name: 'compact',
    description: '手动压缩对话历史',
    execute: async (args, ctx) => { await ctx.compactor.compact(ctx.conversation); },
  },
  {
    name: 'model',
    description: '切换模型 (如 /model deepseek)',
    execute: async (args, ctx) => { ctx.engine.switchProvider(args.trim()); },
  },
  {
    name: 'memory',
    description: '管理记忆 (list/read/delete)',
    execute: async (args, ctx) => { /* 子命令分发 */ },
  },
  {
    name: 'permissions',
    description: '查看/管理权限设置',
    execute: async (args, ctx) => { /* 显示当前权限配置 */ },
  },
  {
    name: 'cost',
    description: '显示当前会话费用统计',
    execute: async (args, ctx) => { ctx.ui.showCostSummary(); },
  },
  {
    name: 'history',
    description: '显示对话历史摘要',
    execute: async (args, ctx) => { ctx.ui.showHistory(); },
  },
  {
    name: 'mcp',
    description: '管理 MCP 服务器 (list/connect/disconnect)',
    execute: async (args, ctx) => { /* MCP 子命令分发 */ },
  },
  {
    name: 'exit',
    description: '退出 Sloth',
    execute: async (args, ctx) => { ctx.engine.shutdown(); },
  },
];
```

### 5.2 命令解析

```typescript
function parseInput(input: string):
  | { type: 'command'; name: string; args: string }
  | { type: 'message'; content: string }
{
  const trimmed = input.trim();
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    return {
      type: 'command',
      name: parts[0].toLowerCase(),
      args: parts.slice(1).join(' '),
    };
  }
  return { type: 'message', content: trimmed };
}
```

---

## 六、会话管理

### 6.1 会话持久化

```typescript
interface Session {
  id: string;                     // 唯一 ID
  createdAt: string;              // ISO 时间戳
  updatedAt: string;
  messages: Message[];            // 完整对话历史
  provider: string;               // 使用的模型提供商
  model: string;                  // 模型名
  totalTokens: number;            // 累计 token
  totalCost: number;              // 累计费用
  cwd: string;                    // 工作目录
}

class SessionManager {
  private sessionDir: string;     // ~/.sloth/sessions/

  // 保存当前会话
  async save(session: Session): Promise<void> {
    const filePath = path.join(this.sessionDir, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  // 加载会话
  async load(id: string): Promise<Session | null> {
    const filePath = path.join(this.sessionDir, `${id}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // 列出最近会话
  async listRecent(limit: number = 10): Promise<SessionMeta[]> {
    const files = await fs.readdir(this.sessionDir);
    // 按 updatedAt 排序，返回最近的
  }

  // 自动保存：每轮对话结束时触发
  // 自动清理：保留最近 100 个会话，更早的归档
}
```

### 6.2 会话恢复流程

```
1. 用户启动 sloth --resume [session_id]
2. 如果未指定 session_id，显示最近会话列表让用户选择
3. 加载会话 JSON，恢复 messages、provider、model
4. 检查 cwd 是否仍然有效，提示用户
5. 继续对话循环
```

---

## 七、项目指令文件

### 7.1 分层加载

```
查找顺序（后加载的覆盖先加载的）:
1. ~/.sloth/SLOTH.md           — 全局指令（用户偏好、通用规则）
2. .sloth/SLOTH.md             — 项目级指令（架构约定、代码风格）
3. .sloth/SLOTH.local.md       — 本地指令（个人配置，不提交 git）
```

### 7.2 指令文件格式

```markdown
# 项目指令示例 (.sloth/SLOTH.md)

## 项目概述
这是一个 TypeScript CLI 工具，使用 Ink 框架构建终端 UI。

## 代码风格
- 使用 TypeScript strict 模式
- 函数优先使用箭头函数
- 异步操作必须处理错误

## 测试要求
- 新功能必须包含单元测试
- 使用 vitest 框架
- 测试文件放在同目录 __tests__/ 下

## 禁止事项
- 不要使用 any 类型
- 不要引入新的重量级依赖
```

### 7.3 加载逻辑

```typescript
class ProjectInstructionLoader {
  // 按优先级加载，合并所有指令
  async load(cwd: string): Promise<string> {
    const instructions: string[] = [];

    // 1. 全局指令
    const globalPath = path.join(os.homedir(), '.sloth', 'SLOTH.md');
    const global = await this.tryRead(globalPath);
    if (global) instructions.push(global);

    // 2. 项目级指令
    const projectPath = path.join(cwd, '.sloth', 'SLOTH.md');
    const project = await this.tryRead(projectPath);
    if (project) instructions.push(project);

    // 3. 本地指令
    const localPath = path.join(cwd, '.sloth', 'SLOTH.local.md');
    const local = await this.tryRead(localPath);
    if (local) instructions.push(local);

    return instructions.join('\n\n');
  }

  private async tryRead(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }
}
```

---

## 八、Auto-Compact 设计

### 8.1 触发条件

```typescript
interface CompactConfig {
  // 触发阈值：当 token 使用量达到模型上下文窗口的此比例时触发
  threshold: number;              // 默认 0.8 (80%)

  // 保留最近 N 轮完整对话不压缩
  preserveRecentTurns: number;    // 默认 5

  // 单次压缩目标：压缩到上下文窗口的此比例
  targetRatio: number;            // 默认 0.4 (40%)
}
```

### 8.2 压缩策略

```typescript
class ContextCompactor {
  async compact(
    messages: Message[],
    config: CompactConfig,
    provider: LLMProvider,
  ): Promise<Message[]> {
    // 1. 保留最近 N 轮对话（不动）
    const recentCount = config.preserveRecentTurns * 2;
    const recentMessages = messages.slice(-recentCount);
    const oldMessages = messages.slice(0, -recentCount);

    if (oldMessages.length === 0) return messages;

    // 2. 用 LLM 对旧消息生成摘要
    const summary = await this.summarize(oldMessages, provider);

    // 3. 构造压缩后的消息序列
    return [
      {
        role: 'user',
        content: [{
          type: 'text',
          text: `[之前的对话摘要]\n${summary}\n[以下是最近的对话]`,
        }],
      },
      ...recentMessages,
    ];
  }

  private async summarize(messages: Message[], provider: LLMProvider): Promise<string> {
    const prompt = `请将以下对话历史压缩为简洁的摘要。保留：
1. 关键决策和结论
2. 用户明确提出的要求和偏好
3. 已完成的操作和结果
4. 未解决的问题

丢弃：
1. 详细的工具调用过程
2. 错误的尝试和回溯
3. 重复的确认信息

对话历史：
${this.messagesToText(messages)}`;

    // 用同一个 provider 调用 LLM 生成摘要
    // 注意：这里不需要工具，纯文本调用
    const result = await provider.chat({
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      system: '你是一个对话摘要助手。用中文生成简洁的摘要。',
      tools: [],
      maxTokens: 2000,
      stream: false,
    });

    return result;
  }
}
```

---

## 九、错误处理与重试

### 9.1 API 错误分类

```typescript
enum APIErrorType {
  RATE_LIMIT = 'rate_limit',         // 429 — 限流
  TOKEN_LIMIT = 'token_limit',       // 400 — token 超限
  SERVER_ERROR = 'server_error',     // 500 — 服务端错误
  AUTH_ERROR = 'auth_error',         // 401/403 — 认证失败
  NETWORK_ERROR = 'network_error',   // ECONNREFUSED 等
  TIMEOUT = 'timeout',               // 请求超时
  TOOL_ERROR = 'tool_error',         // 工具执行失败
}
```

### 9.2 重试策略

```typescript
class RetryPolicy {
  private maxRetries: number = 3;
  private baseDelay: number = 1000;   // 基础延迟 1s

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    isErrorRetryable: (err: any) => boolean,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;

        if (!isErrorRetryable(err)) throw err;
        if (attempt === this.maxRetries) throw err;

        // 指数退避 + 抖动
        const delay = this.baseDelay * Math.pow(2, attempt)
          + Math.random() * 1000;

        // 如果是限流错误，使用 Retry-After 头
        if (err.status === 429 && err.headers?.['retry-after']) {
          const retryAfter = parseInt(err.headers['retry-after']) * 1000;
          await sleep(retryAfter);
        } else {
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }
}

// 判断错误是否可重试
function isRetryable(err: any): boolean {
  if (err.status === 429) return true;       // 限流
  if (err.status >= 500) return true;         // 服务端错误
  if (err.code === 'ECONNRESET') return true;  // 网络中断
  if (err.code === 'ETIMEDOUT') return true;   // 超时
  return false;
}
```

### 9.3 Token 超限处理

```typescript
// 当 API 返回 token 超限错误时的处理
async function handleTokenExceeded(
  conversation: Conversation,
  compactor: ContextCompactor,
  provider: LLMProvider,
): Promise<void> {
  // 1. 压缩对话历史
  const compacted = await compactor.compact(
    conversation.getMessages(),
    DEFAULT_COMPACT_CONFIG,
    provider,
  );
  conversation.replaceMessages(compacted);

  // 2. 如果压缩后仍然超限，截断最早的对话
  while (conversation.getTokenCount() > provider.maxContextTokens * 0.8) {
    conversation.removeOldestPair();
  }
}
```

---

## 十、多轮循环保护

### 10.1 保护机制

```typescript
interface LoopConfig {
  maxToolRounds: number;        // 单次查询最大工具调用轮数，默认 50
  maxConsecutiveErrors: number;  // 最大连续错误数，默认 3
  stuckDetectionWindow: number;  // 卡死检测窗口（最近 N 轮），默认 5
}

class LoopGuard {
  private toolRoundCount = 0;
  private consecutiveErrors = 0;
  private recentToolCalls: string[] = [];

  shouldContinue(): { ok: boolean; reason?: string } {
    // 1. 检查最大轮数
    if (this.toolRoundCount >= this.config.maxToolRounds) {
      return { ok: false, reason: `已达到最大工具调用轮数 (${this.config.maxToolRounds})` };
    }

    // 2. 检查连续错误
    if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      return { ok: false, reason: `连续 ${this.config.maxConsecutiveErrors} 次工具调用失败` };
    }

    // 3. 卡死检测：最近 N 轮工具调用是否完全相同
    if (this.detectStuck()) {
      return { ok: false, reason: '检测到循环：最近几轮工具调用完全相同' };
    }

    return { ok: true };
  }

  recordToolCall(name: string, args: string, success: boolean): void {
    this.toolRoundCount++;
    if (success) {
      this.consecutiveErrors = 0;
    } else {
      this.consecutiveErrors++;
    }

    // 记录工具调用指纹用于卡死检测
    const fingerprint = `${name}:${this.hashArgs(args)}`;
    this.recentToolCalls.push(fingerprint);
    if (this.recentToolCalls.length > this.config.stuckDetectionWindow) {
      this.recentToolCalls.shift();
    }
  }

  private detectStuck(): boolean {
    if (this.recentToolCalls.length < 3) return false;
    const last = this.recentToolCalls[this.recentToolCalls.length - 1];
    const prev = this.recentToolCalls[this.recentToolCalls.length - 2];
    return last === prev;
  }

  reset(): void {
    this.toolRoundCount = 0;
    this.consecutiveErrors = 0;
    this.recentToolCalls = [];
  }
}
```

### 10.2 用户中断处理

```typescript
// 在 REPL 主循环中监听中断信号
class REPL {
  private aborted = false;

  setupInterruptHandler(): void {
    // Ctrl+C 中断当前工具调用循环（不退出程序）
    process.on('SIGINT', () => {
      if (this.engine.isRunning()) {
        this.aborted = true;
        this.engine.abort();
        this.ui.showMessage('（已中断当前操作，输入继续对话）');
      } else {
        // 空闲状态下按两次 Ctrl+C 退出
        this.handleExit();
      }
    });
  }
}
```

---

## 十一、费用追踪

### 11.1 费用计算

```typescript
interface PricingTier {
  inputPerMillion: number;      // 输入价格（每百万 token，美元）
  outputPerMillion: number;     // 输出价格（每百万 token，美元）
  cacheReadPerMillion?: number; // 缓存读取价格
}

const PRICING: Record<string, PricingTier> = {
  'deepseek-v4-pro':   { inputPerMillion: 2.0, outputPerMillion: 8.0 },
  'deepseek-v4-flash': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  'glm-5.1':           { inputPerMillion: 5.0, outputPerMillion: 5.0 },
  'qwen3-coder':       { inputPerMillion: 2.0, outputPerMillion: 6.0 },
  'claude-sonnet':      { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  // ...更多模型
};

class CostTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCost = 0;
  private model: string;

  track(usage: { input_tokens: number; output_tokens: number }): void {
    const pricing = PRICING[this.model] || { inputPerMillion: 0, outputPerMillion: 0 };

    this.totalInputTokens += usage.input_tokens;
    this.totalOutputTokens += usage.output_tokens;

    const cost =
      (usage.input_tokens / 1_000_000) * pricing.inputPerMillion +
      (usage.output_tokens / 1_000_000) * pricing.outputPerMillion;

    this.totalCost += cost;
  }

  getSummary(): { inputTokens: number; outputTokens: number; cost: number; model: string } {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      cost: Math.round(this.totalCost * 10000) / 10000,  // 保留4位小数
      model: this.model,
    };
  }
}
```

---

## 十二、终端渲染

### 12.1 Markdown 终端渲染

```typescript
import { render } from 'ink';
import { marked } from 'marked';
import { TerminalRenderer } from 'marked-terminal';

// 配置 marked 使用终端渲染器
marked.setOptions({
  renderer: new TerminalRenderer({
    code: chalk.cyan,
    codespan: chalk.cyan,
    heading: chalk.bold.green,
    link: chalk.blue.underline,
    strong: chalk.bold,
    em: chalk.italic,
    table: chalk.gray,
  }),
});

function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}
```

### 12.2 流式文本渲染

```typescript
// Ink 组件：流式渲染 LLM 输出
const StreamingText: FC<{ chunks: string[] }> = ({ chunks }) => {
  const fullText = chunks.join('');
  const rendered = useMemo(() => renderMarkdown(fullText), [fullText]);

  return <Text>{rendered}</Text>;
};
```

### 12.3 工具调用状态展示

```typescript
// 工具调用进行中的 spinner
const ToolSpinner: FC<{ name: string; status: string }> = ({ name, status }) => (
  <Box>
    <Spinner type="dots" />
    <Text color="yellow"> {name}: {status}</Text>
  </Box>
);

// 工具调用结果展示
const ToolResult: FC<{ name: string; success: boolean; summary: string }> = ({
  name, success, summary,
}) => (
  <Box>
    <Text color={success ? 'green' : 'red'}>
      {success ? 'OK' : 'FAIL'} {name}
    </Text>
    <Text color="gray"> {summary}</Text>
  </Box>
);
```

---

## 十三、Diff 预览

### 13.1 编辑前预览

```typescript
class DiffPreview {
  // 在执行 Edit 工具前展示 diff
  showDiff(filePath: string, oldContent: string, newContent: string): void {
    const diff = computeDiff(oldContent, newContent);

    for (const hunk of diff.hunks) {
      // 显示行号和变更内容
      // - 开头的行显示为红色（删除）
      // + 开头的行显示为绿色（新增）
      // 空格开头的行为灰色（上下文）
    }
  }

  // 确认是否应用修改
  async confirmApply(): Promise<boolean> {
    // 显示 "应用此修改? [Y/n]" 提示
    // Y = 应用，n = 跳过，e = 手动编辑
  }
}
```

---

## 十四、权限系统详细设计

### 14.1 四级权限

```typescript
enum PermissionLevel {
  ALLOW = 'allow',        // 自动允许，无需确认
  ASK = 'ask',            // 每次询问（默认）
  CONFIRM = 'confirm',    // 显示操作详情后确认（用于高风险操作）
  DENY = 'deny',          // 完全禁止
}
```

### 14.2 默认权限配置

```typescript
const DEFAULT_PERMISSIONS: Record<string, PermissionLevel> = {
  // 文件操作
  'read':           'allow',     // 读取文件 — 安全
  'write':          'ask',       // 写入文件 — 需确认
  'edit':           'ask',       // 编辑文件 — 需确认

  // 搜索
  'grep':           'allow',     // 内容搜索 — 安全
  'glob':           'allow',     // 文件匹配 — 安全

  // 命令执行
  'bash:read':      'allow',     // 只读命令（ls, cat, git status 等）
  'bash:write':     'ask',       // 写入命令（npm install, mkdir 等）
  'bash:dangerous': 'confirm',   // 危险命令（rm, git push --force 等）

  // 网络
  'web:fetch':      'allow',     // 网页抓取 — 安全
  'web:search':     'allow',     // 网页搜索 — 安全
};
```

### 14.3 Bash 命令分类

```typescript
// 根据 Bash 命令自动判断权限等级
function classifyBashCommand(command: string): PermissionLevel {
  const trimmed = command.trim();

  // 白名单：只读命令
  const readOnlyPatterns = [
    /^ls\b/, /^cat\b/, /^head\b/, /^tail\b/, /^find\b/, /^grep\b/,
    /^git\s+(status|log|diff|branch|remote)\b/,
    /^npm\s+(list|view|outdated)\b/,
    /^node\s+--version/, /^python\s+--version/,
    /^echo\b/, /^pwd\b/, /^which\b/, /^type\b/,
    /^wc\b/, /^sort\b/, /^uniq\b/, /^du\b/,
  ];

  // 黑名单：危险命令
  const dangerousPatterns = [
    /rm\s+-(rf|fr)\b/,
    /git\s+push\s+.*--force/,
    /git\s+reset\s+--hard/,
    /git\s+clean\s+-f/,
    /DROP\s+TABLE/i,
    /mkfs/,
    /dd\s+if=/,
    />\s*\/dev\//,  // 重定向到设备文件
  ];

  if (dangerousPatterns.some(p => p.test(trimmed))) return 'confirm';
  if (readOnlyPatterns.some(p => p.test(trimmed))) return 'allow';
  return 'ask';
}
```

### 14.4 权限持久化

```typescript
// ~/.sloth/settings.json 中的权限配置
interface PermissionStore {
  // 永久允许的工具/命令
  allowedTools: string[];
  // 永久禁止的工具/命令
  deniedTools: string[];
  // 本次会话临时允许的
  sessionAllowed: string[];
}

// 用户在权限确认时的选择：
// [Y] 本次允许  [A] 始终允许  [N] 本次拒绝  [D] 始终拒绝
type PermissionChoice = 'allow_once' | 'allow_always' | 'deny_once' | 'deny_always';
```

---

## 十五、更新后的项目结构

```
sloth/
  src/
    index.ts                          # 入口文件
    cli/
      repl.tsx                        # 交互式 REPL 循环
      ui/
        App.tsx                       # 根组件
        MessageList.tsx               # 对话消息渲染
        StreamingText.tsx             # 流式 Markdown 渲染
        ToolSpinner.tsx               # 工具调用 spinner
        ToolResult.tsx                # 工具结果展示
        InputArea.tsx                 # 用户输入区域
        ToolApproval.tsx              # 工具权限确认弹窗
        DiffPreview.tsx               # Diff 预览组件
        StatusBar.tsx                 # 底部状态栏
    core/
      engine.ts                       # 查询引擎 — 核心主循环
      conversation.ts                 # 对话历史管理
      context.ts                      # 上下文窗口 + 压缩策略
      config.ts                       # 配置加载
      system-prompt.ts                # 系统提示词构建器 ← 新增
      loop-guard.ts                   # 多轮循环保护 ← 新增
    providers/
      types.ts                        # 统一接口 + 消息格式
      anthropic.ts                    # Anthropic 流式适配器
      openai-compat.ts                # OpenAI 兼容流式适配器
      ollama.ts                       # Ollama 适配器
      presets/
        deepseek.ts
        qwen.ts
        glm.ts
        doubao.ts
        mimo.ts
      index.ts                        # 工厂 + 注册表
    tools/
      types.ts                        # 工具接口 + JSON Schema
      registry.ts                     # 工具注册表
      files/read.ts
      files/write.ts
      files/edit.ts
      search/grep.ts
      search/glob.ts
      bash.ts                         # 含命令分类逻辑
      web.ts
      notebook.ts
      diff.ts                         # Diff 计算 + 预览 ← 新增
      index.ts
    permissions/
      manager.ts                      # 权限检查 + 分类
      store.ts                        # 持久化存储
      classifier.ts                   # Bash 命令自动分类 ← 新增
    memory/
      manager.ts
      compactor.ts                    # Auto-compact 触发 + 执行
    hooks/
      runner.ts                       # Hook 执行器 ← 新增
      types.ts                        # Hook 类型定义 ← 新增
    sessions/
      manager.ts                      # 会话保存/恢复 ← 新增
    instructions/
      loader.ts                       # 项目指令分层加载 ← 新增
    commands/
      registry.ts                     # Slash 命令注册 ← 新增
      builtins.ts                     # 内置命令实现 ← 新增
    cost/
      tracker.ts                      # 费用追踪 ← 新增
      pricing.ts                      # 模型定价表 ← 新增
    agents/
      coordinator.ts
      sub-agent.ts
    mcp/
      client.ts
      types.ts
    git/
      operations.ts
```

---

## 十六、更新后的依赖列表

| 包名 | 用途 |
|------|------|
| ink (v5+) + react (18+) | 终端 UI 框架 |
| @anthropic-ai/sdk | Claude API（独立协议） |
| openai | OpenAI 兼容 API |
| tiktoken | Token 计数 |
| chalk | 终端彩色输出 |
| fast-glob | 文件模式匹配 |
| marked + marked-terminal | Markdown 终端渲染 |
| zod | 参数校验 |
| diff | 文本 diff 计算 |
| ink-spinner | 工具调用 spinner |
| ink-text-input | 用户输入组件 |
| nanoid | 会话 ID 生成 |
| dotenv | 环境变量加载 |
| vitest | 单元测试 + 集成测试框架 |
| nock | HTTP 请求 mock |
| strip-ansi | 终端输出断言（去除 ANSI 颜色码） |
| @types/node | Node.js 类型定义 |

---

## 十七、测试体系设计

### 17.1 测试分层

```
┌─────────────────────────────────────────┐
│  E2E 测试 (self-test)                    │  ← sloth 测试自己
│  模拟真实用户输入，验证完整对话流程          │
├─────────────────────────────────────────┤
│  集成测试                                 │  ← 多模块协作
│  引擎循环、Provider 消息转换、权限+工具联动  │
├─────────────────────────────────────────┤
│  单元测试                                 │  ← 单个函数/类
│  工具执行、权限分类、重试策略、压缩逻辑       │
├─────────────────────────────────────────┤
│  Mock 测试                               │  ← 不调用真实 API
│  模拟 LLM 响应，验证工具调用编排是否正确      │
└─────────────────────────────────────────┘
```

### 17.2 测试目录结构

```
sloth/
  tests/
    unit/                              # 单元测试
      tools/
        read.test.ts                   # Read 工具
        write.test.ts                  # Write 工具
        edit.test.ts                   # Edit 工具
        grep.test.ts                   # Grep 工具
        glob.test.ts                   # Glob 工具
        bash.test.ts                   # Bash 工具
      permissions/
        classifier.test.ts             # 命令分类
        manager.test.ts                # 权限检查
      core/
        conversation.test.ts           # 对话管理
        system-prompt.test.ts          # 提示词构建
        loop-guard.test.ts             # 循环保护
        compactor.test.ts              # 上下文压缩
      providers/
        anthropic-adapter.test.ts      # Anthropic 消息转换
        openai-adapter.test.ts         # OpenAI 消息转换
        factory.test.ts                # Provider 工厂
      cost/
        tracker.test.ts                # 费用计算
      hooks/
        runner.test.ts                 # Hook 执行
      sessions/
        manager.test.ts                # 会话保存/恢复
      instructions/
        loader.test.ts                 # 指令加载
      commands/
        parser.test.ts                 # 命令解析
    integration/                       # 集成测试
      engine-loop.test.ts              # 核心循环（mock LLM）
      provider-roundtrip.test.ts       # 消息转换往返一致性
      permission-tool-flow.test.ts     # 权限 + 工具联动
      session-resume.test.ts           # 会话保存 + 恢复
    e2e/                               # 端到端测试
      self-test/                       # sloth 测试自己
        fixtures/                      # 测试用 fixture 项目
          sample-project/
            src/
              main.ts
              utils.ts
            package.json
        scenarios/
          read-file.test.ts            # "读取 main.ts" → 调用 Read
          edit-file.test.ts            # "修改 utils.ts 的函数名" → Read + Edit
          search-code.test.ts          # "查找所有 TODO" → Grep
          create-file.test.ts          # "创建新组件" → Write
          multi-step.test.ts           # "修复这个 bug" → Read + Edit + Bash(test)
          conversation.test.ts         # 多轮对话上下文保持
      smoke/
        boot.test.ts                   # 能否正常启动
        provider-switch.test.ts        # 切换 provider
    helpers/
      mock-provider.ts                 # Mock LLM Provider
      mock-llm-responses.ts            # 预录的 LLM 响应
      test-fixture.ts                  # 测试 fixture 管理
      assertions.ts                    # 自定义断言
    vitest.config.ts                   # Vitest 配置
```

### 17.3 核心测试基础设施

#### Mock Provider — 不调用真实 API

```typescript
// tests/helpers/mock-provider.ts

import { LLMProvider, StreamEvent, ChatParams } from '../../src/providers/types';

interface MockResponse {
  text?: string;                       // 要输出的文本
  toolCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  stopReason?: string;
}

export class MockProvider implements LLMProvider {
  name = 'mock';
  private responseQueue: MockResponse[] = [];
  private callLog: ChatParams[] = [];

  // 预设 LLM 响应（按调用顺序消费）
  enqueueResponse(response: MockResponse): void {
    this.responseQueue.push(response);
  }

  // 预设多轮对话：用户输入 → LLM 回复（含工具调用）→ 工具结果 → LLM 总结
  enqueueConversation(responses: MockResponse[]): void {
    this.responseQueue.push(...responses);
  }

  async *chat(params: ChatParams): AsyncIterable<StreamEvent> {
    this.callLog.push(params);

    const response = this.responseQueue.shift();
    if (!response) throw new Error('MockProvider: 没有预设响应了');

    // 模拟文本输出
    if (response.text) {
      yield { type: 'text_delta', text: response.text };
    }

    // 模拟工具调用
    if (response.toolCalls) {
      for (const tc of response.toolCalls) {
        const id = `mock_call_${Math.random().toString(36).slice(2)}`;
        yield { type: 'tool_call_start', id, name: tc.name };
        yield { type: 'tool_call_delta', id, args_delta: JSON.stringify(tc.args) };
        yield { type: 'tool_call_end', id, name: tc.name, args: JSON.stringify(tc.args) };
      }
    }

    yield { type: 'usage', input_tokens: 100, output_tokens: 50 };
    yield { type: 'done', stop_reason: response.stopReason || 'end_turn' };
  }

  // 获取调用记录，用于断言 LLM 收到了正确的消息
  getCallLog(): ChatParams[] {
    return this.callLog;
  }

  getLastSystemPrompt(): string {
    return this.callLog[this.callLog.length - 1]?.system || '';
  }

  getLastMessages(): Message[] {
    return this.callLog[this.callLog.length - 1]?.messages || [];
  }

  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);  // 粗略估算
  }

  getToolFormat(): 'openai' { return 'openai'; }
}
```

#### 测试 Fixture 管理

```typescript
// tests/helpers/test-fixture.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class TestFixture {
  private tmpDir: string = '';

  async setup(files: Record<string, string>): Promise<string> {
    // 创建临时目录并写入测试文件
    this.tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sloth-test-'));

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(this.tmpDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }

    return this.tmpDir;
  }

  async readFile(relativePath: string): Promise<string> {
    return fs.readFile(path.join(this.tmpDir, relativePath), 'utf-8');
  }

  async fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.tmpDir, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.tmpDir) {
      await fs.rm(this.tmpDir, { recursive: true, force: true });
    }
  }
}
```

### 17.4 单元测试用例

#### 工具测试

```typescript
// tests/unit/tools/read.test.ts

describe('Read Tool', () => {
  let fixture: TestFixture;

  beforeEach(async () => {
    fixture = new TestFixture();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('应正确读取文件内容并附带行号', async () => {
    const dir = await fixture.setup({
      'hello.txt': '第一行\n第二行\n第三行',
    });

    const result = await readTool.execute({
      file_path: path.join(dir, 'hello.txt'),
    });

    expect(result).toContain('第一行');
    expect(result).toContain('第二行');
    expect(result).toContain('第三行');
  });

  it('应支持 offset + limit 分段读取', async () => {
    const dir = await fixture.setup({
      'large.txt': Array.from({ length: 100 }, (_, i) => `行${i + 1}`).join('\n'),
    });

    const result = await readTool.execute({
      file_path: path.join(dir, 'large.txt'),
      offset: 10,
      limit: 5,
    });

    // 应只包含第 11-15 行
    expect(result).toContain('行11');
    expect(result).toContain('行15');
    expect(result).not.toContain('行10');
    expect(result).not.toContain('行16');
  });

  it('文件不存在时应返回错误', async () => {
    await expect(
      readTool.execute({ file_path: '/nonexistent/file.txt' })
    ).rejects.toThrow();
  });
});
```

```typescript
// tests/unit/tools/edit.test.ts

describe('Edit Tool', () => {
  let fixture: TestFixture;

  beforeEach(async () => {
    fixture = new TestFixture();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('应精确替换匹配的字符串', async () => {
    const dir = await fixture.setup({
      'code.ts': 'function hello() {\n  return "world";\n}',
    });

    await editTool.execute({
      file_path: path.join(dir, 'code.ts'),
      old_string: 'return "world"',
      new_string: 'return "hello"',
    });

    const content = await fixture.readFile('code.ts');
    expect(content).toContain('return "hello"');
    expect(content).not.toContain('return "world"');
  });

  it('old_string 不唯一时应报错', async () => {
    const dir = await fixture.setup({
      'dup.ts': 'const x = 1;\nconst x = 1;',
    });

    await expect(
      editTool.execute({
        file_path: path.join(dir, 'dup.ts'),
        old_string: 'const x = 1;',
        new_string: 'const x = 2;',
      })
    ).rejects.toThrow(/唯一/);
  });

  it('replace_all=true 时应替换所有匹配', async () => {
    const dir = await fixture.setup({
      'rename.ts': 'oldName();\noldName();\noldName();',
    });

    await editTool.execute({
      file_path: path.join(dir, 'rename.ts'),
      old_string: 'oldName',
      new_string: 'newName',
      replace_all: true,
    });

    const content = await fixture.readFile('rename.ts');
    expect(content).toBe('newName();\nnewName();\nnewName();');
  });

  it('old_string 不存在时应报错', async () => {
    const dir = await fixture.setup({
      'file.ts': 'hello world',
    });

    await expect(
      editTool.execute({
        file_path: path.join(dir, 'file.ts'),
        old_string: 'not exist',
        new_string: 'something',
      })
    ).rejects.toThrow();
  });
});
```

#### 权限分类测试

```typescript
// tests/unit/permissions/classifier.test.ts

describe('Bash 命令分类', () => {
  it('只读命令应为 allow', () => {
    expect(classifyBashCommand('ls -la')).toBe('allow');
    expect(classifyBashCommand('git status')).toBe('allow');
    expect(classifyBashCommand('git log --oneline -5')).toBe('allow');
    expect(classifyBashCommand('cat package.json')).toBe('allow');
    expect(classifyBashCommand('pwd')).toBe('allow');
    expect(classifyBashCommand('node --version')).toBe('allow');
  });

  it('危险命令应为 confirm', () => {
    expect(classifyBashCommand('rm -rf node_modules')).toBe('confirm');
    expect(classifyBashCommand('git push --force origin main')).toBe('confirm');
    expect(classifyBashCommand('git reset --hard HEAD~1')).toBe('confirm');
    expect(classifyBashCommand('DROP TABLE users')).toBe('confirm');
  });

  it('普通写命令应为 ask', () => {
    expect(classifyBashCommand('npm install lodash')).toBe('ask');
    expect(classifyBashCommand('mkdir build')).toBe('ask');
    expect(classifyBashCommand('npx tsc')).toBe('ask');
  });
});
```

#### 循环保护测试

```typescript
// tests/unit/core/loop-guard.test.ts

describe('LoopGuard', () => {
  it('应允许正常操作继续', () => {
    const guard = new LoopGuard({ maxToolRounds: 10, maxConsecutiveErrors: 3, stuckDetectionWindow: 5 });

    for (let i = 0; i < 9; i++) {
      guard.recordToolCall('Read', '{}', true);
      expect(guard.shouldContinue()).toEqual({ ok: true });
    }
  });

  it('达到最大轮数时应停止', () => {
    const guard = new LoopGuard({ maxToolRounds: 5, maxConsecutiveErrors: 3, stuckDetectionWindow: 5 });

    for (let i = 0; i < 5; i++) {
      guard.recordToolCall('Read', `{"n":${i}}`, true);
    }

    const result = guard.shouldContinue();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('最大工具调用轮数');
  });

  it('连续错误超限时应停止', () => {
    const guard = new LoopGuard({ maxToolRounds: 50, maxConsecutiveErrors: 3, stuckDetectionWindow: 5 });

    for (let i = 0; i < 3; i++) {
      guard.recordToolCall('Bash', '{"command":"fail"}', false);
    }

    const result = guard.shouldContinue();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('连续');
  });

  it('重复相同调用应触发卡死检测', () => {
    const guard = new LoopGuard({ maxToolRounds: 50, maxConsecutiveErrors: 3, stuckDetectionWindow: 5 });

    guard.recordToolCall('Read', '{"file_path":"a.ts"}', true);
    guard.recordToolCall('Read', '{"file_path":"a.ts"}', true);
    guard.recordToolCall('Read', '{"file_path":"a.ts"}', true);

    const result = guard.shouldContinue();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('循环');
  });
});
```

#### Provider 消息转换测试

```typescript
// tests/unit/providers/openai-adapter.test.ts

describe('OpenAI 消息转换', () => {
  const adapter = new OpenAICompatProvider('test', 'https://api.test.com', 'test-model');

  it('应正确转换纯文本消息', () => {
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: '你好' }] },
      { role: 'assistant', content: [{ type: 'text', text: '你好！' }] },
    ];

    const result = messages.flatMap(m => adapter['convertMessage'](m));

    expect(result).toEqual([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！' },
    ]);
  });

  it('应正确转换工具调用消息', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call_1', name: 'Read', input: { file_path: '/test.ts' } },
        ],
      },
    ];

    const result = messages.flatMap(m => adapter['convertMessage'](m));

    expect(result[0]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: 'call_1',
        type: 'function',
        function: { name: 'Read', arguments: '{"file_path":"/test.ts"}' },
      }],
    });
  });

  it('应正确转换工具结果消息', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'call_1', output: 'file content here' },
        ],
      },
    ];

    const result = messages.flatMap(m => adapter['convertMessage'](m));

    expect(result[0]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      content: 'file content here',
    });
  });

  it('消息转换往返应保持一致', () => {
    // 统一格式 → OpenAI 格式 → 解析回统一格式
    const original: Message[] = [
      { role: 'user', content: [{ type: 'text', text: '读取 main.ts' }] },
      { role: 'assistant', content: [
        { type: 'tool_use', id: 'c1', name: 'Read', input: { file_path: '/main.ts' } },
      ]},
      { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'c1', output: 'console.log("hi")' },
      ]},
      { role: 'assistant', content: [
        { type: 'text', text: '这是 main.ts 的内容' },
      ]},
    ];

    const openaiMsgs = original.flatMap(m => adapter['convertMessage'](m));
    const roundtrip = convertOpenAIBytesBack(openaiMsgs);

    expect(roundtrip).toEqual(original);
  });
});
```

### 17.5 集成测试用例

#### 核心引擎循环（Mock LLM）

```typescript
// tests/integration/engine-loop.test.ts

describe('Engine 主循环', () => {
  let engine: Engine;
  let mockProvider: MockProvider;
  let fixture: TestFixture;

  beforeEach(async () => {
    fixture = new TestFixture();
    mockProvider = new MockProvider();
    const dir = await fixture.setup({
      'app.ts': 'export function greet(name: string) {\n  return `Hello, ${name}!`;\n}',
    });
    engine = new Engine(mockProvider, { cwd: dir });
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('完整的 Read 流程：用户提问 → LLM 调用 Read → 返回内容', async () => {
    // 预设 LLM 行为：先调用 Read，然后总结
    mockProvider.enqueueConversation([
      {
        toolCalls: [{ name: 'Read', args: { file_path: path.join(engine.cwd, 'app.ts') } }],
        stopReason: 'tool_use',
      },
      {
        text: '这个文件定义了一个 greet 函数，接受 name 参数返回问候语。',
      },
    ]);

    const result = await engine.query('读取 app.ts 的内容');

    // 验证最终文本输出
    expect(result.text).toContain('greet');
    // 验证 LLM 收到了正确的工具结果
    const lastMessages = mockProvider.getLastMessages();
    const toolResult = lastMessages.find(m =>
      m.content.some(b => b.type === 'tool_result')
    );
    expect(toolResult).toBeDefined();
  });

  it('Edit 流程：LLM 先 Read 再 Edit', async () => {
    const filePath = path.join(engine.cwd, 'app.ts');

    mockProvider.enqueueConversation([
      {
        toolCalls: [{ name: 'Read', args: { file_path: filePath } }],
        stopReason: 'tool_use',
      },
      {
        toolCalls: [{
          name: 'Edit',
          args: {
            file_path: filePath,
            old_string: 'Hello, ${name}!',
            new_string: 'Hi, ${name}!',
          },
        }],
        stopReason: 'tool_use',
      },
      { text: '已将问候语从 Hello 改为 Hi。' },
    ]);

    await engine.query('把问候语改为 Hi');

    const content = await fixture.readFile('app.ts');
    expect(content).toContain('Hi, ${name}!');
    expect(content).not.toContain('Hello, ${name}!');
  });

  it('权限拒绝时应将错误信息注入对话', async () => {
    // 设置 Edit 需要确认，模拟用户拒绝
    engine.setPermissionResponse('deny_once');

    const filePath = path.join(engine.cwd, 'app.ts');

    mockProvider.enqueueConversation([
      {
        toolCalls: [{ name: 'Read', args: { file_path: filePath } }],
        stopReason: 'tool_use',
      },
      {
        toolCalls: [{
          name: 'Edit',
          args: {
            file_path: filePath,
            old_string: 'hello',
            new_string: 'bye',
          },
        }],
        stopReason: 'tool_use',
      },
      { text: '好的，我不会修改这个文件。' },
    ]);

    await engine.query('修改 app.ts');

    // 文件内容应未改变
    const content = await fixture.readFile('app.ts');
    expect(content).toContain('Hello');
  });

  it('多轮对话应保持上下文', async () => {
    const filePath = path.join(engine.cwd, 'app.ts');

    // 第一轮：读取文件
    mockProvider.enqueueConversation([
      {
        toolCalls: [{ name: 'Read', args: { file_path: filePath } }],
        stopReason: 'tool_use',
      },
      { text: '已读取 app.ts，包含 greet 函数。' },
    ]);

    await engine.query('读取 app.ts');

    // 第二轮：基于之前的上下文提问
    mockProvider.enqueueConversation([
      { text: 'greet 函数接受一个 name 参数，返回模板字符串。' },
    ]);

    await engine.query('这个函数接受什么参数？');

    // 验证第二轮 LLM 收到的消息包含第一轮的上下文
    const messages = mockProvider.getCallLog()[1].messages;
    expect(messages.length).toBeGreaterThan(2);  // 包含之前的对话
  });
});
```

#### 消息转换往返一致性

```typescript
// tests/integration/provider-roundtrip.test.ts

describe('Provider 消息转换往返一致性', () => {
  const testCases: Array<{
    name: string;
    messages: Message[];
  }> = [
    {
      name: '纯文本对话',
      messages: [
        { role: 'user', content: [{ type: 'text', text: '你好' }] },
        { role: 'assistant', content: [{ type: 'text', text: '你好！' }] },
      ],
    },
    {
      name: '工具调用 + 结果',
      messages: [
        { role: 'user', content: [{ type: 'text', text: '读取文件' }] },
        { role: 'assistant', content: [
          { type: 'tool_use', id: 'c1', name: 'Read', input: { file_path: '/a.ts' } },
        ]},
        { role: 'user', content: [
          { type: 'tool_result', tool_use_id: 'c1', output: 'content' },
        ]},
      ],
    },
    {
      name: '多工具调用',
      messages: [
        { role: 'assistant', content: [
          { type: 'tool_use', id: 'c1', name: 'Read', input: { file_path: '/a.ts' } },
          { type: 'tool_use', id: 'c2', name: 'Grep', input: { pattern: 'TODO' } },
        ]},
        { role: 'user', content: [
          { type: 'tool_result', tool_use_id: 'c1', output: 'file a' },
          { type: 'tool_result', tool_use_id: 'c2', output: 'no match' },
        ]},
      ],
    },
    {
      name: '工具错误',
      messages: [
        { role: 'assistant', content: [
          { type: 'tool_use', id: 'c1', name: 'Bash', input: { command: 'invalid' } },
        ]},
        { role: 'user', content: [
          { type: 'tool_result', tool_use_id: 'c1', output: 'command not found', is_error: true },
        ]},
      ],
    },
  ];

  for (const provider of ['anthropic', 'openai'] as const) {
    describe(`${provider} 适配器`, () => {
      for (const tc of testCases) {
        it(tc.name, () => {
          const adapter = createAdapter(provider);
          const converted = tc.messages.flatMap(m => adapter.convertMessage(m));
          const roundtrip = adapter.parseBack(converted);
          expect(roundtrip).toEqual(tc.messages);
        });
      }
    });
  }
});
```

### 17.6 E2E 自测 — sloth 测试自己

这是核心创新：开发完成后，sloth 调用自身来验证功能。

#### 测试原理

```
sloth (被测)
  ├── 启动 mock provider（不调真实 API）
  ├── 注入预设的 LLM 响应
  ├── 发送模拟用户输入
  ├── 验证工具调用是否正确
  └── 验证文件系统变化是否符合预期
```

#### 自测场景

```typescript
// tests/e2e/self-test/scenarios/read-file.test.ts

describe('自测：读取文件', () => {
  let sloth: SlothTestRunner;

  beforeEach(async () => {
    sloth = new SlothTestRunner({
      // 创建模拟项目
      projectFiles: {
        'src/main.ts': 'import { greet } from "./utils";\n\nconsole.log(greet("world"));',
        'src/utils.ts': 'export function greet(name: string) {\n  return `Hello, ${name}!`;\n}',
        'package.json': '{"name": "test-project", "version": "1.0.0"}',
      },
    });
    await sloth.start();
  });

  afterEach(async () => {
    await sloth.stop();
  });

  it('用户说 "读取 main.ts" → sloth 应调用 Read 工具并返回内容', async () => {
    const result = await sloth.sendInput('读取 src/main.ts 的内容');

    // 验证：sloth 调用了 Read 工具
    expect(result.toolCalls).toContainEqual(
      expect.objectContaining({ name: 'Read' })
    );

    // 验证：sloth 的回复中包含文件内容
    expect(result.text).toContain('greet');
    expect(result.text).toContain('world');
  });
});
```

```typescript
// tests/e2e/self-test/scenarios/edit-file.test.ts

describe('自测：编辑文件', () => {
  let sloth: SlothTestRunner;

  beforeEach(async () => {
    sloth = new SlothTestRunner({
      projectFiles: {
        'src/utils.ts': 'export function add(a: number, b: number) {\n  return a + b;\n}',
      },
    });
    await sloth.start();
  });

  afterEach(async () => {
    await sloth.stop();
  });

  it('修改函数名：先 Read 再 Edit', async () => {
    const result = await sloth.sendInput('把 add 函数改名为 sum');

    // 验证工具调用顺序
    expect(result.toolCalls.map(t => t.name)).toEqual(['Read', 'Edit']);

    // 验证 Edit 参数正确
    const editCall = result.toolCalls[1];
    expect(editCall.args.old_string).toContain('add');
    expect(editCall.args.new_string).toContain('sum');

    // 验证文件实际已修改
    expect(await sloth.readFile('src/utils.ts')).toContain('export function sum');
    expect(await sloth.readFile('src/utils.ts')).not.toContain('export function add');
  });
});
```

```typescript
// tests/e2e/self-test/scenarios/multi-step.test.ts

describe('自测：多步骤任务', () => {
  let sloth: SlothTestRunner;

  beforeEach(async () => {
    sloth = new SlothTestRunner({
      projectFiles: {
        'src/calc.ts': 'export function multiply(a, b) {\n  return a * b;\n}',
      },
    });
    await sloth.start();
  });

  afterEach(async () => {
    await sloth.stop();
  });

  it('修复 bug：添加类型 + 运行测试', async () => {
    const result = await sloth.sendInput(
      'calc.ts 的 multiply 函数缺少参数类型，请修复并确认代码能运行'
    );

    // 验证：至少调用了 Read 和 Edit
    expect(result.toolCalls.map(t => t.name)).toContain('Read');
    expect(result.toolCalls.map(t => t.name)).toContain('Edit');

    // 验证：文件已添加类型
    const content = await sloth.readFile('src/calc.ts');
    expect(content).toContain('a: number');
    expect(content).toContain('b: number');
  });
});
```

#### SlothTestRunner 实现

```typescript
// tests/helpers/sloth-test-runner.ts

export class SlothTestRunner {
  private engine: Engine;
  private mockProvider: MockProvider;
  private fixture: TestFixture;
  private toolCallLog: Array<{ name: string; args: any; result: any }> = [];
  cwd: string;

  constructor(private config: { projectFiles: Record<string, string> }) {}

  async start(): Promise<void> {
    this.fixture = new TestFixture();
    this.cwd = await this.fixture.setup(this.config.projectFiles);
    this.mockProvider = new MockProvider();
    this.engine = new Engine(this.mockProvider, {
      cwd: this.cwd,
      // 自动批准所有工具调用（测试模式）
      autoApprove: true,
      onToolCall: (name, args, result) => {
        this.toolCallLog.push({ name, args, result });
      },
    });
  }

  async sendInput(userMessage: string): Promise<{
    text: string;
    toolCalls: Array<{ name: string; args: any; result: any }>;
  }> {
    this.toolCallLog = [];

    // MockProvider 需要根据上下文动态响应
    // 这里用真实 LLM 的思维链模式：让 mock 基于系统提示词和工具描述
    // 生成"看起来合理"的工具调用序列
    const result = await this.engine.query(userMessage);

    return {
      text: result.text,
      toolCalls: [...this.toolCallLog],
    };
  }

  async readFile(relativePath: string): Promise<string> {
    return this.fixture.readFile(relativePath);
  }

  async stop(): Promise<void> {
    await this.fixture.cleanup();
  }
}
```

### 17.7 真实 API 烟雾测试

上述测试都使用 Mock Provider。还需要一套调用真实 API 的烟雾测试，验证：
1. 各 Provider 的 API 连通性
2. 流式响应解析是否正确
3. 工具调用能否被正确触发和执行

```typescript
// tests/e2e/smoke/real-api.test.ts
// 标记为 @slow，CI 中可选运行

describe.skip('真实 API 烟雾测试（需要 API Key）', () => {
  const providers = ['deepseek', 'glm', 'qwen'] as const;

  for (const providerName of providers) {
    describe(`${providerName} 真实 API`, () => {
      it('应能正常完成一次文本对话', async () => {
        const provider = createProviderFromConfig(providerName);
        const events: StreamEvent[] = [];

        for await (const event of provider.chat({
          messages: [{ role: 'user', content: [{ type: 'text', text: '说"测试成功"' }] }],
          system: '你是一个测试助手。只回复四个字：测试成功',
          tools: [],
          maxTokens: 100,
        })) {
          events.push(event);
        }

        const text = events
          .filter(e => e.type === 'text_delta')
          .map(e => (e as any).text)
          .join('');
        expect(text).toContain('测试');
      });

      it('应能触发工具调用', async () => {
        const provider = createProviderFromConfig(providerName);
        const events: StreamEvent[] = [];

        for await (const event of provider.chat({
          messages: [{ role: 'user', content: [{ type: 'text', text: '读取 test.txt' }] }],
          system: '你是编程助手。使用工具完成任务。',
          tools: [readToolDef],  // 只给 Read 工具
          maxTokens: 500,
        })) {
          events.push(event);
        }

        const toolCalls = events.filter(e => e.type === 'tool_call_end');
        expect(toolCalls.length).toBeGreaterThan(0);
        expect((toolCalls[0] as any).name).toBe('Read');
      });
    });
  }
});
```

### 17.8 自测自修复流程

开发完成后，用 sloth 自身来测试和迭代：

```
┌──────────────────────────────────────────────┐
│  Self-Test & Self-Fix 循环                    │
│                                              │
│  1. npm test → 全量运行测试套件                │
│  2. 如果测试失败：                             │
│     a. 启动 sloth（用真实 API）                │
│     b. 输入："运行测试，分析失败原因并修复"      │
│     c. sloth 自行：                           │
│        - 执行 Bash(npm test)                  │
│        - 读取失败日志                          │
│        - 定位出错的源文件                      │
│        - 用 Edit 修复代码                     │
│        - 再次 Bash(npm test) 验证             │
│     d. 如果仍失败，重复 b-c                    │
│  3. 全部通过 → 完成                           │
└──────────────────────────────────────────────┘
```

```json
// package.json scripts
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e",
    "test:smoke": "vitest run tests/e2e/smoke",
    "self-test": "npm test || npm run self-fix",
    "self-fix": "tsx src/index.ts --prompt \"运行 npm test，分析失败原因并修复代码，直到测试全部通过\""
  }
}
```

### 17.9 Vitest 配置

```typescript
// tests/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    // E2E 和真实 API 测试单独运行
    exclude: [
      'tests/e2e/smoke/**',
    ],
    timeout: 30000,
    testTimeout: 10000,
    // 测试之间清理
    setupFiles: ['tests/helpers/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

```typescript
// tests/helpers/setup.ts
import { afterEach } from 'vitest';

// 全局清理：确保测试用 fixture 被清理
const activeFixtures: TestFixture[] = [];

globalThis.registerFixture = (f: TestFixture) => {
  activeFixtures.push(f);
};

afterEach(async () => {
  while (activeFixtures.length) {
    const f = activeFixtures.pop()!;
    await f.cleanup();
  }
});
```

### 17.10 测试覆盖率目标

| 模块 | 目标覆盖率 | 说明 |
|------|-----------|------|
| tools/* | 90%+ | 工具是核心功能，必须充分测试 |
| permissions/* | 90%+ | 安全相关，不能有盲区 |
| providers/* | 80%+ | 消息转换逻辑是关键 |
| core/engine | 70%+ | 引擎逻辑依赖 Mock Provider |
| core/loop-guard | 95%+ | 逻辑简单但必须正确 |
| core/compactor | 70%+ | 压缩逻辑需要 Mock LLM |
| commands/* | 80%+ | 命令解析和分发 |
| hooks/* | 80%+ | Hook 执行和模板替换 |
| sessions/* | 85%+ | 文件读写 + 序列化 |
| **总体** | **80%+** | |
