import React from 'react';
import { Box, Text } from 'ink';

interface ToolResultProps {
  name: string;
  success: boolean;
  summary: string;
}

export const ToolResult: React.FC<ToolResultProps> = ({ name, success, summary }) => (
  <Box marginLeft={2}>
    <Text color={success ? 'green' : 'red'}>
      {success ? 'OK' : 'FAIL'} {name}
    </Text>
    <Text color="gray"> {summary.slice(0, 100)}</Text>
  </Box>
);
