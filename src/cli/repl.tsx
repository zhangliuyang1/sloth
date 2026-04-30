import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { Engine } from '../core/engine.js';
import { createDefaultToolRegistry } from '../tools/index.js';
import { PermissionManager } from '../permissions/manager.js';
import { PermissionStore } from '../permissions/store.js';
import type { LLMProvider } from '../providers/types.js';
import type { PermissionChoice } from '../permissions/types.js';

export interface REPLConfig {
  cwd: string;
  provider: LLMProvider;
  providerName: string;
  modelName: string;
}

export function startREPL(config: REPLConfig): void {
  const toolRegistry = createDefaultToolRegistry();
  const permissionStore = new PermissionStore();
  const permissionManager = new PermissionManager(permissionStore);

  const engine = new Engine({
    cwd: config.cwd,
    provider: config.provider,
    toolRegistry,
    permissionManager,
  });

  // Wire up approval callback so PermissionManager prompts via UI
  const approvalCallback = async (_toolName: string, _detail: string): Promise<PermissionChoice> => {
    // Default to allow in non-interactive or when UI can't prompt
    return 'allow_once';
  };

  permissionManager.setApprovalCallback(approvalCallback);

  render(React.createElement(App, {
    engine,
    providerName: config.providerName,
    modelName: config.modelName,
  }));
}
