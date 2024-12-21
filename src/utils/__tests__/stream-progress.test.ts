import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StreamProgressTracker } from '../stream-progress'

describe('StreamProgressTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should track basic progress', () => {
    const onProgress = vi.fn()
    const tracker = new StreamProgressTracker({
      onProgress,
      enableTokenCounting: true,
    })

    tracker.onChunk('Hello')
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'chunk',
        chunk: 'Hello',
        tokensGenerated: expect.any(Number),
      }),
    )

    tracker.onComplete()
    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'complete',
        tokensGenerated: expect.any(Number),
        totalTokens: expect.any(Number),
      }),
    )
  })

  it('should estimate time remaining', async () => {
    const onProgress = vi.fn()
    const tracker = new StreamProgressTracker({
      onProgress,
      enableTokenCounting: true,
      estimateTimeRemaining: true,
    })

    // First chunk
    tracker.onChunk('Hello')

    // Advance time and send another chunk
    await vi.advanceTimersByTimeAsync(1000)
    tracker.onChunk('World')

    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'chunk',
        chunk: 'World',
        estimatedTimeRemaining: expect.any(Number),
      }),
    )
  })

  it('should track token-level progress', () => {
    const onProgress = vi.fn()
    const tracker = new StreamProgressTracker({
      onProgress,
      enableTokenCounting: true,
    })

    tracker.onToken('Hello')
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'token',
        chunk: 'Hello',
        tokensGenerated: 1,
      }),
    )
  })

  it('should not include token counts when disabled', () => {
    const onProgress = vi.fn()
    const tracker = new StreamProgressTracker({
      onProgress,
      enableTokenCounting: false,
    })

    tracker.onChunk('Hello')
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'chunk',
        chunk: 'Hello',
      }),
    )
    expect(onProgress).not.toHaveBeenCalledWith(
      expect.objectContaining({
        tokensGenerated: expect.any(Number),
      }),
    )
  })

  it('should not estimate time when disabled', () => {
    const onProgress = vi.fn()
    const tracker = new StreamProgressTracker({
      onProgress,
      enableTokenCounting: true,
      estimateTimeRemaining: false,
    })

    tracker.onChunk('Hello')
    expect(onProgress).not.toHaveBeenCalledWith(
      expect.objectContaining({
        estimatedTimeRemaining: expect.any(Number),
      }),
    )
  })
})
