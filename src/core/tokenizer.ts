let encoder: { encode(text: string): Uint32Array<ArrayBufferLike> | number[] } | null = null;
let loadAttempted = false;

async function loadEncoder(): Promise<typeof encoder> {
  if (encoder) return encoder;
  if (loadAttempted) return null;
  loadAttempted = true;

  try {
    const tiktoken = await import('tiktoken');
    const { encoding_for_model } = tiktoken;
    encoder = encoding_for_model('gpt-4o');
    return encoder;
  } catch {
    return null;
  }
}

export async function countTokens(text: string): Promise<number> {
  const enc = await loadEncoder();
  if (!enc) return Math.ceil(text.length / 4);
  return enc.encode(text).length;
}

export function countTokensSync(text: string): number {
  if (encoder) return Array.from(encoder.encode(text)).length;
  return Math.ceil(text.length / 4);
}
