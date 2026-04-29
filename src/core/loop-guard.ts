export interface LoopGuardConfig {
  maxToolRounds: number;
  maxConsecutiveErrors: number;
  stuckDetectionWindow: number;
}

const DEFAULT_CONFIG: LoopGuardConfig = {
  maxToolRounds: 50,
  maxConsecutiveErrors: 3,
  stuckDetectionWindow: 5,
};

export class LoopGuard {
  private config: LoopGuardConfig;
  private toolRoundCount = 0;
  private consecutiveErrors = 0;
  private recentToolCalls: string[] = [];

  constructor(config?: Partial<LoopGuardConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  shouldContinue(): { ok: boolean; reason?: string } {
    if (this.toolRoundCount >= this.config.maxToolRounds) {
      return { ok: false, reason: `已达到最大工具调用轮数 (${this.config.maxToolRounds})` };
    }
    if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      return { ok: false, reason: `连续 ${this.config.maxConsecutiveErrors} 次工具调用失败` };
    }
    if (this.detectStuck()) {
      return { ok: false, reason: '检测到循环：最近几轮工具调用完全相同' };
    }
    return { ok: true };
  }

  recordToolCall(name: string, args: string, success: boolean): void {
    this.toolRoundCount++;
    if (success) this.consecutiveErrors = 0;
    else this.consecutiveErrors++;

    const fingerprint = `${name}:${this.simpleHash(args)}`;
    this.recentToolCalls.push(fingerprint);
    if (this.recentToolCalls.length > this.config.stuckDetectionWindow) {
      this.recentToolCalls.shift();
    }
  }

  reset(): void {
    this.toolRoundCount = 0;
    this.consecutiveErrors = 0;
    this.recentToolCalls = [];
  }

  private detectStuck(): boolean {
    if (this.recentToolCalls.length < 3) return false;
    const n = this.recentToolCalls.length;
    return this.recentToolCalls[n - 1] === this.recentToolCalls[n - 2] &&
           this.recentToolCalls[n - 2] === this.recentToolCalls[n - 3];
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }
}
