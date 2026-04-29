import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface ToolSpinnerProps {
  name: string;
}

export const ToolSpinner: React.FC<ToolSpinnerProps> = ({ name }) => (
  <Box>
    <Text color="yellow"><Spinner type="dots" /></Text>
    <Text color="yellow"> {name}...</Text>
  </Box>
);
