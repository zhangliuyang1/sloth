#!/usr/bin/env node
import { startREPL } from './cli/repl.js';
import { loadConfig, resolveApiKey } from './core/config.js';
import { createProvider } from './providers/index.js';
import { createDefaultToolRegistry } from './tools/index.js';
import { PermissionManager } from './permissions/manager.js';
import { PermissionStore } from './permissions/store.js';
import { Engine } from './core/engine.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let providerName: string | undefined;
  let modelOverride: string | undefined;
  let prompt: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--provider' || args[i] === '-p') && args[i + 1]) {
      providerName = args[++i];
    } else if ((args[i] === '--model' || args[i] === '-m') && args[i + 1]) {
      modelOverride = args[++i];
    } else if (args[i] === '--prompt' && args[i + 1]) {
      prompt = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage: sloth [options]

Options:
  --provider, -p <name>   Provider (glm, deepseek, qwen, doubao, mimo, anthropic, openai)
  --model, -m <model>     Model name override
  --prompt <text>         Run a single prompt and exit (non-interactive)
  --version, -v           Show version
  --help, -h              Show this help`);
      process.exit(0);
    } else if (args[i] === '--version' || args[i] === '-v') {
      const pkg = await import('../package.json', { assert: { type: 'json' } });
      console.log(`sloth-cc v${pkg.default.version}`);
      process.exit(0);
    }
  }

  const config = await loadConfig();
  const resolved = providerName ?? config.provider;

  try {
    const apiKey = resolveApiKey(config, resolved);
    const provider = createProvider(resolved, apiKey, modelOverride ?? config.providers[resolved]?.model);

    // Non-interactive mode: run single prompt and exit
    if (prompt) {
      const toolRegistry = createDefaultToolRegistry();
      const permissionManager = new PermissionManager(new PermissionStore());
      const engine = new Engine({ cwd: process.cwd(), provider, toolRegistry, permissionManager });

      engine.onText((text) => process.stdout.write(text));

      const result = await engine.query(prompt);
      process.stdout.write('\n');
      if (result.toolCalls.length > 0) {
        console.log(`\n[Tool calls: ${result.toolCalls.map(t => t.name).join(', ')}]`);
      }
      return;
    }

    // Interactive mode
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
