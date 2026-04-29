import { describe, it, expect } from 'vitest';
import { OpenAICompatProvider } from '../../../src/providers/openai-compat.js';
import type { Message } from '../../../src/providers/types.js';

describe('OpenAI message conversion', () => {
  const adapter = new OpenAICompatProvider({ apiKey: 'test', baseURL: 'https://api.test.com/v1', model: 'test-model' });

  it('should convert plain text messages', () => {
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'hi!' }] },
    ];
    const result = messages.flatMap(m => adapter.convertMessage(m));
    expect(result).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi!' },
    ]);
  });

  it('should convert tool_use messages', () => {
    const messages: Message[] = [{
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'call_1', name: 'Read', input: { file_path: '/test.ts' } }],
    }];
    const result = messages.flatMap(m => adapter.convertMessage(m));
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

  it('should convert tool_result messages', () => {
    const messages: Message[] = [{
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'call_1', output: 'file content here' }],
    }];
    const result = messages.flatMap(m => adapter.convertMessage(m));
    expect(result[0]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      content: 'file content here',
    });
  });

  it('should handle mixed content blocks', () => {
    const messages: Message[] = [{
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me read that file.' },
        { type: 'tool_use', id: 'c1', name: 'Read', input: { file_path: '/a.ts' } },
      ],
    }];
    const result = messages.flatMap(m => adapter.convertMessage(m));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: 'assistant', content: 'Let me read that file.' });
    expect(result[1]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'c1', type: 'function', function: { name: 'Read', arguments: '{"file_path":"/a.ts"}' } }],
    });
  });
});
