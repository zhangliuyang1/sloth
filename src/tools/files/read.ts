import * as fs from 'fs/promises';
import type { ToolDefinition, ToolExecutor, ToolResult, ToolContext } from '../types.js';

export const readDefinition: ToolDefinition = {
  name: 'Read',
  description: `读取文件内容。返回带行号的文件内容。

何时使用：
- 需要查看文件内容时
- 修改文件前了解当前内容时
- 用户要求查看某个文件时

使用注意：
- file_path 必须是绝对路径
- 大文件用 offset + limit 分段读取
- 不要用 Bash 的 cat 命令替代此工具`,
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '要读取的文件的绝对路径' },
      offset: { type: 'number', description: '起始行号（0-based），用于读取大文件的一部分' },
      limit: { type: 'number', description: '最多读取的行数' },
    },
    required: ['file_path'],
  },
  permission: 'allow',
};

export const readExecutor: ToolExecutor = {
  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const filePath = params.file_path as string;
    const offset = (params.offset as number) ?? 0;
    const limit = params.limit as number | undefined;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const start = offset;
      const end = limit !== undefined ? start + limit : lines.length;
      const selectedLines = lines.slice(start, end);

      const numbered = selectedLines
        .map((line, i) => `${start + i + 1}\t${line}`)
        .join('\n');

      return { output: numbered || '(empty file)' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: `Failed to read file: ${message}`, isError: true };
    }
  },
};
