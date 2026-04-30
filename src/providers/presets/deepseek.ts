import type { ProviderConfig } from '../types.js';

export const deepseekPreset: ProviderConfig = {
  type: 'anthropic',
  baseURL: 'https://api.deepseek.com/anthropic',
  model: 'deepseek-v4-pro',
};
