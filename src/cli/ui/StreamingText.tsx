import React, { useMemo } from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import markedTerminal from 'marked-terminal';

marked.use(markedTerminal());

interface StreamingTextProps {
  chunks: string[];
}

export const StreamingText: React.FC<StreamingTextProps> = ({ chunks }) => {
  const fullText = useMemo(() => chunks.join(''), [chunks]);
  const rendered = useMemo(() => {
    try {
      return marked.parse(fullText) as string;
    } catch {
      return fullText;
    }
  }, [fullText]);
  return <Text>{rendered}</Text>;
};

export function renderMarkdown(text: string): string {
  try {
    return marked.parse(text) as string;
  } catch {
    return text;
  }
}
