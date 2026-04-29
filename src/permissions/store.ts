import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { PermissionLevel } from './types.js';

export class PermissionStore {
  private filePath: string;
  private data: Record<string, PermissionLevel> = {};
  private loaded = false;

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(os.homedir(), '.sloth', 'settings.json');
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content);
      this.data = parsed.permissions ?? {};
    } catch {
      this.data = {};
    }
    this.loaded = true;
  }

  private async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify({ permissions: this.data }, null, 2), 'utf-8');
  }

  getLevel(tool: string): PermissionLevel | undefined {
    return this.data[tool];
  }

  async setLevel(tool: string, level: PermissionLevel): Promise<void> {
    await this.load();
    this.data[tool] = level;
    await this.save();
  }
}
