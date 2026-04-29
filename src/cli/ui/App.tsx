import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { MessageList } from './MessageList.js';
import { InputArea } from './InputArea.js';
import { StatusBar } from './StatusBar.js';
import { ToolSpinner } from './ToolSpinner.js';
import type { Engine } from '../../core/engine.js';

interface AppProps {
  engine: Engine;
  providerName: string;
  modelName: string;
}

interface UIMessage {
  role: 'user' | 'assistant';
  text: string;
}

export const App: React.FC<AppProps> = ({ engine, providerName, modelName }) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [tokens] = useState({ input: 0, output: 0 });
  const [cost] = useState(0);

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
  }, [engine]);

  const handleSubmit = useCallback(async (input: string) => {
    if (input === '/exit' || input === '/quit') {
      exit();
      return;
    }

    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setIsRunning(true);

    try {
      await engine.query(input);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { role: 'assistant', text: `[Error] ${msg}` }]);
    }

    setIsRunning(false);
  }, [engine, exit]);

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

      <StatusBar provider={providerName} model={modelName} tokens={tokens} cost={cost} />
      <InputArea onSubmit={handleSubmit} isRunning={isRunning} />
    </Box>
  );
};
