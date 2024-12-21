import { StreamProgress, ProgressCallback, StreamingOptions } from '../types';

export class StreamProgressTracker {
  private tokensGenerated: number = 0;
  private startTime: number = Date.now();
  private lastUpdateTime: number = Date.now();
  private tokenRate: number = 0;
  private readonly options: StreamingOptions;
  private readonly callback: ProgressCallback;
  private readonly alpha: number = 0.3; // EMA smoothing factor

  constructor(options: StreamingOptions) {
    this.options = options;
    this.callback = options.onProgress || (() => {});
  }

  private updateTokenRate(newTokens: number) {
    const now = Date.now();
    const timeDiff = now - this.lastUpdateTime;
    
    if (timeDiff > 0) {
      // Calculate instantaneous rate
      const instantRate = newTokens / timeDiff;
      
      // Apply exponential moving average for smoother rate
      if (this.tokenRate === 0) {
        this.tokenRate = instantRate;
      } else {
        this.tokenRate = (this.alpha * instantRate) + ((1 - this.alpha) * this.tokenRate);
      }
      
      this.lastUpdateTime = now;
    }
  }

  private estimateTimeRemaining(): number | undefined {
    if (!this.options.estimateTimeRemaining || this.tokenRate === 0) {
      return undefined;
    }

    // Use dynamic estimation based on current progress
    const progressRatio = this.tokensGenerated / Math.max(100, this.tokensGenerated * 2);
    const estimatedTotalTokens = Math.max(
      this.tokensGenerated * (1 + (1 - progressRatio)),
      this.tokensGenerated + 100
    );
    
    const remainingTokens = estimatedTotalTokens - this.tokensGenerated;
    const estimatedMs = remainingTokens / this.tokenRate;
    
    // Return undefined if estimate is unreasonable
    return estimatedMs > 0 && estimatedMs < 3600000 ? estimatedMs : undefined;
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