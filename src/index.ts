#!/usr/bin/env node
import { startREPL } from './cli/repl.js';
import { loadConfig, resolveApiKey } from './core/config.js';
import { createProvider } from './providers/index.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let providerName: string | undefined;
  let modelOverride: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--provider' || args[i] === '-p') && args[i + 1]) {
      providerName = args[++i];
    } else if ((args[i] === '--model' || args[i] === '-m') && args[i + 1]) {
      modelOverride = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage: sloth [options]

Options:
  --provider, -p <name>   Provider to use (glm, deepseek, qwen, doubao, mimo, anthropic, openai)
  --model, -m <model>     Model name override
  --help, -h              Show this help

Config: ~/.sloth/config.json
Env vars: GLM_API_KEY, DEEPSEEK_API_KEY, QWEN_API_KEY, etc.`);
      process.exit(0);
    }
  }

  const config = await loadConfig();
  const resolved = providerName ?? config.provider;

  try {
    const apiKey = resolveApiKey(config, resolved);
    const provider = createProvider(resolved, apiKey, modelOverride ?? config.providers[resolved]?.model);

    console.log(`Sloth - AI Programming Assistant`);
    console.log(`Provider: ${resolved} | Model: ${provider.model}`);
    console.log('');

    startREPL({
      cwd: process.cwd(),
      provider,
      providerName: resolved,
      modelName: provider.model,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}

main().catch(console.error);
