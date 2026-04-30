import type { ProviderConfig } from '../types.js';

export const qwenPreset: ProviderConfig = {
  type: 'openai-compat',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen3.6-plus',
};
