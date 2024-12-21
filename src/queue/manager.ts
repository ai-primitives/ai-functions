import PQueue from 'p-queue'
import type { AIFunctionOptions, Queue } from '../types'

export function createQueue(options: AIFunctionOptions): Queue | undefined {
  if (!options.concurrency) {
    return undefined
  }

  return new PQueue({
    concurrency: options.concurrency,
    autoStart: true,
    carryoverConcurrencyCount: true,
  }) as Queue
}

export class QueueManager {
  private currentQueue?: Queue
  private queueOptions?: AIFunctionOptions

  getQueue(options: AIFunctionOptions): Queue | undefined {
    if (!options.concurrency) {
      return undefined
    }

    // Create a new queue if options have changed
    if (!this.currentQueue || 
        !this.queueOptions?.concurrency || 
        this.queueOptions.concurrency !== options.concurrency) {
      this.currentQueue = createQueue(options)
      this.queueOptions = options
    }

    return this.currentQueue
  }

  async executeInQueue<T>(
    options: AIFunctionOptions,
    task: () => Promise<T>
  ): Promise<T> {
    const queue = this.getQueue(options)
    return queue ? queue.add(task) : task()
  }

  async *streamInQueue<T>(
    options: AIFunctionOptions,
    generator: () => AsyncGenerator<T>
  ): AsyncGenerator<T> {
    const queue = this.getQueue(options)
    if (queue) {
      const gen = await queue.add(generator)
      yield* gen
    } else {
      yield* generator()
    }
  }
} 