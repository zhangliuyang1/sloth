import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const INSTRUCTION_FILES = ['.sloth/SLOTH.md', 'SLOTH.md', '.sloth/SLOTH.local.md', 'SLOTH.local.md'];

export function loadProjectInstructions(cwd: string): string {
  const parts: string[] = [];

  for (const file of INSTRUCTION_FILES) {
    const filePath = join(cwd, file);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8').trim();
        if (content) {
          parts.push(`# ${file}\n${content}`);
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  return parts.join('\n\n');
}

export function findProjectRoot(cwd: string): string {
  let dir = cwd;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}
