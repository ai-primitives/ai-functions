import type { RequestHandlingOptions } from '../types'
export type { RequestHandlingOptions }
import { AIRequestError } from '../types'
import PQueue from 'p-queue'

export class RequestHandler {
  private retryOptions: {
    maxRetries: number
    initialDelay: number
    maxDelay: number
    backoffFactor: number
  }
  private queue: PQueue
  private streamingTimeout: number

  constructor(options: RequestHandlingOptions = {}) {
    this.retryOptions = {
      maxRetries: options.maxRetries ?? 2,
      initialDelay: options.retryDelay ?? 100,
      maxDelay: options.timeout ?? 1000,
      backoffFactor: 2
    }
    this.queue = new PQueue({ concurrency: 1 })
    this.streamingTimeout = options.streamingTimeout ?? 30000
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryable: boolean = true,
    isStreaming: boolean = false
  ): Promise<T> {
    let lastError: Error | undefined
    let attempt = 0
    const maxAttempts = retryable ? this.retryOptions.maxRetries : 0
    const timeoutMs = isStreaming ? this.streamingTimeout : this.retryOptions.maxDelay

    while (attempt <= maxAttempts) {
      try {
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => {
          abortController.abort()
        }, timeoutMs)

        try {
          const result = await operation()
          clearTimeout(timeoutId)
          return result
        } catch (error) {
          lastError = error as Error
          
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
      } catch (error) {
        lastError = error as Error
        
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

    throw lastError || new AIRequestError('Operation failed with no error details')
  }

  add<T>(operation: () => Promise<T>, retryable: boolean = true, isStreaming: boolean = false): Promise<T> {
    return this.queue.add(async () => {
      const result = await this.executeWithRetry(operation, retryable, isStreaming)
      if (result === undefined) {
        throw new Error('Operation returned undefined')
      }
      return result
    }) as Promise<T>
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