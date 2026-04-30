import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { BUILTIN_COMMANDS } from '../../commands/builtins.js';

const COMMAND_NAMES: string[] = BUILTIN_COMMANDS.map(c => c.name);

interface InputAreaProps {
  onSubmit: (value: string) => void;
  isRunning: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSubmit, isRunning }) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleChange = (value: string) => {
    setInput(value);

    if (value.startsWith('/') && !value.includes(' ')) {
      const partial = value.slice(1).toLowerCase();
      const matches = COMMAND_NAMES.filter(name => name.startsWith(partial) && name !== partial);
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  };

  const handleSubmit = (value: string) => {
    if (value.trim() && !isRunning) {
      onSubmit(value.trim());
      setInput('');
      setSuggestions([]);
    }
  };

  useInput((input, key) => {
    if (key.tab && input.startsWith('/') && !input.includes(' ')) {
      const partial = input.slice(1).toLowerCase();
      const matches = COMMAND_NAMES.filter(name => name.startsWith(partial));

      if (matches.length === 1) {
        setInput('/' + matches[0] + ' ');
        setSuggestions([]);
      } else if (matches.length > 1) {
        const currentIndex = matches.indexOf(partial);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % matches.length : 0;
        setInput('/' + matches[nextIndex]);
        setSuggestions(matches.filter(m => m !== matches[nextIndex]));
      }
    }
  });

  return (
    <Box flexDirection="column">
      {suggestions.length > 0 && (
        <Box marginBottom={1}>
          <Text color="gray">  可选: {suggestions.map(s => `/${s}`).join('  ')}</Text>
        </Box>
      )}
      <Box>
        <Text color="green" bold>{'>'} </Text>
        <TextInput value={input} onChange={handleChange} onSubmit={handleSubmit} placeholder={isRunning ? '等待响应...' : '输入消息或 / 查看命令...'} />
      </Box>
    </Box>
  );
};
