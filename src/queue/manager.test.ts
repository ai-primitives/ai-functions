import { describe, expect, it } from 'vitest'
import { QueueManager, createQueue } from './manager'
import type { AIFunctionOptions } from '../types'

describe('Queue Management', () => {
  describe('createQueue', () => {
    it('should return undefined when concurrency is not set', () => {
      const options: AIFunctionOptions = {}
      const queue = createQueue(options)
      expect(queue).toBeUndefined()
    })

    it('should create queue with specified concurrency', () => {
      const options: AIFunctionOptions = { concurrency: 2 }
      const queue = createQueue(options)
      expect(queue).toBeDefined()
      expect(queue?.concurrency).toBe(2)
    })
  })

  describe('QueueManager', () => {
    it('should manage queue creation and reuse', () => {
      const manager = new QueueManager()
      const options: AIFunctionOptions = { concurrency: 2 }
      
      const queue1 = manager.getQueue(options)
      const queue2 = manager.getQueue(options)
      expect(queue1).toBeDefined()
      expect(queue2).toBe(queue1) // Should reuse the same queue
    })

    it('should create new queue when concurrency changes', () => {
      const manager = new QueueManager()
      const queue1 = manager.getQueue({ concurrency: 2 })
      const queue2 = manager.getQueue({ concurrency: 3 })
      expect(queue1).not.toBe(queue2)
    })

    it('should execute tasks in queue', async () => {
      const manager = new QueueManager()
      const options: AIFunctionOptions = { concurrency: 1 }
      const results: number[] = []

      await Promise.all([
        manager.executeInQueue(options, async () => {
          results.push(1)
          return 1
        }),
        manager.executeInQueue(options, async () => {
          results.push(2)
          return 2
        })
      ])

      expect(results).toEqual([1, 2])
    })

    it('should stream in queue', async () => {
      const manager = new QueueManager()
      const options: AIFunctionOptions = { concurrency: 1 }

      async function* generator() {
        yield 1
        yield 2
        yield 3
      }

      const results: number[] = []
      for await (const num of manager.streamInQueue(options, generator)) {
        results.push(num)
      }

      expect(results).toEqual([1, 2, 3])
    })
  })
}) 