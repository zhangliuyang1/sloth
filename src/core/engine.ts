import type { LLMProvider, ContentBlock, ChatParams } from '../providers/types.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { ToolContext } from '../tools/types.js';
import { Conversation } from './conversation.js';
import { buildSystemPrompt, type SystemPromptContext } from './system-prompt.js';
import { LoopGuard } from './loop-guard.js';
import type { PermissionManager } from '../permissions/manager.js';
import { loadProjectInstructions } from './instructions.js';
import type { UsageStats } from './pricing.js';

export interface EngineConfig {
  cwd: string;
  provider: LLMProvider;
  toolRegistry: ToolRegistry;
  permissionManager: PermissionManager;
  maxTokens?: number;
  abortSignal?: AbortSignal;
}

export interface EngineResult {
  text: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }>;
}

export class Engine {
  readonly cwd: string;
  private provider: LLMProvider;
  private toolRegistry: ToolRegistry;
  private permissionManager: PermissionManager;
  private conversation: Conversation;
  private loopGuard: LoopGuard;
  private maxTokens: number;
  private abortSignal?: AbortSignal;
  private textCallback?: (text: string) => void;
  private toolCallCallback?: (name: string, status: 'start' | 'end', detail?: string) => void;
  private usageCallback?: (stats: UsageStats) => void;
  private totalUsage: UsageStats = { inputTokens: 0, outputTokens: 0, cost: 0 };

  constructor(config: EngineConfig) {
    this.cwd = config.cwd;
    this.provider = config.provider;
    this.toolRegistry = config.toolRegistry;
    this.permissionManager = config.permissionManager;
    this.conversation = new Conversation();
    this.loopGuard = new LoopGuard();
    this.maxTokens = config.maxTokens ?? 8192;
    this.abortSignal = config.abortSignal;
  }

  onText(cb: (text: string) => void): void {
    this.textCallback = cb;
  }

  onToolCall(cb: (name: string, status: 'start' | 'end', detail?: string) => void): void {
    this.toolCallCallback = cb;
  }

  onUsage(cb: (stats: UsageStats) => void): void {
    this.usageCallback = cb;
  }

  getUsageStats(): UsageStats {
    return { ...this.totalUsage };
  }

  clearConversation(): void {
    this.conversation.clear();
  }

  switchProvider(provider: LLMProvider): void {
    this.provider = provider;
  }

  getConversation(): Conversation {
    return this.conversation;
  }

  async query(userMessage: string): Promise<EngineResult> {
    this.loopGuard.reset();
    this.conversation.addUserMessage([{ type: 'text', text: userMessage }]);

    const result: EngineResult = { text: '', toolCalls: [] };
    let continueLoop = true;

    while (continueLoop) {
      if (this.abortSignal?.aborted) break;

      const guard = this.loopGuard.shouldContinue();
      if (!guard.ok) {
        const msg = `[系统] ${guard.reason}`;
        this.textCallback?.(msg);
        result.text += msg;
        break;
      }

      const systemPrompt = this.buildSystemPrompt();
      const tools = this.toolRegistry.getToolDefsForLLM();

      const params: ChatParams = {
        messages: this.conversation.getMessages(),
        system: systemPrompt,
        tools: tools as ChatParams['tools'],
        maxTokens: this.maxTokens,
      };

      const assistantBlocks: ContentBlock[] = [];
      let currentText = '';
      const toolCalls: Array<{ id: string; name: string; args: string }> = [];

      try {
        for await (const event of this.provider.chat(params)) {
          if (this.abortSignal?.aborted) break;

          switch (event.type) {
            case 'text_delta':
              currentText += event.text;
              this.textCallback?.(event.text);
              break;
            case 'tool_call_start':
              this.toolCallCallback?.(event.name, 'start');
              break;
            case 'tool_call_delta':
              break;
            case 'tool_call_end': {
              toolCalls.push({ id: event.id, name: event.name, args: event.args });
              break;
            }
            case 'usage':
              this.totalUsage.inputTokens += event.input_tokens;
              this.totalUsage.outputTokens += event.output_tokens;
              this.usageCallback?.({ ...this.totalUsage });
              break;
            case 'done':
              break;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const errMsg = `[API Error] ${msg}`;
        this.textCallback?.(errMsg);
        result.text += errMsg;
        break;
      }

      if (currentText) {
        assistantBlocks.push({ type: 'text', text: currentText });
        result.text += currentText;
      }

      if (toolCalls.length === 0) {
        if (assistantBlocks.length > 0) {
          this.conversation.addAssistantMessage(assistantBlocks);
        }
        continueLoop = false;
        continue;
      }

      // Process tool calls
      this.conversation.addAssistantMessage([
        ...assistantBlocks,
        ...toolCalls.map(tc => ({
          type: 'tool_use' as const,
          id: tc.id,
          name: tc.name,
          input: JSON.parse(tc.args) as Record<string, unknown>,
        })),
      ]);

      const toolResults: ContentBlock[] = [];
      for (const tc of toolCalls) {
        let parsedArgs: Record<string, unknown>;
        try {
          parsedArgs = JSON.parse(tc.args);
        } catch {
          parsedArgs = { raw_args: tc.args };
        }

        const approved = await this.permissionManager.check(tc.name, parsedArgs);
        const toolCtx: ToolContext = { cwd: this.cwd, abortSignal: this.abortSignal };

        let toolOutput: string;
        if (!approved) {
          toolOutput = '[Permission denied] User denied this operation.';
        } else {
          const toolResult = await this.toolRegistry.execute(tc.name, parsedArgs, toolCtx);
          toolOutput = toolResult.output;
          this.loopGuard.recordToolCall(tc.name, tc.args, !toolResult.isError);
          result.toolCalls.push({ name: tc.name, args: parsedArgs, result: toolOutput });
        }

        this.toolCallCallback?.(tc.name, 'end', toolOutput.slice(0, 200));
        toolResults.push({ type: 'tool_result', tool_use_id: tc.id, output: toolOutput });
      }

      this.conversation.addUserMessage(toolResults);
      continueLoop = true;
    }

    return result;
  }

  private buildSystemPrompt(): string {
    const ctx: SystemPromptContext = {
      cwd: this.cwd,
      platform: process.platform,
      shell: process.env.SHELL ?? process.env.COMSPEC ?? 'unknown',
      projectInstructions: loadProjectInstructions(this.cwd),
      memoryFiles: [],
    };
    return buildSystemPrompt(ctx);
  }
}
