import { describe, it, expect } from 'vitest';
import { LoopGuard } from '../../../src/core/loop-guard.js';

describe('LoopGuard', () => {
  it('should allow normal operations', () => {
    const guard = new LoopGuard({ maxToolRounds: 10, maxConsecutiveErrors: 10, stuckDetectionWindow: 10 });
    for (let i = 0; i < 9; i++) {
      guard.recordToolCall('Read', `{"n":${i}}`, true);
      expect(guard.shouldContinue()).toEqual({ ok: true });
    }
  });

  it('should stop at max rounds', () => {
    const guard = new LoopGuard({ maxToolRounds: 5, maxConsecutiveErrors: 10, stuckDetectionWindow: 10 });
    for (let i = 0; i < 5; i++) {
      guard.recordToolCall('Read', `{"n":${i}}`, true);
    }
    const result = guard.shouldContinue();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('最大');
  });

  it('should stop on consecutive errors', () => {
    const guard = new LoopGuard({ maxToolRounds: 50, maxConsecutiveErrors: 3, stuckDetectionWindow: 10 });
    for (let i = 0; i < 3; i++) {
      guard.recordToolCall('Bash', '{"command":"fail"}', false);
    }
    const result = guard.shouldContinue();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('连续');
  });

  it('should detect stuck loop', () => {
    const guard = new LoopGuard({ maxToolRounds: 50, maxConsecutiveErrors: 10, stuckDetectionWindow: 5 });
    guard.recordToolCall('Read', '{"file_path":"a.ts"}', true);
    guard.recordToolCall('Read', '{"file_path":"a.ts"}', true);
    guard.recordToolCall('Read', '{"file_path":"a.ts"}', true);
    const result = guard.shouldContinue();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('循环');
  });

  it('reset should clear state', () => {
    const guard = new LoopGuard({ maxToolRounds: 2, maxConsecutiveErrors: 1, stuckDetectionWindow: 5 });
    guard.recordToolCall('Read', '{}', true);
    guard.recordToolCall('Read', '{}', true);
    expect(guard.shouldContinue().ok).toBe(false);
    guard.reset();
    expect(guard.shouldContinue().ok).toBe(true);
  });
});
