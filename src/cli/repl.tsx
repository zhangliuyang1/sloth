import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { Engine } from '../core/engine.js';
import { createDefaultToolRegistry } from '../tools/index.js';
import { PermissionManager } from '../permissions/manager.js';
import { PermissionStore } from '../permissions/store.js';
import type { LLMProvider } from '../providers/types.js';
import type { SlothConfig } from '../core/config.js';

export interface REPLConfig {
  cwd: string;
  provider: LLMProvider;
  providerName: string;
  modelName: string;
  config: SlothConfig;
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

  const approvalCallback = async (_toolName: string, _detail: string): Promise<'allow_once'> => {
    return 'allow_once';
  };

  permissionManager.setApprovalCallback(approvalCallback);

  render(React.createElement(App, {
    engine,
    providerName: config.providerName,
    modelName: config.modelName,
    initialConfig: config.config,
  }));
}
