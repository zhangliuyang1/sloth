import React, { useMemo } from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import markedTerminal from 'marked-terminal';

let markedInitialized = false;

function ensureMarked(): void {
  if (!markedInitialized) {
    marked.use(markedTerminal());
    markedInitialized = true;
  }
}

interface StreamingTextProps {
  chunks: string[];
}

export const StreamingText: React.FC<StreamingTextProps> = ({ chunks }) => {
  const fullText = useMemo(() => chunks.join(''), [chunks]);
  const rendered = useMemo(() => renderMarkdown(fullText), [fullText]);
  return <Text>{rendered}</Text>;
};

export function renderMarkdown(text: string): string {
  ensureMarked();
  try {
    return marked.parse(text) as string;
  } catch {
    return text;
  }
}
