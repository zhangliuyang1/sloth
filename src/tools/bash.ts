import { exec } from 'child_process';
import type { ToolDefinition, ToolExecutor, ToolResult, ToolContext } from './types.js';

export const bashDefinition: ToolDefinition = {
  name: 'Bash',
  description: `执行 shell 命令并返回输出。

何时使用：
- 运行构建、测试、安装依赖等命令
- 执行专用工具无法完成的操作
- 使用只有命令行才能提供的功能

使用注意：
- command 中不要使用交互式输入
- 设置合理的 timeout（默认 120000ms）
- 不执行破坏性命令（rm -rf、git push --force 等）除非用户明确要求
- 优先使用专用工具（Read/Edit/Write/Grep/Glob）`,
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的 shell 命令' },
      timeout: { type: 'number', description: '超时时间（毫秒），默认 120000（2 分钟）' },
      description: { type: 'string', description: '命令用途的简短描述（用于权限确认提示）' },
    },
    required: ['command'],
  },
  permission: 'ask',
};

export const bashExecutor: ToolExecutor = {
  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const command = params.command as string;
    const timeout = (params.timeout as number) ?? 120000;

    return new Promise((resolve) => {
      const proc = exec(command, {
        cwd: ctx.cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      }, (error, stdout, stderr) => {
        const output = (stdout || '') + (stderr ? `\nSTDERR:\n${stderr}` : '');

        if (error) {
          const killed = error.signal === 'SIGTERM';
          const msg = killed
            ? `Command timed out after ${timeout}ms\n${output}`
            : `Exit code ${error.code}: ${error.message}\n${output}`;
          resolve({ output: msg, isError: true });
        } else {
          resolve({ output: output.trim() || '(no output)' });
        }
      });

      if (ctx.abortSignal) {
        ctx.abortSignal.addEventListener('abort', () => proc.kill('SIGTERM'), { once: true });
      }
    });
  },
};
