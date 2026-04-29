import React from 'react';
import { Box, Text } from 'ink';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => (
  <Box flexDirection="column">
    {messages.map((msg, i) => (
      <Box key={i} flexDirection="column" marginBottom={1}>
        <Text color={msg.role === 'user' ? 'cyan' : 'green'} bold>
          {msg.role === 'user' ? '> You' : '> Sloth'}
        </Text>
        <Text>{msg.text}</Text>
      </Box>
    ))}
  </Box>
);
