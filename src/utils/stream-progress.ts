import { StreamProgress, ProgressCallback, StreamingOptions } from '../types';

export class StreamProgressTracker {
  private startTime: number;
  private tokenCount: number;
  private tokenRate: number;
  private lastUpdate: number;

  constructor(
    private callback: ProgressCallback,
    private options: StreamingOptions
  ) {
    this.startTime = Date.now();
    this.tokenCount = 0;
    this.tokenRate = 0;
    this.lastUpdate = this.startTime;
  }

  private updateTokenRate(newTokens: number) {
    const now = Date.now();
    const timeDiff = (now - this.lastUpdate) / 1000; // Convert to seconds
    if (timeDiff > 0) {
      this.tokenRate = newTokens / timeDiff;
      this.lastUpdate = now;
    }
  }

  private getProgress(): string {
    const elapsedTime = (Date.now() - this.startTime) / 1000; // Convert to seconds
    const progress = {
      tokens: this.tokenCount,
      tokensPerSecond: this.tokenRate,
      elapsedTime,
      ...(this.options.estimateTimeRemaining && {
        estimatedTimeRemaining: this.tokenRate > 0 ? (this.tokenCount / this.tokenRate) - elapsedTime : 0
      })
    };
    return JSON.stringify(progress);
  }

  onToken(token: string) {
    this.tokenCount++;
    if (this.options.enableTokenCounting) {
      this.updateTokenRate(1);
      this.callback(this.getProgress());
    } else {
      this.callback(token);
    }
  }

  onComplete() {
    const progress = {
      tokens: this.tokenCount,
      tokensPerSecond: this.tokenRate,
      elapsedTime: (Date.now() - this.startTime) / 1000,
      ...(this.options.estimateTimeRemaining && {
        estimatedTimeRemaining: 0
      })
    };
    this.callback(JSON.stringify(progress));
  }
} 