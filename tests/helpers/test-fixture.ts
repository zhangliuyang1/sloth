import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class TestFixture {
  private tmpDir = '';

  async setup(files: Record<string, string>): Promise<string> {
    this.tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sloth-test-'));
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(this.tmpDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }
    return this.tmpDir;
  }

  async readFile(relativePath: string): Promise<string> {
    return fs.readFile(path.join(this.tmpDir, relativePath), 'utf-8');
  }

  async fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.tmpDir, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  get tmpDirPath(): string {
    return this.tmpDir;
  }

  async cleanup(): Promise<void> {
    if (this.tmpDir) {
      await fs.rm(this.tmpDir, { recursive: true, force: true });
    }
  }
}
