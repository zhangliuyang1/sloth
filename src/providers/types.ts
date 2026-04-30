// Unified types for all LLM providers

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; output: string; is_error?: boolean };

export interface Message {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

export type StreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; args_delta: string }
  | { type: 'tool_call_end'; id: string; name: string; args: string }
  | { type: 'thinking_delta'; text: string }
  | { type: 'usage'; input_tokens: number; output_tokens: number }
  | { type: 'done'; stop_reason: string };

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatParams {
  messages: Message[];
  system: string;
  tools: ToolDef[];
  maxTokens: number;
  temperature?: number;
  thinkingEffort?: 'low' | 'medium' | 'high';
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  chat(params: ChatParams): AsyncIterable<StreamEvent>;
  countTokens(text: string): Promise<number>;
}

export interface ProviderConfig {
  type: 'anthropic' | 'openai-compat';
  apiKey?: string;
  baseURL?: string;
  model: string;
  thinkingEffort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
}
