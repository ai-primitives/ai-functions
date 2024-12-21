import PQueue from 'p-queue'
import { AIRequestError } from '../errors'
import type { Queue } from '../types'

export interface RequestHandlingOptions {
  maxRetries?: number
  retryDelay?: number
  timeout?: number
  concurrency?: number
}

export function createRequestHandler(options: { requestHandling?: RequestHandlingOptions } = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30000,
    concurrency = 1,
  } = options.requestHandling || {}

  const queue = new PQueue({
    concurrency,
    timeout,
    throwOnTimeout: true,
  }) as Queue

  async function executeWithRetry<T>(
    operation: () => Promise<T>,
    attempt = 0,
    lastError?: Error
  ): Promise<T> {
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new AIRequestError(`Request timed out after ${timeout}ms`, undefined, true))
        }, timeout)
      })

      const operationPromise = operation()
      const result = await Promise.race([operationPromise, timeoutPromise])
      return result
    } catch (error) {
      const isRetryable = !(error instanceof AIRequestError) || error.retryable
      
      if (!isRetryable || attempt >= maxRetries - 1) {
        throw new AIRequestError(
          `Failed after ${attempt + 1} attempts: ${lastError?.message || 'Unknown error'}`,
          error,
          false
        )
      }

      const delay = Math.min(retryDelay * Math.pow(2, attempt), 10000)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      return executeWithRetry(operation, attempt + 1, error as Error)
    }
  }

  return {
    add: async <T>(operation: () => Promise<T>): Promise<T> => {
      return queue.add(() => executeWithRetry(operation))
    },
    queue
  }
}

export type RequestHandler = ReturnType<typeof createRequestHandler> 