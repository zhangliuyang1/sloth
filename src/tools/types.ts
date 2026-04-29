export type PermissionLevel = 'allow' | 'ask' | 'confirm' | 'deny';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  permission: PermissionLevel;
}

export interface ToolResult {
  output: string;
  isError?: boolean;
}

export interface ToolContext {
  cwd: string;
  abortSignal?: AbortSignal;
}

export interface ToolExecutor {
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
