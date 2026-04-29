import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface InputAreaProps {
  onSubmit: (value: string) => void;
  isRunning: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSubmit, isRunning }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (value: string) => {
    if (value.trim() && !isRunning) {
      onSubmit(value.trim());
      setInput('');
    }
  };

  return (
    <Box>
      <Text color="green" bold>{'>'} </Text>
      <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} placeholder={isRunning ? '等待响应...' : '输入消息...'} />
    </Box>
  );
};
