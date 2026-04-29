import type { PermissionLevel } from './types.js';

const readOnlyPatterns = [
  /^ls\b/, /^cat\b/, /^head\b/, /^tail\b/, /^find\b/, /^grep\b/, /^rg\b/,
  /^git\s+(status|log|diff|branch|remote|show|tag)\b/,
  /^npm\s+(list|view|outdated|info)\b/,
  /^node\s+--version/, /^python\s+--version/, /^python3\s+--version/,
  /^echo\b/, /^pwd\b/, /^which\b/, /^type\b/, /^whoami\b/,
  /^wc\b/, /^sort\b/, /^uniq\b/, /^du\b/, /^df\b/,
  /^env\b/, /^printenv\b/, /^uname\b/,
];

const dangerousPatterns = [
  /rm\s+-(rf|fr)\b/,
  /rm\s+-.*[rf].*f/,
  /git\s+push\s+.*--force/,
  /git\s+push\s+.*-f\b/,
  /git\s+reset\s+--hard/,
  /git\s+clean\s+-f/,
  /DROP\s+TABLE/i,
  /mkfs/,
  /dd\s+if=/,
  /chmod\s+(-R\s+)?777/,
  /:\(\)\{\s*:\|:&\s*\}/,
];

export function classifyBashCommand(command: string): PermissionLevel {
  const trimmed = command.trim();

  if (dangerousPatterns.some(p => p.test(trimmed))) return 'confirm';
  if (readOnlyPatterns.some(p => p.test(trimmed))) return 'allow';
  return 'ask';
}
