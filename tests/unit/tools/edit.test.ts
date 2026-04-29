import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { TestFixture } from '../../helpers/test-fixture.js';
import { editExecutor } from '../../../src/tools/files/edit.js';

describe('Edit Tool', () => {
  let fixture: TestFixture;

  beforeEach(() => { fixture = new TestFixture(); });
  afterEach(async () => { await fixture.cleanup(); });

  it('should replace exact match', async () => {
    const dir = await fixture.setup({ 'code.ts': 'function hello() {\n  return "world";\n}' });
    await editExecutor.execute({
      file_path: path.join(dir, 'code.ts'),
      old_string: 'return "world"',
      new_string: 'return "hello"',
    }, { cwd: dir });
    const content = await fixture.readFile('code.ts');
    expect(content).toContain('return "hello"');
    expect(content).not.toContain('return "world"');
  });

  it('should fail when old_string is not unique', async () => {
    const dir = await fixture.setup({ 'dup.ts': 'const x = 1;\nconst x = 1;' });
    const result = await editExecutor.execute({
      file_path: path.join(dir, 'dup.ts'),
      old_string: 'const x = 1;',
      new_string: 'const x = 2;',
    }, { cwd: dir });
    expect(result.isError).toBe(true);
    expect(result.output).toContain('not unique');
  });

  it('should replace all with replace_all=true', async () => {
    const dir = await fixture.setup({ 'rename.ts': 'oldName();\noldName();\noldName();' });
    await editExecutor.execute({
      file_path: path.join(dir, 'rename.ts'),
      old_string: 'oldName',
      new_string: 'newName',
      replace_all: true,
    }, { cwd: dir });
    const content = await fixture.readFile('rename.ts');
    expect(content).toBe('newName();\nnewName();\nnewName();');
  });

  it('should fail when old_string not found', async () => {
    const dir = await fixture.setup({ 'file.ts': 'hello world' });
    const result = await editExecutor.execute({
      file_path: path.join(dir, 'file.ts'),
      old_string: 'not exist',
      new_string: 'something',
    }, { cwd: dir });
    expect(result.isError).toBe(true);
  });
});
