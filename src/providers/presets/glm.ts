import type { ProviderConfig } from '../types.js';

export const glmPreset: ProviderConfig = {
  type: 'openai-compat',
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  model: 'glm-5.1',
};
