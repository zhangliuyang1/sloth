import * as fs from 'fs/promises';
import * as path from 'path';
import type { ToolDefinition, ToolExecutor, ToolResult, ToolContext } from '../types.js';

export const writeDefinition: ToolDefinition = {
  name: 'Write',
  description: `创建新文件或完全覆盖现有文件。

何时使用：
- 创建新文件时
- 需要完全重写文件内容时（文件内容变化超过 50%）

使用注意：
- file_path 必须是绝对路径
- 对于已存在文件的局部修改，优先使用 Edit 工具
- 写入前确保目标目录存在`,
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '要写入的文件的绝对路径' },
      content: { type: 'string', description: '要写入的完整文件内容' },
    },
    required: ['file_path', 'content'],
  },
  permission: 'ask',
};

export const writeExecutor: ToolExecutor = {
  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const filePath = params.file_path as string;
    const content = params.content as string;

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { output: `Successfully wrote to ${filePath}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: `Failed to write file: ${message}`, isError: true };
    }
  },
};
