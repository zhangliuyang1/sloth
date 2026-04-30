interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
  // GLM
  'glm-5.1': { inputPerMillion: 50, outputPerMillion: 50 },
  'glm-5': { inputPerMillion: 50, outputPerMillion: 50 },
  'glm-4-plus': { inputPerMillion: 50, outputPerMillion: 50 },
  'glm-4-flash': { inputPerMillion: 0.1, outputPerMillion: 0.1 },
  'glm-4': { inputPerMillion: 100, outputPerMillion: 100 },
  'glm-4-long': { inputPerMillion: 1, outputPerMillion: 1 },
  // DeepSeek
  'deepseek-v4-pro': { inputPerMillion: 1.74, outputPerMillion: 3.48 },
  'deepseek-v4-flash': { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  'deepseek-chat': { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  'deepseek-reasoner': { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  // Qwen
  'qwen3.6-plus': { inputPerMillion: 0.8, outputPerMillion: 2 },
  'qwen3-max': { inputPerMillion: 20, outputPerMillion: 60 },
  'qwen3.5-plus': { inputPerMillion: 0.8, outputPerMillion: 2 },
  'qwen-max': { inputPerMillion: 20, outputPerMillion: 60 },
  'qwen-plus': { inputPerMillion: 0.8, outputPerMillion: 2 },
  'qwen-turbo': { inputPerMillion: 0.3, outputPerMillion: 0.6 },
  // Doubao
  'doubao-seed-2-0-pro-260215': { inputPerMillion: 4, outputPerMillion: 8 },
  'doubao-seed-2-0-lite-260215': { inputPerMillion: 0.8, outputPerMillion: 2 },
  'doubao-seed-code': { inputPerMillion: 0.8, outputPerMillion: 2 },
  'doubao-pro-32k': { inputPerMillion: 0.8, outputPerMillion: 2 },
  'doubao-pro-128k': { inputPerMillion: 5, outputPerMillion: 9 },
  // MiMo
  'mimo-v2.5-pro': { inputPerMillion: 2, outputPerMillion: 6 },
  'mimo-v2-pro': { inputPerMillion: 1, outputPerMillion: 3 },
  'mimo-v2-flash': { inputPerMillion: 0.5, outputPerMillion: 1 },
  // Anthropic
  'claude-opus-4-7': { inputPerMillion: 15, outputPerMillion: 75 },
  'claude-sonnet-4-6': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-sonnet-4-20250514': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-haiku-4-5-20251001': { inputPerMillion: 0.8, outputPerMillion: 4 },
  // OpenAI
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'o1': { inputPerMillion: 15, outputPerMillion: 60 },
  'o3-mini': { inputPerMillion: 1.1, outputPerMillion: 4.4 },
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}
