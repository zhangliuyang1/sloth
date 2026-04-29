import * as fs from 'fs/promises';
import type { ToolDefinition, ToolExecutor, ToolResult, ToolContext } from '../types.js';

export const editDefinition: ToolDefinition = {
  name: 'Edit',
  description: `对现有文件进行精确的字符串替换编辑。

工作原理：
- 在文件中查找 old_string 的精确匹配
- 将匹配到的内容替换为 new_string
- old_string 必须在文件中是唯一的，否则编辑会失败

何时使用：
- 修改现有文件的局部内容时（首选方式）
- 重命名变量、修改函数、修复 bug 时

使用注意：
- old_string 必须与文件中的内容完全匹配（包括缩进和空格）
- 不要在 old_string 中包含行号
- 如果 old_string 不唯一，扩大上下文使其唯一
- 使用 replace_all: true 可以替换所有匹配项
- 修改前必须先用 Read 读取文件确认当前内容`,
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '要编辑的文件的绝对路径' },
      old_string: { type: 'string', description: '要被替换的原始文本（必须与文件内容精确匹配）' },
      new_string: { type: 'string', description: '替换后的新文本' },
      replace_all: { type: 'boolean', description: '是否替换所有匹配项（默认 false）。用于重命名变量等场景。', default: false },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  permission: 'ask',
};

export const editExecutor: ToolExecutor = {
  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const filePath = params.file_path as string;
    const oldString = params.old_string as string;
    const newString = params.new_string as string;
    const replaceAll = (params.replace_all as boolean) ?? false;

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (!content.includes(oldString)) {
        return { output: `old_string not found in ${filePath}`, isError: true };
      }

      if (!replaceAll) {
        const firstIdx = content.indexOf(oldString);
        const secondIdx = content.indexOf(oldString, firstIdx + 1);
        if (secondIdx !== -1) {
          return {
            output: `old_string is not unique in ${filePath}. Found multiple matches. Use replace_all: true or provide more context to make old_string unique.`,
            isError: true,
          };
        }
      }

      const newContent = replaceAll
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString);

      await fs.writeFile(filePath, newContent, 'utf-8');

      const count = replaceAll ? content.split(oldString).length - 1 : 1;
      return { output: `Successfully edited ${filePath} (${count} replacement${count > 1 ? 's' : ''})` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: `Failed to edit file: ${message}`, isError: true };
    }
  },
};
