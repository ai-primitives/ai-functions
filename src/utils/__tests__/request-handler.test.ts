import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestHandler, createRequestHandler } from '../request-handler'
import { AIRequestError } from '../../types'

describe('RequestHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should successfully execute an operation', async () => {
    const handler = createRequestHandler()
    const operation = vi.fn().mockResolvedValue('success')

    const promise = handler.execute(operation)
    await vi.runAllTimersAsync()
    const result = await promise
    
    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure', async () => {
    const handler = createRequestHandler({
      requestHandling: {
        retry: {
          maxRetries: 2,
          initialDelay: 100,
          maxDelay: 1000,
          backoffFactor: 2,
        }
      }
    })

    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockRejectedValueOnce(new Error('Another temporary error'))
      .mockResolvedValueOnce('success')

    const promise = handler.execute(operation)
    
    // Advance time for first retry
    await vi.advanceTimersByTimeAsync(100)
    // Advance time for second retry
    await vi.advanceTimersByTimeAsync(200)
    // Advance remaining timers
    await vi.runAllTimersAsync()
    
    const result = await promise
    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should respect rate limits', async () => {
    const handler = createRequestHandler({
      requestHandling: {
        rateLimit: {
          requestsPerMinute: 60,
          burstLimit: 2,
        }
      }
    })

    const operation = vi.fn().mockResolvedValue('success')

    // First two requests should be immediate
    const promise1 = handler.execute(operation)
    const promise2 = handler.execute(operation)
    await vi.runAllTimersAsync()
    await Promise.all([promise1, promise2])

    // Third request should be delayed
    const startTime = Date.now()
    const promise3 = handler.execute(operation)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.runAllTimersAsync()
    await promise3

    const duration = Date.now() - startTime
    expect(duration).toBeGreaterThanOrEqual(1000)
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should handle timeouts', async () => {
    const timeout = 1000;
    const handler = createRequestHandler({
      requestHandling: {
        timeout,
        retry: {
          maxRetries: 0,
          initialDelay: 100,
          maxDelay: 1000,
          backoffFactor: 2
        }
      }
    })

    const operation = vi.fn(() => new Promise(resolve => {
      setTimeout(resolve, 2000, 'delayed result')
    }))

    const promise = handler.execute(operation)
    await vi.advanceTimersByTimeAsync(timeout)
    await vi.runAllTimersAsync()
    
    await expect(promise).rejects.toThrow(`Request timed out after ${timeout}ms`)
  })

  it('should not retry on non-retryable errors', async () => {
    const handler = createRequestHandler()
    const operation = vi.fn().mockRejectedValue(
      new AIRequestError('Non-retryable error', undefined, false)
    )

    const promise = handler.execute(operation)
    await vi.runAllTimersAsync()
    
    await expect(promise).rejects.toThrow('Non-retryable error')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should respect max retries', async () => {
    const handler = createRequestHandler({
      requestHandling: {
        retry: {
          maxRetries: 2,
          initialDelay: 100,
          maxDelay: 1000,
          backoffFactor: 2,
        }
      }
    })

    const operation = vi.fn().mockRejectedValue(new Error('Persistent error'))
    const promise = handler.execute(operation)
    
    // Advance time for all retries
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(200)
    await vi.advanceTimersByTimeAsync(400)
    await vi.runAllTimersAsync()
    
    await expect(promise).rejects.toThrow('Failed after 3 attempts')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should handle concurrent requests with queue', async () => {
    const handler = createRequestHandler({
      requestHandling: { concurrency: 2 }
    })

    const operation = vi.fn().mockResolvedValue('success')
    const tasks = Array(5).fill(null).map(() => handler.execute(operation))
    
    await vi.runAllTimersAsync()
    const results = await Promise.all(tasks)
    
    expect(results).toHaveLength(5)
    results.forEach(result => expect(result).toBe('success'))
    expect(operation).toHaveBeenCalledTimes(5)
  })
})    