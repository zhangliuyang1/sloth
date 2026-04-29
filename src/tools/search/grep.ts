import * as fs from 'fs/promises';
import * as path from 'path';
import type { ToolDefinition, ToolExecutor, ToolResult, ToolContext } from '../types.js';

export const grepDefinition: ToolDefinition = {
  name: 'Grep',
  description: `在文件内容中搜索匹配的文本。支持正则表达式。

何时使用：
- 查找某个函数/变量/类的定义位置
- 查找所有引用某段代码的位置
- 搜索代码模式

使用注意：
- pattern 参数支持正则表达式
- 使用 glob 参数限定文件类型
- 结果过多时使用 head_limit 限制数量
- 已知文件路径时直接用 Read，不要搜索`,
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: '要搜索的正则表达式模式' },
      path: { type: 'string', description: '搜索的目录路径（默认当前工作目录）' },
      glob: { type: 'string', description: '文件类型过滤（如 "*.ts", "*.{js,jsx}"）' },
      output_mode: { type: 'string', enum: ['files_with_matches', 'content', 'count'], description: '输出模式' },
      head_limit: { type: 'number', description: '限制返回结果数量' },
      context: { type: 'number', description: '显示匹配行前后各多少行（仅 content 模式）' },
    },
    required: ['pattern'],
  },
  permission: 'allow',
};

async function* walkDir(dir: string, globPattern?: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const globRegex = globPattern ? globToRegex(globPattern) : null;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;

    if (entry.isDirectory()) {
      yield* walkDir(fullPath, globPattern);
    } else if (entry.isFile()) {
      if (!globRegex || globRegex.test(entry.name)) {
        yield fullPath;
      }
    }
  }
}

function globToRegex(glob: string): RegExp {
  const pattern = glob
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*')
    .replace(/\?/g, '[^/]')
    .replace(/\.(?!\*)/g, '\.')
    .replace(/\{([^}]+)\}/g, (_, group) => `(${group.split(',').join('|')})`);
  return new RegExp(pattern);
}

export const grepExecutor: ToolExecutor = {
  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const pattern = params.pattern as string;
    const searchPath = (params.path as string) || ctx.cwd;
    const glob = params.glob as string | undefined;
    const outputMode = (params.output_mode as string) || 'content';
    const headLimit = params.head_limit as number | undefined;
    const contextLines = (params.context as number) ?? 0;

    try {
      const regex = new RegExp(pattern, 'i');
      const files: string[] = [];
      const matches: Array<{ file: string; line: number; text: string; context?: string[] }> = [];

      for await (const filePath of walkDir(searchPath, glob)) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');
          let fileMatched = false;

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              fileMatched = true;
              if (outputMode === 'content' || outputMode === 'count') {
                const ctxLines = contextLines > 0
                  ? lines.slice(Math.max(0, i - contextLines), i + contextLines + 1)
                  : undefined;
                matches.push({ file: path.relative(searchPath, filePath), line: i + 1, text: lines[i], context: ctxLines });
              }
            }
          }

          if (fileMatched && outputMode === 'files_with_matches') {
            files.push(path.relative(searchPath, filePath));
          }
        } catch {
          // Skip unreadable files
        }
      }

      if (outputMode === 'files_with_matches') {
        const result = headLimit ? files.slice(0, headLimit) : files;
        return { output: result.join('\n') || 'No matches found' };
      }

      if (outputMode === 'count') {
        return { output: `${matches.length} matches` };
      }

      const limited = headLimit ? matches.slice(0, headLimit) : matches;
      const output = limited.map(m => {
        if (m.context) {
          const ctxOutput = m.context.map(l => `  ${l}`).join('\n');
          return `${m.file}:${m.line}\n${ctxOutput}`;
        }
        return `${m.file}:${m.line}: ${m.text}`;
      }).join('\n');

      return { output: output || 'No matches found' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: `Grep error: ${message}`, isError: true };
    }
  },
};
