import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { PermissionChoice } from '../../permissions/types.js';

interface ToolApprovalProps {
  toolName: string;
  detail: string;
  onChoice: (choice: PermissionChoice) => void;
}

export const ToolApproval: React.FC<ToolApprovalProps> = ({ toolName, detail, onChoice }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (value: string) => {
    const v = value.toLowerCase().trim();
    switch (v) {
      case 'y': onChoice('allow_once'); break;
      case 'a': onChoice('allow_always'); break;
      case 'n': onChoice('deny_once'); break;
      case 'd': onChoice('deny_always'); break;
      default: onChoice('deny_once');
    }
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Box>
        <Text color="yellow" bold>{toolName}</Text>
        <Text>: {detail.slice(0, 200)}</Text>
      </Box>
      <Box>
        <Text color="gray">[Y]允许 [A]始终允许 [N]拒绝 [D]始终拒绝 </Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
};
