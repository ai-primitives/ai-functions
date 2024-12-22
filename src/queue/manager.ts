import type { AIFunctionOptions, Queue } from '../types'

export class QueueManager {
  private queue: Queue | undefined
  private queueOptions: AIFunctionOptions | undefined

  private createQueue(options: AIFunctionOptions): Queue {
    return {
      add: async <T>(fn: () => Promise<T> | AsyncGenerator<T>): Promise<T> => {
        const result = await fn()
        if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
          const items: T[] = []
          for await (const item of result as AsyncIterable<T>) {
            items.push(item)
          }
          return items as unknown as T
        }
        return result
      },
      concurrency: options.concurrency
    }
  }

  getQueue(options: AIFunctionOptions): Queue | undefined {
    if (!options.concurrency) {
      return undefined
    }

    // Create a new queue if options have changed
    if (!this.queue || 
        !this.queueOptions?.concurrency || 
        this.queueOptions.concurrency !== options.concurrency) {
      this.queue = this.createQueue(options)
      this.queueOptions = options
    }

    return this.queue
  }

  async executeInQueue<T>(
    options: AIFunctionOptions,
    fn: () => Promise<T>
  ): Promise<T> {
    const queue = this.getQueue(options)
    return queue ? queue.add(fn) : fn()
  }

  async* executeStreamInQueue<T>(
    options: AIFunctionOptions,
    generator: () => AsyncGenerator<T>
  ): AsyncGenerator<T> {
    const queue = this.getQueue(options)
    if (queue) {
      const items = await queue.add(generator) as T[]
      for (const item of items) {
        yield item
      }
    } else {
      yield* generator()
    }
  }
} 