import type { RequestHandlingOptions } from '../types'
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

  async executeWithRetry<T>(operation: () => Promise<T> | AsyncGenerator<T>, retryable = true, isStreaming = false): Promise<T> {
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
          const operationResult = operation()
          if (operationResult instanceof Promise) {
            const result = await Promise.race([
              operationResult,
              new Promise<never>((_, reject) => {
                abortController.signal.addEventListener('abort', () => {
                  reject(new AIRequestError(`Request timed out after ${timeoutMs}ms`))
                })
              })
            ])
            clearTimeout(timeoutId)
            return result
          } else {
            const chunks: T[] = []
            for await (const chunk of operationResult) {
              if (abortController.signal.aborted) {
                throw new AIRequestError(`Stream timed out after ${timeoutMs}ms`)
              }
              chunks.push(chunk)
            }
            clearTimeout(timeoutId)
            if (chunks.length === 0) {
              throw new AIRequestError('No chunks received from stream')
            }
            return chunks[chunks.length - 1]
          }
        } finally {
          clearTimeout(timeoutId)
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

  async execute<T>(operation: () => Promise<T> | AsyncGenerator<T>, retryable = true, isStreaming = false): Promise<T> {
    return this.queue.add(() => this.executeWithRetry(operation, retryable, isStreaming))
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