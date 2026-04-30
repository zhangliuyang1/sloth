import type { ProviderConfig } from '../types.js';

export const glmPreset: ProviderConfig = {
  type: 'anthropic',
  baseURL: 'https://open.bigmodel.cn/api/anthropic',
  model: 'glm-5.1',
};
