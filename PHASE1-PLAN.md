# Sloth Phase 1 Implementation Plan

## Context

Build a CLI programming assistant ("sloth") from scratch, similar to Claude Code. Phase 1 focuses on getting the core runnable loop working end-to-end: user types a request -> LLM reasons -> calls tools -> gets results -> responds. Default provider is GLM via OpenAI-compatible API.

## Implementation Steps

### Step 1: Project Scaffolding
Create package.json, tsconfig.json, vitest.config.ts, directory structure.

- `package.json` — deps: ink, react, openai, @anthropic-ai/sdk, chalk, fast-glob, marked, marked-terminal, zod, tiktoken, diff, ink-spinner, ink-text-input, nanoid, dotenv, vitest, tsx, typescript
- `tsconfig.json` — strict mode, ESM, outDir dist
- `vitest.config.ts` — unit + integration test config
- `.gitignore`
- `.env.example`

### Step 2: Provider Layer (src/providers/)
Foundation - without providers, nothing works.

- `src/providers/types.ts` — LLMProvider, StreamEvent, Message, ContentBlock, ChatParams, ToolDef (DETAILED-DESIGN 3.1-3.2)
- `src/providers/anthropic.ts` — Anthropic streaming adapter (section 3.3)
- `src/providers/openai-compat.ts` — OpenAI-compatible streaming adapter (section 3.4)
- `src/providers/presets/deepseek.ts`, `qwen.ts`, `glm.ts`, `doubao.ts`, `mimo.ts` — preset configs (section 3.6)
- `src/providers/index.ts` — factory + preset registry

### Step 3: Tool Layer (src/tools/)
Tools the LLM uses to interact with the world.

- `src/tools/types.ts` — ToolDefinition, ToolExecutor, ToolResult, PermissionLevel (section 2.8)
- `src/tools/registry.ts` — ToolRegistry class
- `src/tools/files/read.ts` — Read tool (section 2.2)
- `src/tools/files/write.ts` — Write tool (section 2.3)
- `src/tools/files/edit.ts` — Edit tool (section 2.4)
- `src/tools/search/grep.ts` — Grep tool (section 2.5)
- `src/tools/search/glob.ts` — Glob tool (section 2.6)
- `src/tools/bash.ts` — Bash tool + command classification (sections 2.7 + 14.3)
- `src/tools/index.ts` — register all tools

### Step 4: Permissions (src/permissions/)
Control what tools can do without confirmation.

- `src/permissions/types.ts` — PermissionLevel enum, PermissionChoice (section 14.1)
- `src/permissions/classifier.ts` — classifyBashCommand() (section 14.3)
- `src/permissions/manager.ts` — PermissionManager: check, request, remember
- `src/permissions/store.ts` — persist to ~/.sloth/settings.json (section 14.4)

### Step 5: Core Engine (src/core/)
Brain - orchestrates LLM calls, tool execution, conversation.

- `src/core/config.ts` — load ~/.sloth/config.json, merge CLI args, env vars
- `src/core/conversation.ts` — Conversation class (section 6.1)
- `src/core/system-prompt.ts` — buildSystemPrompt(ctx) (sections 1.1-1.7)
- `src/core/loop-guard.ts` — LoopGuard class (section 10.1)
- `src/core/engine.ts` — Engine with core query loop:
  1. Receive user input -> add to conversation
  2. Build system prompt + tool defs
  3. Call LLM streaming
  4. On tool_call: check permission -> execute -> inject result -> loop
  5. On text: stream to UI
  6. Loop guard check

### Step 6: Terminal UI (src/cli/)
Ink-based terminal interface.

- `src/cli/ui/App.tsx` — root component
- `src/cli/ui/MessageList.tsx` — conversation rendering
- `src/cli/ui/StreamingText.tsx` — streaming Markdown output
- `src/cli/ui/ToolSpinner.tsx` — tool execution status
- `src/cli/ui/ToolResult.tsx` — success/fail display
- `src/cli/ui/InputArea.tsx` — text input
- `src/cli/ui/ToolApproval.tsx` — Y/A/N/D dialog
- `src/cli/ui/StatusBar.tsx` — model, tokens, cost
- `src/cli/repl.tsx` — REPL: connect Engine to UI, Ctrl+C handling

### Step 7: Entry Point + Commands
- `src/index.ts` — CLI entry: parse --provider, --model, start REPL
- `src/commands/parser.ts` — /command detection (section 5.2)
- `src/commands/builtins.ts` — /help, /clear, /compact, /model, /exit (section 5.1)

### Step 8: Tests
- `tests/helpers/mock-provider.ts` — MockProvider without real API
- `tests/helpers/test-fixture.ts` — temp dir + file management
- `tests/unit/tools/edit.test.ts`, `read.test.ts` — tool tests
- `tests/unit/permissions/classifier.test.ts` — command classification
- `tests/unit/core/loop-guard.test.ts` — loop protection
- `tests/unit/providers/openai-adapter.test.ts` — message conversion
- `tests/integration/engine-loop.test.ts` — full flow with mock LLM

## Execution Order

1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

## Verification

1. `npm install` — all deps resolve
2. `npm run build` — TypeScript compiles clean
3. `npm test` — all tests pass
4. `npm run dev` — REPL starts, shows "GLM glm-5.1"
5. "读取 package.json" -> LLM calls Read -> shows content
6. "把 version 改为 0.0.2" -> LLM calls Read + Edit -> file updated
7. Ctrl+C interrupts, /exit quits
