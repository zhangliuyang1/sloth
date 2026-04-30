import type { ProviderConfig } from '../types.js';

export const deepseekPreset: ProviderConfig = {
  type: 'openai-compat',
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-v4-pro',
};
