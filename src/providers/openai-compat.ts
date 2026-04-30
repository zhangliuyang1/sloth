import OpenAI from 'openai';
import type { LLMProvider, StreamEvent, ChatParams, Message, ContentBlock, ToolDef } from './types.js';
import { countTokens } from '../core/tokenizer.js';

export class OpenAICompatProvider implements LLMProvider {
  readonly name: string;
  readonly model: string;
  private client: OpenAI;
  private thinkingEffort?: 'low' | 'medium' | 'high';

  constructor(config: { apiKey?: string; baseURL: string; model: string; name?: string; thinkingEffort?: 'low' | 'medium' | 'high' }) {
    this.client = new OpenAI({
      apiKey: config.apiKey || 'unused',
      baseURL: config.baseURL,
    });
    this.model = config.model;
    this.name = config.name || 'openai-compat';
    this.thinkingEffort = config.thinkingEffort;
  }

  async *chat(params: ChatParams): AsyncIterable<StreamEvent> {
    const openaiMsgs = params.messages.flatMap(msg => this.convertMessage(msg));
    openaiMsgs.unshift({ role: 'system', content: params.system });
    const tools = params.tools.length ? params.tools.map(this.convertToolDef) : undefined;

    const effort = params.thinkingEffort ?? this.thinkingEffort;

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMsgs as OpenAI.ChatCompletionMessageParam[],
      tools,
      max_tokens: params.maxTokens,
      stream: true,
      ...(effort ? { reasoning_effort: effort } : {}),
    } as OpenAI.ChatCompletionCreateParamsStreaming);

    const toolAccumulators = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        yield { type: 'text_delta', text: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;

          if (!toolAccumulators.has(idx)) {
            toolAccumulators.set(idx, { id: tc.id || '', name: tc.function?.name || '', args: '' });
            yield { type: 'tool_call_start', id: tc.id || '', name: tc.function?.name || '' };
          }

          const acc = toolAccumulators.get(idx)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) {
            acc.args += tc.function.arguments;
            yield { type: 'tool_call_delta', id: acc.id, args_delta: tc.function.arguments };
          }
        }
      }

      const finishReason = chunk.choices[0]?.finish_reason;
      if (finishReason === 'tool_calls') {
        for (const [, acc] of toolAccumulators) {
          yield { type: 'tool_call_end', id: acc.id, name: acc.name, args: acc.args };
        }
        toolAccumulators.clear();
      }

      if (finishReason === 'stop') {
        yield { type: 'done', stop_reason: 'end_turn' };
      }

      if (chunk.usage) {
        yield { type: 'usage', input_tokens: chunk.usage.prompt_tokens, output_tokens: chunk.usage.completion_tokens };
      }
    }

    // Safety: if stream ended without done event
    if (toolAccumulators.size > 0) {
      for (const [, acc] of toolAccumulators) {
        yield { type: 'tool_call_end', id: acc.id, name: acc.name, args: acc.args };
      }
      toolAccumulators.clear();
    }
  }

  async countTokens(text: string): Promise<number> {
    return countTokens(text);
  }

  convertMessage(msg: Message): OpenAI.ChatCompletionMessageParam[] {
    const results: OpenAI.ChatCompletionMessageParam[] = [];

    if (msg.role === 'assistant') {
      const textBlocks = msg.content.filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text');
      const toolBlocks = msg.content.filter((b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use');

      if (textBlocks.length || toolBlocks.length === 0) {
        results.push({ role: 'assistant', content: textBlocks.map(b => b.text).join('') || null });
      }
      if (toolBlocks.length) {
        results.push({
          role: 'assistant',
          content: null,
          tool_calls: toolBlocks.map(b => ({
            id: b.id,
            type: 'function' as const,
            function: { name: b.name, arguments: JSON.stringify(b.input) },
          })),
        });
      }
    } else {
      const textBlocks = msg.content.filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text');
      const resultBlocks = msg.content.filter((b): b is Extract<ContentBlock, { type: 'tool_result' }> => b.type === 'tool_result');

      if (textBlocks.length) {
        results.push({ role: 'user', content: textBlocks.map(b => b.text).join('') });
      }
      for (const rb of resultBlocks) {
        results.push({
          role: 'tool',
          tool_call_id: rb.tool_use_id,
          content: rb.output,
        } as OpenAI.ChatCompletionToolMessageParam);
      }
    }

    return results;
  }

  private convertToolDef(tool: ToolDef): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: tool.parameters as OpenAI.FunctionParameters },
    };
  }
}
