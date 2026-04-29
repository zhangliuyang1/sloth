import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { MockProvider } from '../helpers/mock-provider.js';
import { TestFixture } from '../helpers/test-fixture.js';
import { Engine } from '../../src/core/engine.js';
import { createDefaultToolRegistry } from '../../src/tools/index.js';
import { PermissionManager } from '../../src/permissions/manager.js';

describe('Engine main loop', () => {
  let engine: Engine;
  let mockProvider: MockProvider;
  let fixture: TestFixture;

  beforeEach(async () => {
    fixture = new TestFixture();
    mockProvider = new MockProvider();
    const dir = await fixture.setup({
      'app.ts': 'export function greet(name: string) {\n  return `Hello, ${name}!`;\n}',
    });
    const registry = createDefaultToolRegistry();
    const permManager = new PermissionManager(); // no callback = auto-approve
    engine = new Engine({ cwd: dir, provider: mockProvider, toolRegistry: registry, permissionManager: permManager });
  });

  afterEach(async () => { await fixture.cleanup(); });

  it('full Read flow: user asks -> LLM calls Read -> returns content', async () => {
    const filePath = path.join(engine.cwd, 'app.ts');
    mockProvider.enqueueConversation([
      { toolCalls: [{ name: 'Read', args: { file_path: filePath } }], stopReason: 'tool_use' },
      { text: 'This file defines a greet function.' },
    ]);

    const result = await engine.query('Read app.ts');
    expect(result.text).toContain('greet');
    expect(result.toolCalls.length).toBeGreaterThan(0);
    expect(result.toolCalls[0].name).toBe('Read');
  });

  it('Edit flow: LLM reads then edits', async () => {
    const filePath = path.join(engine.cwd, 'app.ts');
    mockProvider.enqueueConversation([
      { toolCalls: [{ name: 'Read', args: { file_path: filePath } }], stopReason: 'tool_use' },
      { toolCalls: [{ name: 'Edit', args: { file_path: filePath, old_string: 'Hello, ${name}!', new_string: 'Hi, ${name}!' } }], stopReason: 'tool_use' },
      { text: 'Changed greeting.' },
    ]);

    await engine.query('Change greeting to Hi');
    const content = await fixture.readFile('app.ts');
    expect(content).toContain('Hi, ${name}!');
    expect(content).not.toContain('Hello, ${name}!');
  });

  it('should maintain context across queries', async () => {
    const filePath = path.join(engine.cwd, 'app.ts');
    mockProvider.enqueueConversation([
      { toolCalls: [{ name: 'Read', args: { file_path: filePath } }], stopReason: 'tool_use' },
      { text: 'Read app.ts.' },
    ]);

    await engine.query('Read app.ts');

    mockProvider.enqueueConversation([
      { text: 'The function takes a name parameter.' },
    ]);

    await engine.query('What parameter does it take?');

    const messages = mockProvider.getLastMessages();
    expect(messages.length).toBeGreaterThan(2);
  });
});
