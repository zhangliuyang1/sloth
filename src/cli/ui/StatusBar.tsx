import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  provider: string;
  model: string;
  tokens: { input: number; output: number };
  cost: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({ provider, model, tokens, cost }) => (
  <Box borderStyle="single" borderColor="gray" paddingX={1}>
    <Text color="green" bold>{provider}</Text>
    <Text color="gray"> | </Text>
    <Text color="cyan">{model}</Text>
    <Text color="gray"> | </Text>
    <Text color="yellow">in:{tokens.input}</Text>
    <Text color="gray">/</Text>
    <Text color="yellow">out:{tokens.output}</Text>
    <Text color="gray"> | </Text>
    <Text color="magenta">${cost.toFixed(4)}</Text>
  </Box>
);
