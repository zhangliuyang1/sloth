import type { PermissionLevel, PermissionChoice } from './types.js';
import { classifyBashCommand } from './classifier.js';
import { PermissionStore } from './store.js';

export type ApprovalCallback = (toolName: string, detail: string) => Promise<PermissionChoice>;

export class PermissionManager {
  private store: PermissionStore;
  private sessionAllowed = new Set<string>();
  private approvalCallback?: ApprovalCallback;

  constructor(store?: PermissionStore) {
    this.store = store ?? new PermissionStore();
  }

  setApprovalCallback(cb: ApprovalCallback): void {
    this.approvalCallback = cb;
  }

  getPermissionLevel(toolName: string, params: Record<string, unknown>): PermissionLevel {
    // Check store (permanent rules)
    const stored = this.store.getLevel(toolName);
    if (stored === 'allow' || stored === 'deny') return stored;

    // Check session rules
    if (this.sessionAllowed.has(toolName)) return 'allow';

    // Bash commands need dynamic classification
    if (toolName === 'Bash' && params.command) {
      return classifyBashCommand(params.command as string);
    }

    // Default based on tool
    const defaults: Record<string, PermissionLevel> = {
      Read: 'allow',
      Grep: 'allow',
      Glob: 'allow',
      Write: 'ask',
      Edit: 'ask',
      Bash: 'ask',
    };

    return defaults[toolName] ?? 'ask';
  }

  async check(toolName: string, params: Record<string, unknown>): Promise<boolean> {
    const level = this.getPermissionLevel(toolName, params);

    if (level === 'allow') return true;
    if (level === 'deny') return false;

    // ask or confirm: need user approval
    if (!this.approvalCallback) return true; // no callback = auto-approve (testing)

    const detail = toolName === 'Bash'
      ? `Execute: ${params.command}`
      : `${toolName}: ${JSON.stringify(params).slice(0, 200)}`;

    const choice = await this.approvalCallback(toolName, detail);

    switch (choice) {
      case 'allow_once':
        this.sessionAllowed.add(toolName);
        return true;
      case 'allow_always':
        this.store.setLevel(toolName, 'allow');
        return true;
      case 'deny_once':
        return false;
      case 'deny_always':
        this.store.setLevel(toolName, 'deny');
        return false;
    }
  }
}
