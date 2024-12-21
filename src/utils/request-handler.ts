import type { RequestHandlingOptions } from '../types'
import { AIRequestError } from '../types'
import PQueue from 'p-queue'

export interface RequestHandlingOptions {
  maxRetries?: number
  retryDelay?: number
  timeout?: number
  requestHandling?: {
    maxRetries?: number
    retryDelay?: number
    timeout?: number
  }
}

export class RequestHandler {
  private retryOptions: {
    maxRetries: number
    initialDelay: number
    maxDelay: number
    backoffFactor: number
  }
  private queue: PQueue

  constructor(options: RequestHandlingOptions = {}) {
    this.retryOptions = {
      maxRetries: options.maxRetries ?? 2,
      initialDelay: options.retryDelay ?? 100,
      maxDelay: options.timeout ?? 1000,
      backoffFactor: 2
    }
    this.queue = new PQueue({ concurrency: 1 })
  }

  async executeWithRetry<T>(operation: () => Promise<T>, retryable = true): Promise<T> {
    let lastError: Error | undefined
    let attempt = 0
    const maxAttempts = retryable ? this.retryOptions.maxRetries : 0

    while (attempt <= maxAttempts) {
      try {
        const timeoutPromise = new Promise<T>((_, reject) => {
          setTimeout(() => {
            reject(new AIRequestError(`Request timed out after ${this.retryOptions.maxDelay}ms`))
          }, this.retryOptions.maxDelay)
        })

        const result = await Promise.race([operation(), timeoutPromise])
        return result
      } catch (error) {
        lastError = error as Error
        
        // If error is explicitly marked as non-retryable or we've hit max retries
        if (!retryable || error instanceof AIRequestError && !error.retryable) {
          throw error
        }
        
        if (attempt >= maxAttempts) {
          throw new AIRequestError(
            `Failed after ${attempt + 1} attempts: ${lastError?.message || 'Unknown error'}`,
            undefined,
            false
          )
        }

        const delay = Math.min(
          this.retryOptions.initialDelay * Math.pow(this.retryOptions.backoffFactor, attempt),
          this.retryOptions.maxDelay
        )
        await new Promise(resolve => setTimeout(resolve, delay))
        attempt++
      }
    }

    throw lastError
  }

  async execute<T>(operation: () => Promise<T>, retryable = true): Promise<T> {
    return this.queue.add(() => this.executeWithRetry(operation, retryable))
  }

  get concurrency(): number | undefined {
    return this.queue?.concurrency
  }

  get size(): number {
    return this.queue?.size ?? 0
  }

  get pending(): number {
    return this.queue?.pending ?? 0
  }

  clear(): void {
    this.queue?.clear()
  }

  pause(): void {
    this.queue?.pause()
  }

  resume(): void {
    this.queue?.start()
  }
}

export function createRequestHandler(options: RequestHandlingOptions = {}): RequestHandler {
  return new RequestHandler(options)
} 