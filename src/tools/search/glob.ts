import * as fs from 'fs/promises';
import * as path from 'path';
import type { ToolDefinition, ToolExecutor, ToolResult, ToolContext } from '../types.js';

export const globDefinition: ToolDefinition = {
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
      pattern: { type: 'string', description: 'glob 模式（如 "**/*.ts", "src/**/*.tsx"）' },
      path: { type: 'string', description: '搜索的目录路径（默认当前工作目录）' },
    },
    required: ['pattern'],
  },
  permission: 'allow',
};

async function getFilesRecursive(dir: string, prefix: string = ''): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const subFiles = await getFilesRecursive(path.join(dir, entry.name), relPath);
      files.push(...subFiles);
    } else {
      files.push(relPath);
    }
  }
  return files;
}

function globMatch(pattern: string, filePath: string): boolean {
  const regexStr = pattern
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*')
    .replace(/\?/g, '[^/]')
    .replace(/\.(?![*])/g, '\.')
    .replace(/\{([^}]+)\}/g, (_, group) => `(${group.split(',').join('|')})`);
  return new RegExp(`^${regexStr}$`).test(filePath);
}

export const globExecutor: ToolExecutor = {
  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const pattern = params.pattern as string;
    const searchPath = (params.path as string) || ctx.cwd;

    try {
      const allFiles = await getFilesRecursive(searchPath);
      const matched = allFiles.filter(f => globMatch(pattern, f));

      if (matched.length === 0) {
        return { output: 'No files matched the pattern' };
      }

      return { output: matched.join('\n') };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: `Glob error: ${message}`, isError: true };
    }
  },
};
