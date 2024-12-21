import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RequestHandler, createRequestHandler } from '../request-handler'
import { AIRequestError } from '../../types'

describe('RequestHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should successfully execute an operation', async () => {
    const handler = createRequestHandler()
    const operation = vi.fn().mockResolvedValue('success')

    const result = await handler.execute(operation)
    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure', async () => {
    const handler = createRequestHandler({
      retry: {
        maxRetries: 2,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2,
      },
    })

    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockRejectedValueOnce(new Error('Another temporary error'))
      .mockResolvedValueOnce('success')

    const result = await handler.execute(operation)
    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should respect rate limits', async () => {
    const handler = createRequestHandler({
      rateLimit: {
        requestsPerMinute: 60,
        burstLimit: 2,
      },
    })

    const operation = vi.fn().mockResolvedValue('success')

    // First two requests should be immediate
    await handler.execute(operation)
    await handler.execute(operation)

    // Third request should be delayed
    const startTime = Date.now()
    const promise = handler.execute(operation)
    
    await vi.advanceTimersByTimeAsync(1000)
    await promise

    const duration = Date.now() - startTime
    expect(duration).toBeGreaterThanOrEqual(1000)
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should handle timeouts', async () => {
    const handler = createRequestHandler({
      timeout: 1000,
    })

    const operation = () => new Promise(resolve => setTimeout(resolve, 2000))

    await expect(handler.execute(operation)).rejects.toThrow(AIRequestError)
  })

  it('should not retry on non-retryable errors', async () => {
    const handler = createRequestHandler()
    const operation = vi.fn().mockRejectedValue(
      new AIRequestError('Non-retryable error', undefined, false)
    )

    await expect(handler.execute(operation)).rejects.toThrow('Non-retryable error')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should respect max retries', async () => {
    const handler = createRequestHandler({
      retry: {
        maxRetries: 2,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2,
      },
    })

    const operation = vi.fn().mockRejectedValue(new Error('Persistent error'))

    await expect(handler.execute(operation)).rejects.toThrow('Failed after 3 attempts')
    expect(operation).toHaveBeenCalledTimes(3)
  })
}) 