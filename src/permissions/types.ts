export type PermissionLevel = 'allow' | 'ask' | 'confirm' | 'deny';

export type PermissionChoice = 'allow_once' | 'allow_always' | 'deny_once' | 'deny_always';

export interface PermissionEntry {
  tool: string;
  level: PermissionLevel;
}
