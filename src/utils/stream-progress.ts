import { StreamProgress, ProgressCallback, StreamingOptions } from '../types';

export class StreamProgressTracker {
  private tokensGenerated: number = 0;
  private startTime: number = Date.now();
  private lastUpdateTime: number = Date.now();
  private tokenRate: number = 0;
  private readonly options: StreamingOptions;
  private readonly callback: ProgressCallback;

  constructor(options: StreamingOptions) {
    this.options = options;
    this.callback = options.onProgress || (() => {});
  }

  private updateTokenRate(newTokens: number) {
    const now = Date.now();
    const timeDiff = now - this.lastUpdateTime;
    if (timeDiff > 0) {
      // Calculate tokens per millisecond
      this.tokenRate = (this.tokenRate + (newTokens / timeDiff)) / 2;
      this.lastUpdateTime = now;
    }
  }

  private estimateTimeRemaining(): number | undefined {
    if (!this.options.estimateTimeRemaining || this.tokenRate === 0) {
      return undefined;
    }

    // Estimate based on typical completion length and current rate
    const estimatedTotalTokens = Math.max(500, this.tokensGenerated * 1.5);
    const remainingTokens = estimatedTotalTokens - this.tokensGenerated;
    return (remainingTokens / this.tokenRate);
  }

  public onChunk(chunk: string) {
    // Rough token count estimation (can be replaced with more accurate counting)
    const estimatedTokens = Math.ceil(chunk.length / 4);
    this.tokensGenerated += estimatedTokens;

    if (this.options.enableTokenCounting) {
      this.updateTokenRate(estimatedTokens);
    }

    const progress: StreamProgress = {
      type: 'chunk',
      chunk,
      ...(this.options.enableTokenCounting && {
        tokensGenerated: this.tokensGenerated,
      }),
      ...(this.options.estimateTimeRemaining && {
        estimatedTimeRemaining: this.estimateTimeRemaining(),
      }),
    };

    this.callback(progress);
  }

  public onToken(token: string) {
    this.tokensGenerated += 1;

    if (this.options.enableTokenCounting) {
      this.updateTokenRate(1);
    }

    const progress: StreamProgress = {
      type: 'token',
      chunk: token,
      ...(this.options.enableTokenCounting && {
        tokensGenerated: this.tokensGenerated,
      }),
      ...(this.options.estimateTimeRemaining && {
        estimatedTimeRemaining: this.estimateTimeRemaining(),
      }),
    };

    this.callback(progress);
  }

  public onComplete() {
    const progress: StreamProgress = {
      type: 'complete',
      ...(this.options.enableTokenCounting && {
        tokensGenerated: this.tokensGenerated,
        totalTokens: this.tokensGenerated,
      }),
    };

    this.callback(progress);
  }
} 