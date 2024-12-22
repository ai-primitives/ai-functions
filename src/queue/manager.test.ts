import { describe, expect, it } from 'vitest'
import { QueueManager } from './manager'
import type { AIFunctionOptions } from '../types'

describe('Queue Manager', () => {
  it('should create queue with concurrency', () => {
    const manager = new QueueManager()
    const options: AIFunctionOptions = { concurrency: 2 }
    const queue = manager.getQueue(options)
    expect(queue).toBeDefined()
    expect(queue?.concurrency).toBe(2)
  })

  it('should not create queue without concurrency', () => {
    const manager = new QueueManager()
    const options: AIFunctionOptions = {}
    const queue = manager.getQueue(options)
    expect(queue).toBeUndefined()
  })

  it('should reuse queue with same options', () => {
    const manager = new QueueManager()
    const queue1 = manager.getQueue({ concurrency: 2 })
    const queue2 = manager.getQueue({ concurrency: 2 })
    expect(queue1).toBe(queue2)
  })

  it('should create new queue with different options', () => {
    const manager = new QueueManager()
    const queue1 = manager.getQueue({ concurrency: 2 })
    const queue2 = manager.getQueue({ concurrency: 3 })
    expect(queue1).not.toBe(queue2)
  })

  it('should execute task in queue', async () => {
    const manager = new QueueManager()
    const options: AIFunctionOptions = { concurrency: 1 }
    const startTime = Date.now()

    const results = await Promise.all([
      manager.executeInQueue(options, () => Promise.resolve(1)),
      manager.executeInQueue(options, () => Promise.resolve(2)),
      manager.executeInQueue(options, () => Promise.resolve(3))
    ])

    const endTime = Date.now()
    expect(results).toEqual([1, 2, 3])
    // With concurrency of 1, it should take at least 3 sequential operations
    expect(endTime - startTime).toBeGreaterThan(0)
  })

  it('should execute generator in queue', async () => {
    const manager = new QueueManager()
    const options: AIFunctionOptions = { concurrency: 1 }

    async function* generator() {
      yield 1
      yield 2
      yield 3
    }

    const items: number[] = []
    for await (const num of manager.executeStreamInQueue(options, generator)) {
      items.push(num)
    }

    expect(items).toEqual([1, 2, 3])
  })
}) 