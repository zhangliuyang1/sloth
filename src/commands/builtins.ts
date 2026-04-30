export const BUILTIN_COMMANDS = [
  { name: 'help', description: '显示帮助信息' },
  { name: 'clear', description: '清空当前对话' },
  { name: 'compact', description: '手动压缩对话历史' },
  { name: 'model', description: '查看/切换模型 (如 /model deepseek 或 /model glm glm-4-plus)' },
  { name: 'config', description: '交互式配置管理' },
  { name: 'cost', description: '显示当前会话费用统计' },
  { name: 'exit', description: '退出 Sloth' },
  { name: 'quit', description: '退出 Sloth' },
] as const;

export function getHelpText(): string {
  const lines = BUILTIN_COMMANDS.map(c => `  /${c.name.padEnd(12)} ${c.description}`);
  return `可用命令:\n${lines.join('\n')}`;
}
