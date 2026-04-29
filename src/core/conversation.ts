import type { Message, ContentBlock } from '../providers/types.js';

export class Conversation {
  private messages: Message[] = [];

  addUserMessage(content: ContentBlock[]): void {
    this.messages.push({ role: 'user', content });
  }

  addAssistantMessage(content: ContentBlock[]): void {
    this.messages.push({ role: 'assistant', content });
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  replaceMessages(messages: Message[]): void {
    this.messages = messages;
  }

  getLastAssistantText(): string {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'assistant') {
        return this.messages[i].content
          .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
          .map(b => b.text)
          .join('');
      }
    }
    return '';
  }

  clear(): void {
    this.messages = [];
  }

  get length(): number {
    return this.messages.length;
  }
}
