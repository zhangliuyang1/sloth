import { ToolRegistry } from './registry.js';
import { readDefinition, readExecutor } from './files/read.js';
import { writeDefinition, writeExecutor } from './files/write.js';
import { editDefinition, editExecutor } from './files/edit.js';
import { grepDefinition, grepExecutor } from './search/grep.js';
import { globDefinition, globExecutor } from './search/glob.js';
import { bashDefinition, bashExecutor } from './bash.js';

export { ToolRegistry } from './registry.js';
export type { ToolDefinition, ToolExecutor, ToolResult, ToolContext } from './types.js';

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readDefinition, readExecutor);
  registry.register(writeDefinition, writeExecutor);
  registry.register(editDefinition, editExecutor);
  registry.register(grepDefinition, grepExecutor);
  registry.register(globDefinition, globExecutor);
  registry.register(bashDefinition, bashExecutor);
  return registry;
}
