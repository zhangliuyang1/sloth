import type { LLMProvider, ProviderConfig } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatProvider } from './openai-compat.js';
import { glmPreset } from './presets/glm.js';
import { deepseekPreset } from './presets/deepseek.js';
import { qwenPreset } from './presets/qwen.js';
import { doubaoPreset } from './presets/doubao.js';
import { mimoPreset } from './presets/mimo.js';

export type { LLMProvider, ProviderConfig, Message, ContentBlock, StreamEvent, ChatParams, ToolDef } from './types.js';
export { AnthropicProvider } from './anthropic.js';
export { OpenAICompatProvider } from './openai-compat.js';

export const PRESETS: Record<string, ProviderConfig> = {
  deepseek: deepseekPreset,
  qwen: qwenPreset,
  glm: glmPreset,
  doubao: doubaoPreset,
  mimo: mimoPreset,
  anthropic: { type: 'anthropic', model: 'claude-sonnet-4-20250514' },
  openai: { type: 'openai-compat', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o' },
};

export function isPreset(name: string): boolean {
  return name in PRESETS;
}

export function createProvider(presetName: string, apiKey: string, modelOverride?: string, resolvedConfig?: ProviderConfig): LLMProvider {
  const preset = resolvedConfig ?? PRESETS[presetName];
  if (!preset) throw new Error(`Unknown provider: ${presetName}. Available: ${Object.keys(PRESETS).join(', ')}`);

  const model = modelOverride || preset.model;

  if (preset.type === 'anthropic') {
    return new AnthropicProvider({ apiKey, model, baseURL: preset.baseURL, thinkingEffort: preset.thinkingEffort });
  }

  return new OpenAICompatProvider({
    apiKey,
    baseURL: preset.baseURL!,
    model,
    name: presetName,
    thinkingEffort: preset.thinkingEffort,
  });
}
