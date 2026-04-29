import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import dotenv from 'dotenv';

// Load .env file if present
dotenv.config();

export interface SlothConfig {
  provider: string;
  model?: string;
  providers: Record<string, { apiKey?: string; model?: string; baseURL?: string }>;
}

const DEFAULT_CONFIG: SlothConfig = {
  provider: 'glm',
  providers: {},
};

export async function loadConfig(configPath?: string): Promise<SlothConfig> {
  const filePath = configPath ?? path.join(os.homedir(), '.sloth', 'config.json');
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function resolveApiKey(config: SlothConfig, providerName: string): string {
  const providerConfig = config.providers[providerName];
  if (providerConfig?.apiKey) return providerConfig.apiKey;

  const envMap: Record<string, string> = {
    glm: 'GLM_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    qwen: 'QWEN_API_KEY',
    doubao: 'DOUBAO_API_KEY',
    mimo: 'MIMO_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
  };

  const envKey = envMap[providerName];
  if (envKey && process.env[envKey]) return process.env[envKey]!;

  throw new Error(`No API key for "${providerName}". Set ${envMap[providerName] ?? 'API_KEY'} or add to ~/.sloth/config.json`);
}
