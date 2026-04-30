import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { MessageList } from './MessageList.js';
import { InputArea } from './InputArea.js';
import { StatusBar } from './StatusBar.js';
import { ToolSpinner } from './ToolSpinner.js';
import { ToolApproval } from './ToolApproval.js';
import { parseInput } from '../../commands/parser.js';
import { getHelpText } from '../../commands/builtins.js';
import { calculateCost, type UsageStats } from '../../core/pricing.js';
import type { PermissionChoice } from '../../permissions/types.js';
import type { Engine } from '../../core/engine.js';

interface AppProps {
  engine: Engine;
  providerName: string;
  modelName: string;
  onApprovalRequest?: (toolName: string, detail: string) => Promise<PermissionChoice>;
}

interface UIMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export const App: React.FC<AppProps> = ({ engine, providerName, modelName, onApprovalRequest }) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats>({ inputTokens: 0, outputTokens: 0, cost: 0 });

  // Permission approval state
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
      if (status === 'start') {
        setCurrentTool(name);
      } else {
        setCurrentTool(null);
      }
    });

    engine.onUsage((stats) => {
      const cost = calculateCost(modelName, stats.inputTokens, stats.outputTokens);
      setUsage({ ...stats, cost });
    });
  }, [engine, modelName]);

  const handleApprovalChoice = useCallback((choice: PermissionChoice) => {
    if (pendingApproval) {
      pendingApproval.resolve(choice);
      setPendingApproval(null);
    }
  }, [pendingApproval]);

  // Wire up approval callback to permission manager
  React.useEffect(() => {
    if (onApprovalRequest) {
      // Already wired via repl.tsx
    }
  }, [onApprovalRequest]);

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

        case 'model': {
          if (!args) {
            setMessages(prev => [...prev, { role: 'system', text: `当前模型: ${modelName}` }]);
            return;
          }
          setMessages(prev => [...prev, { role: 'system', text: `切换模型功能需要在启动时通过 -m 参数指定` }]);
          return;
        }

        case 'cost': {
          const stats = engine.getUsageStats();
          const cost = calculateCost(modelName, stats.inputTokens, stats.outputTokens);
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
  }, [engine, exit, modelName]);

  useInput((_input, key) => {
    if (key.ctrl && _input === 'c') {
      exit();
    }
  });

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

      <StatusBar provider={providerName} model={modelName} tokens={{ input: usage.inputTokens, output: usage.outputTokens }} cost={usage.cost} />
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
