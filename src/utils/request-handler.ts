import type { RequestHandlingOptions } from '../types'
import { AIRequestError } from '../types'
import PQueue from 'p-queue'

export class RequestHandler {
  private queue: PQueue | undefined
  private retryOptions: {
    maxRetries: number
    initialDelay: number
    maxDelay: number
    backoffFactor: number
  }

  constructor(options: RequestHandlingOptions = {}) {
    this.retryOptions = {
      maxRetries: options.retry?.maxRetries ?? 2,
      initialDelay: options.retry?.initialDelay ?? 100,
      maxDelay: options.retry?.maxDelay ?? 1000,
      backoffFactor: options.retry?.backoffFactor ?? 2,
    }

    if (options.concurrency) {
      this.queue = new PQueue({ concurrency: options.concurrency })
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    attempt: number = 0,
    lastError?: Error
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      const retryable = !(error instanceof AIRequestError && error.retryable === false)

      if (!retryable || attempt >= this.retryOptions.maxRetries) {
        if (attempt === this.retryOptions.maxRetries) {
          throw new AIRequestError(
            `Failed after ${attempt + 1} attempts: ${lastError?.message || 'Unknown error'}`,
            undefined,
            false
          )
        }
        throw error
      }

      const delay = Math.min(
        this.retryOptions.initialDelay * Math.pow(this.retryOptions.backoffFactor, attempt),
        this.retryOptions.maxDelay
      )

      await new Promise(resolve => setTimeout(resolve, delay))
      return this.executeWithRetry(operation, attempt + 1, error instanceof Error ? error : new Error(String(error)))
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const executeOperation = () => this.executeWithRetry(operation)
    return this.queue ? this.queue.add(executeOperation) : executeOperation()
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