import { AIRequestError, RequestHandlingOptions, RetryOptions, RateLimitOptions } from '../types';

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

  constructor(options: RateLimitOptions) {
    this.tokens = options.burstLimit || options.requestsPerMinute;
    this.lastRefill = Date.now();
    this.refillRate = options.requestsPerMinute / 60000; // tokens per millisecond
    this.maxTokens = options.burstLimit || options.requestsPerMinute;
  }

  async acquire(): Promise<void> {
    this.refillTokens();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    this.refillTokens();
    this.tokens -= 1;
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

  constructor(options: RequestHandlingOptions = {}) {
    this.rateLimiter = new RateLimiter(options.rateLimit || DEFAULT_RATE_LIMIT_OPTIONS);
    this.retryOptions = options.retry || DEFAULT_RETRY_OPTIONS;
    this.timeout = options.timeout || 30000;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let delay = this.retryOptions.initialDelay;

    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        await this.rateLimiter.acquire();
        
        const result = await Promise.race([
          operation(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new AIRequestError('Request timeout', undefined, true)), this.timeout)
          ),
        ]) as T;

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

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * this.retryOptions.backoffFactor, this.retryOptions.maxDelay);
      }
    }

    throw lastError;
  }
}

export const createRequestHandler = (options?: RequestHandlingOptions) => new RequestHandler(options); 