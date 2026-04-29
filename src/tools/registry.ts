import type { ToolDefinition, ToolExecutor, ToolContext, ToolResult } from './types.js';

interface RegisteredTool {
  definition: ToolDefinition;
  executor: ToolExecutor;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(definition: ToolDefinition, executor: ToolExecutor): void {
    this.tools.set(definition.name, { definition, executor });
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  getToolDefsForLLM(): { name: string; description: string; parameters: Record<string, unknown> }[] {
    return this.getAll().map(({ name, description, parameters }) => ({ name, description, parameters }));
  }

  async execute(name: string, params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { output: `Unknown tool: ${name}`, isError: true };
    }
    try {
      return await tool.executor.execute(params, ctx);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: `Tool execution error: ${message}`, isError: true };
    }
  }
}
