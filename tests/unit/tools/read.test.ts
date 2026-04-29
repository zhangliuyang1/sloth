import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { TestFixture } from '../../helpers/test-fixture.js';
import { readExecutor } from '../../../src/tools/files/read.js';

describe('Read Tool', () => {
  let fixture: TestFixture;

  beforeEach(() => { fixture = new TestFixture(); });
  afterEach(async () => { await fixture.cleanup(); });

  it('should read file with line numbers', async () => {
    const dir = await fixture.setup({ 'hello.txt': 'line1\nline2\nline3' });
    const result = await readExecutor.execute({ file_path: path.join(dir, 'hello.txt') }, { cwd: dir });
    expect(result.output).toContain('line1');
    expect(result.output).toContain('line2');
    expect(result.isError).toBeUndefined();
  });

  it('should support offset + limit', async () => {
    const content = Array.from({ length: 100 }, (_, i) => `row${i + 1}`).join('\n');
    const dir = await fixture.setup({ 'large.txt': content });
    const result = await readExecutor.execute({
      file_path: path.join(dir, 'large.txt'),
      offset: 10,
      limit: 5,
    }, { cwd: dir });
    expect(result.output).toContain('row11');
    expect(result.output).toContain('row15');
    expect(result.output).not.toContain('row10');
    expect(result.output).not.toContain('row16');
  });

  it('should error on missing file', async () => {
    const result = await readExecutor.execute({ file_path: '/nonexistent/file.txt' }, { cwd: '/tmp' });
    expect(result.isError).toBe(true);
  });
});
