import React from 'react';
import { Box, Text } from 'ink';
import { renderMarkdown } from './StreamingText.js';

interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => (
  <Box flexDirection="column">
    {messages.map((msg, i) => (
      <Box key={i} flexDirection="column" marginBottom={1}>
        {msg.role === 'user' && (
          <>
            <Text color="cyan" bold>{'> You'}</Text>
            <Text>{msg.text}</Text>
          </>
        )}
        {msg.role === 'assistant' && (
          <>
            <Text color="green" bold>{'> Sloth'}</Text>
            <Text>{renderMarkdown(msg.text)}</Text>
          </>
        )}
        {msg.role === 'system' && (
          <Box borderStyle="round" borderColor="yellow" paddingX={1}>
            <Text color="yellow">{msg.text}</Text>
          </Box>
        )}
      </Box>
    ))}
  </Box>
);
