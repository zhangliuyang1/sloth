import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import type { ProviderConfig } from '../providers/types.js';
import { PRESETS } from '../providers/index.js';

dotenv.config();

export interface ProviderEntry {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  type?: 'anthropic' | 'openai-compat';
  thinkingEffort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
}

export interface SlothConfig {
  provider: string;
  model?: string;
  thinkingEffort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  providers: Record<string, ProviderEntry>;
}

const DEFAULT_CONFIG: SlothConfig = {
  provider: 'glm',
  providers: {},
};

export async function ensureExampleConfig(): Promise<void> {
  const dir = path.join(os.homedir(), '.sloth');
  const examplePath = path.join(dir, 'configEx.json');
  try {
    await fs.access(examplePath);
    return; // already exists
  } catch {
    // copy from bundled example
    const require = createRequire(import.meta.url);
    const bundled = path.join(path.dirname(require.resolve('../../package.json')), 'configEx.json');
    let content: string;
    try {
      content = await fs.readFile(bundled, 'utf-8');
    } catch {
      content = JSON.stringify(DEFAULT_CONFIG, null, 2);
    }
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(examplePath, content, 'utf-8');
  }
}

export async function loadConfig(configPath?: string): Promise<SlothConfig> {
  await ensureExampleConfig();
  const filePath = configPath ?? path.join(os.homedir(), '.sloth', 'config.json');
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: SlothConfig): Promise<void> {
  const dir = path.join(os.homedir(), '.sloth');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, 'config.json');
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
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

export function resolveProviderConfig(name: string, config: SlothConfig): ProviderConfig {
  const preset = PRESETS[name];
  const custom = config.providers[name];

  if (!preset && !custom?.type) {
    const available = [...Object.keys(PRESETS), ...Object.keys(config.providers).filter(k => config.providers[k].type)];
    throw new Error(`Unknown provider: ${name}. Available: ${available.join(', ')}`);
  }

  const base: ProviderConfig = preset ?? { type: custom!.type!, model: '' };

  return {
    ...base,
    model: custom?.model ?? base.model,
    baseURL: custom?.baseURL ?? base.baseURL,
    apiKey: custom?.apiKey,
    thinkingEffort: custom?.thinkingEffort ?? config.thinkingEffort,
    maxTokens: custom?.maxTokens ?? config.maxTokens,
  };
}

export function getAllProviderNames(config: SlothConfig): string[] {
  const presetNames = Object.keys(PRESETS);
  const customNames = Object.keys(config.providers).filter(k => config.providers[k].type);
  return [...new Set([...presetNames, ...customNames])];
}
