import React, { useMemo } from 'react';
import { Text } from 'ink';

interface StreamingTextProps {
  chunks: string[];
}

export const StreamingText: React.FC<StreamingTextProps> = ({ chunks }) => {
  const fullText = useMemo(() => chunks.join(''), [chunks]);
  return <Text>{fullText}</Text>;
};

export function renderMarkdown(text: string): string {
  return text;
}
