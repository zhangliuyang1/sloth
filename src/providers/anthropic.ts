import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, StreamEvent, ChatParams, Message, ToolDef } from './types.js';
import { countTokens } from '../core/tokenizer.js';

const THINKING_BUDGET: Record<string, number> = {
  low: 2048,
  medium: 8192,
  high: 16384,
};

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private client: Anthropic;
  private thinkingEffort?: 'low' | 'medium' | 'high';

  constructor(config: { apiKey: string; model: string; baseURL?: string; thinkingEffort?: 'low' | 'medium' | 'high' }) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model;
    this.thinkingEffort = config.thinkingEffort;
  }

  async *chat(params: ChatParams): AsyncIterable<StreamEvent> {
    const messages = params.messages.map(this.convertMessage);
    const tools = params.tools.length ? params.tools.map(this.convertToolDef) : undefined;

    const effort = params.thinkingEffort ?? this.thinkingEffort;
    const thinkingConfig = effort ? {
      type: 'enabled' as const,
      budget_tokens: THINKING_BUDGET[effort] ?? THINKING_BUDGET.medium,
    } : undefined;

    const stream = this.client.messages.stream({
      model: this.model,
      system: params.system,
      messages,
      tools,
      max_tokens: params.maxTokens,
      ...(thinkingConfig ? { thinking: thinkingConfig } : {}),
    });

    let currentToolCall: { id: string; name: string; args: string } | null = null;

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start':
          if (event.content_block.type === 'tool_use') {
            currentToolCall = { id: event.content_block.id, name: event.content_block.name, args: '' };
            yield { type: 'tool_call_start', id: currentToolCall.id, name: currentToolCall.name };
          }
          break;

        case 'content_block_delta':
          if (event.delta.type === 'text_delta') {
            yield { type: 'text_delta', text: event.delta.text };
          } else if (event.delta.type === 'input_json_delta' && currentToolCall) {
            currentToolCall.args += event.delta.partial_json;
            yield { type: 'tool_call_delta', id: currentToolCall.id, args_delta: event.delta.partial_json };
          } else if (event.delta.type === 'thinking_delta') {
            yield { type: 'thinking_delta', text: event.delta.thinking };
          }
          break;

        case 'content_block_stop':
          if (currentToolCall) {
            yield { type: 'tool_call_end', id: currentToolCall.id, name: currentToolCall.name, args: currentToolCall.args };
            currentToolCall = null;
          }
          break;

        case 'message_delta': {
          const usage = (event as any).usage;
          if (usage) {
            yield { type: 'usage', input_tokens: usage.input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0 };
          }
          if ((event as any).delta?.stop_reason) {
            yield { type: 'done', stop_reason: (event as any).delta.stop_reason };
          }
          break;
        }
      }
    }
  }

  async countTokens(text: string): Promise<number> {
    return countTokens(text);
  }

  private convertMessage(msg: Message): Anthropic.MessageParam {
    return {
      role: msg.role,
      content: msg.content.map(block => {
        if (block.type === 'text') return { type: 'text' as const, text: block.text };
        if (block.type === 'tool_use') {
          return { type: 'tool_use' as const, id: block.id, name: block.name, input: block.input };
        }
        if (block.type === 'tool_result') {
          return { type: 'tool_result' as const, tool_use_id: block.tool_use_id, content: block.output, is_error: block.is_error };
        }
        return block as never;
      }),
    };
  }

  private convertToolDef(tool: ToolDef): Anthropic.Tool {
    return { name: tool.name, description: tool.description, input_schema: tool.parameters as Anthropic.Tool.InputSchema };
  }
}
