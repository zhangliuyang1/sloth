import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { MessageList } from './MessageList.js';
import { InputArea } from './InputArea.js';
import { StatusBar } from './StatusBar.js';
import { ToolSpinner } from './ToolSpinner.js';
import { ToolApproval } from './ToolApproval.js';
import { ConfigPanel } from './ConfigPanel.js';
import { parseInput } from '../../commands/parser.js';
import { getHelpText } from '../../commands/builtins.js';
import { calculateCost, type UsageStats } from '../../core/pricing.js';
import type { PermissionChoice } from '../../permissions/types.js';
import type { Engine } from '../../core/engine.js';
import type { SlothConfig } from '../../core/config.js';
import { resolveApiKey, resolveProviderConfig, getAllProviderNames } from '../../core/config.js';
import { createProvider, PRESETS, isPreset } from '../../providers/index.js';

interface AppProps {
  engine: Engine;
  providerName: string;
  modelName: string;
  initialConfig: SlothConfig;
}

interface UIMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export const App: React.FC<AppProps> = ({ engine, providerName, modelName, initialConfig }) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats>({ inputTokens: 0, outputTokens: 0, cost: 0 });
  const [config, setConfig] = useState<SlothConfig>(initialConfig);
  const [activeProviderName, setActiveProviderName] = useState(providerName);
  const [activeModelName, setActiveModelName] = useState(modelName);
  const [showConfig, setShowConfig] = useState(false);

  const [pendingApproval, setPendingApproval] = useState<{
    toolName: string;
    detail: string;
    resolve: (choice: PermissionChoice) => void;
  } | null>(null);

  React.useEffect(() => {
    engine.onText((text) => {
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
          updated[updated.length - 1] = { ...updated[updated.length - 1], text: updated[updated.length - 1].text + text };
        } else {
          updated.push({ role: 'assistant', text });
        }
        return updated;
      });
    });

    engine.onToolCall((name, status) => {
      if (status === 'start') setCurrentTool(name);
      else setCurrentTool(null);
    });

    engine.onUsage((stats) => {
      const cost = calculateCost(activeModelName, stats.inputTokens, stats.outputTokens);
      setUsage({ ...stats, cost });
    });
  }, [engine, activeModelName]);

  const handleApprovalChoice = useCallback((choice: PermissionChoice) => {
    if (pendingApproval) {
      pendingApproval.resolve(choice);
      setPendingApproval(null);
    }
  }, [pendingApproval]);

  const switchModel = useCallback(async (name: string, modelOverride?: string) => {
    try {
      const resolved = resolveProviderConfig(name, config);
      const apiKey = resolveApiKey(config, name);
      const model = modelOverride ?? resolved.model;
      const provider = createProvider(name, apiKey, model, { ...resolved, model });

      engine.switchProvider(provider);
      setActiveProviderName(name);
      setActiveModelName(model);
      setMessages(prev => [...prev, { role: 'system', text: `已切换到: ${name} / ${model}` }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { role: 'system', text: `切换失败: ${msg}` }]);
    }
  }, [config, engine]);

  const handleSubmit = useCallback(async (input: string) => {
    const parsed = parseInput(input);

    if (parsed.type === 'command') {
      const { name, args } = parsed;

      switch (name) {
        case 'exit':
        case 'quit':
          exit();
          return;

        case 'help':
          setMessages(prev => [...prev, { role: 'system', text: getHelpText() }]);
          return;

        case 'clear':
          engine.clearConversation();
          setMessages([{ role: 'system', text: '对话已清空' }]);
          return;

        case 'compact': {
          setMessages(prev => [...prev, { role: 'system', text: '正在压缩对话历史...' }]);
          setIsRunning(true);
          try {
            await engine.query('请用简洁的中文总结我们之前的对话内容，保留关键信息和上下文。');
          } catch { /* ignore */ }
          setIsRunning(false);
          return;
        }

        case 'config': {
          setShowConfig(true);
          return;
        }

        case 'model': {
          if (!args) {
            const lines = [`当前: ${activeProviderName} / ${activeModelName}`, '', '可用 Provider:'];
            for (const name of getAllProviderNames(config)) {
              const preset = PRESETS[name];
              const custom = config.providers[name];
              const tag = isPreset(name) ? '内置' : '自定义';
              const model = custom?.model ?? preset?.model ?? '';
              const baseURL = custom?.baseURL ?? preset?.baseURL ?? '(默认)';
              const type = custom?.type ?? preset?.type ?? '';
              const active = name === activeProviderName ? ' <-- 当前' : '';
              lines.push(`  ${name} ${active}`);
              lines.push(`    类型: ${type} [${tag}]`);
              if (baseURL !== '(默认)' || !isPreset(name)) lines.push(`    URL: ${baseURL}`);
              lines.push(`    模型: ${model}`);
              if (custom?.thinkingEffort) lines.push(`    thinking: ${custom.thinkingEffort}`);
            }
            lines.push('', '用法: /model <provider> [model]');
            lines.push('配置: /config');
            setMessages(prev => [...prev, { role: 'system', text: lines.join('\n') }]);
            return;
          }
          const parts = args.trim().split(/\s+/);
          await switchModel(parts[0], parts[1]);
          return;
        }

        case 'cost': {
          const stats = engine.getUsageStats();
          const cost = calculateCost(activeModelName, stats.inputTokens, stats.outputTokens);
          setMessages(prev => [...prev, {
            role: 'system',
            text: `Token 使用统计:\n  输入: ${stats.inputTokens.toLocaleString()} tokens\n  输出: ${stats.outputTokens.toLocaleString()} tokens\n  费用: $${cost.toFixed(4)}`,
          }]);
          return;
        }

        default:
          setMessages(prev => [...prev, { role: 'system', text: `未知命令: /${name}\n输入 /help 查看可用命令` }]);
          return;
      }
    }

    setMessages(prev => [...prev, { role: 'user', text: parsed.content }]);
    setIsRunning(true);

    try {
      await engine.query(parsed.content);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { role: 'assistant', text: `[Error] ${msg}` }]);
    }

    setIsRunning(false);
  }, [engine, exit, activeProviderName, activeModelName, config, switchModel]);

  useInput((_input, key) => {
    if (key.ctrl && _input === 'c') exit();
  });

  const handleConfigSaved = useCallback((updated: SlothConfig) => {
    setConfig(updated);
  }, []);

  const handleConfigClose = useCallback(() => {
    setShowConfig(false);
  }, []);

  // Config mode — ConfigPanel handles its own input via useInput
  if (showConfig) {
    return (
      <ConfigPanel
        config={config}
        onConfigSaved={handleConfigSaved}
        onClose={handleConfigClose}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="green" bold>Sloth</Text>
        <Text color="gray"> - AI Programming Assistant</Text>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        <MessageList messages={messages} />
        {currentTool && <ToolSpinner name={currentTool} />}
      </Box>

      {pendingApproval && (
        <ToolApproval
          toolName={pendingApproval.toolName}
          detail={pendingApproval.detail}
          onChoice={handleApprovalChoice}
        />
      )}

      <StatusBar provider={activeProviderName} model={activeModelName} tokens={{ input: usage.inputTokens, output: usage.outputTokens }} cost={usage.cost} />
      {!pendingApproval && <InputArea onSubmit={handleSubmit} isRunning={isRunning} />}
    </Box>
  );
};

export function createApprovalCallback(
  setPendingApproval: React.Dispatch<React.SetStateAction<{
    toolName: string;
    detail: string;
    resolve: (choice: PermissionChoice) => void;
  } | null>>
): (toolName: string, detail: string) => Promise<PermissionChoice> {
  return (toolName: string, detail: string) => {
    return new Promise<PermissionChoice>((resolve) => {
      setPendingApproval({ toolName, detail, resolve });
    });
  };
}
