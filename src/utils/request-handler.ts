import { AIRequestError, RequestHandlingOptions, RetryOptions, RateLimitOptions, ConcurrencyOptions } from '../types';
import PQueue from 'p-queue';

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
};

const DEFAULT_RATE_LIMIT_OPTIONS: RateLimitOptions = {
  requestsPerMinute: 60,
  burstLimit: 5,
  timeoutMs: 60000,
};

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly refillRate: number;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;

  constructor(options: RateLimitOptions) {
    this.tokens = options.burstLimit || options.requestsPerMinute;
    this.lastRefill = Date.now();
    this.refillRate = options.requestsPerMinute / 60000; // tokens per millisecond
    this.maxTokens = options.burstLimit || options.requestsPerMinute;
    this.timeoutMs = options.timeoutMs || 60000;
  }

  async acquire(): Promise<void> {
    const startTime = Date.now();
    
    while (true) {
      this.refillTokens();
      
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      if (Date.now() - startTime >= this.timeoutMs) {
        throw new AIRequestError('Rate limit timeout exceeded', undefined, true);
      }

      const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 1000)));
    }
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const newTokens = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}

export class RequestHandler {
  private rateLimiter: RateLimiter;
  private retryOptions: RetryOptions;
  private timeout: number;
  private queue: PQueue;

  constructor(options: RequestHandlingOptions = {}) {
    this.rateLimiter = new RateLimiter(options.rateLimit || DEFAULT_RATE_LIMIT_OPTIONS);
    this.retryOptions = options.retry || DEFAULT_RETRY_OPTIONS;
    this.timeout = options.timeout || 120000;
    
    // Initialize queue with concurrency options
    const queueOptions: PQueue.Options = {
      concurrency: options.concurrency?.concurrency || 1,
      autoStart: options.concurrency?.autoStart ?? true,
      carryoverConcurrencyCount: options.concurrency?.carryoverConcurrencyCount ?? true,
    };

    // Only add interval-related options if they are specified
    if (options.concurrency?.intervalCap !== undefined) {
      queueOptions.intervalCap = options.concurrency.intervalCap;
      queueOptions.interval = options.concurrency?.interval || 1000;
    }

    this.queue = new PQueue(queueOptions);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Wrap the operation in a queue task
    return this.queue.add(async () => {
      let lastError: Error | undefined;
      let delay = this.retryOptions.initialDelay;

      for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
        try {
          await this.rateLimiter.acquire();
          
          const timeoutPromise = new Promise<never>((_, reject) => {
            const timeoutId = setTimeout(() => {
              clearTimeout(timeoutId);
              reject(new AIRequestError(`Request timed out after ${this.timeout}ms`, undefined, true));
            }, this.timeout);
          });

          const operationPromise = operation();
          const result = await Promise.race([operationPromise, timeoutPromise]) as T;

          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (error instanceof AIRequestError && !error.retryable) {
            throw error;
          }

          if (attempt === this.retryOptions.maxRetries) {
            throw new AIRequestError(
              `Failed after ${attempt + 1} attempts: ${lastError.message}`,
              lastError,
              false
            );
          }

          // Wait for the delay before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * this.retryOptions.backoffFactor, this.retryOptions.maxDelay);
        }
      }

      throw lastError;
    });
  }

  // Add method to get queue size and pending count
  getQueueStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused,
    };
  }
}

export const createRequestHandler = (options?: RequestHandlingOptions) => new RequestHandler(options); 