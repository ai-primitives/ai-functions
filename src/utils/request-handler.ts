import PQueue from 'p-queue'
import { AIRequestError } from '../errors'
import type { Queue } from '../types'

export interface RetryOptions {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffFactor: number
}

export interface RateLimitOptions {
  requestsPerMinute: number
  burstLimit: number
}

export interface RequestHandlingOptions {
  retry?: RetryOptions
  rateLimit?: RateLimitOptions
  timeout?: number
  concurrency?: number
}

export function createRequestHandler(options: { requestHandling?: RequestHandlingOptions } = {}) {
  const {
    retry = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    },
    timeout = 30000,
    concurrency = 1,
    rateLimit
  } = options.requestHandling || {}

  const queue = new PQueue({
    concurrency,
    timeout,
    throwOnTimeout: true,
    ...(rateLimit && {
      intervalCap: rateLimit.requestsPerMinute,
      interval: 60000,
      carryoverConcurrencyCount: true
    })
  }) as Queue

  async function executeWithRetry<T>(
    operation: () => Promise<T>,
    attempt = 0
  ): Promise<T> {
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new AIRequestError(`Request timed out after ${timeout}ms`, undefined, true))
          }, timeout)
        })
      ])
      return result
    } catch (error) {
      const isRetryable = !(error instanceof AIRequestError) || error.retryable
      
      if (!isRetryable || attempt >= retry.maxRetries) {
        throw new AIRequestError(
          `Failed after ${attempt + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error,
          false
        )
      }

      const delay = Math.min(
        retry.initialDelay * Math.pow(retry.backoffFactor, attempt),
        retry.maxDelay
      )
      await new Promise(resolve => setTimeout(resolve, delay))
      
      return executeWithRetry(operation, attempt + 1)
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