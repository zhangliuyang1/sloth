export type ParsedInput =
  | { type: 'command'; name: string; args: string }
  | { type: 'message'; content: string };

export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim();
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    return {
      type: 'command',
      name: parts[0].toLowerCase(),
      args: parts.slice(1).join(' '),
    };
  }
  return { type: 'message', content: trimmed };
}
