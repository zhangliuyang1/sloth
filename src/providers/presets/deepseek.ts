import type { ProviderConfig } from '../types.js';

export const deepseekPreset: ProviderConfig = {
  type: 'openai-compat',
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-v4-pro',
};
