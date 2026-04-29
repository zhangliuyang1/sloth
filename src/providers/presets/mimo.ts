import type { ProviderConfig } from '../types.js';

export const mimoPreset: ProviderConfig = {
  type: 'openai-compat',
  baseURL: 'https://api.mimo.xiaomi.com/v1',
  model: 'mimo-v2.5-pro',
};
