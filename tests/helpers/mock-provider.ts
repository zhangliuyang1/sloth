import type { LLMProvider, StreamEvent, ChatParams, Message } from '../../src/providers/types.js';

interface MockResponse {
  text?: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  stopReason?: string;
}

export class MockProvider implements LLMProvider {
  name = 'mock';
  model = 'mock-model';
  private responseQueue: MockResponse[] = [];
  private callLog: ChatParams[] = [];

  enqueueResponse(response: MockResponse): void {
    this.responseQueue.push(response);
  }

  enqueueConversation(responses: MockResponse[]): void {
    this.responseQueue.push(...responses);
  }

  async *chat(params: ChatParams): AsyncIterable<StreamEvent> {
    this.callLog.push(params);

    const response = this.responseQueue.shift();
    if (!response) throw new Error('MockProvider: no more queued responses');

    if (response.text) {
      yield { type: 'text_delta', text: response.text };
    }

    if (response.toolCalls) {
      for (const tc of response.toolCalls) {
        const id = `mock_${Math.random().toString(36).slice(2)}`;
        yield { type: 'tool_call_start', id, name: tc.name };
        const argsStr = JSON.stringify(tc.args);
        yield { type: 'tool_call_delta', id, args_delta: argsStr };
        yield { type: 'tool_call_end', id, name: tc.name, args: argsStr };
      }
    }

    yield { type: 'usage', input_tokens: 100, output_tokens: 50 };
    yield { type: 'done', stop_reason: response.stopReason || 'end_turn' };
  }

  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }

  getCallLog(): ChatParams[] {
    return this.callLog;
  }

  getLastMessages(): Message[] {
    return this.callLog[this.callLog.length - 1]?.messages || [];
  }
}
