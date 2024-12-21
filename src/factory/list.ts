import { generateText, streamObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import PQueue from 'p-queue'
import type { AIFunctionOptions, BaseTemplateFunction, AsyncIterablePromise, Queue } from '../types'

function createQueue(options: AIFunctionOptions): Queue | undefined {
  if (!options.concurrency) {
    return undefined
  }

  return new PQueue({
    concurrency: options.concurrency.concurrency || 1,
    autoStart: true,
    intervalCap: options.concurrency.intervalCap || 1,
    interval: options.concurrency.interval || 0,
    carryoverConcurrencyCount: true,
  }) as Queue
}

export function createListFunction(defaultOptions: AIFunctionOptions = {}): BaseTemplateFunction {
  let currentPrompt: string | undefined
  let currentQueue: Queue | undefined
  let queueOptions: AIFunctionOptions | undefined

  const getQueue = (options: AIFunctionOptions): Queue | undefined => {
    if (!options.concurrency) {
      return undefined
    }

    // Create a new queue if options have changed
    if (!currentQueue || 
        !queueOptions?.concurrency || 
        queueOptions.concurrency.concurrency !== options.concurrency.concurrency) {
      currentQueue = createQueue(options)
      queueOptions = options
    }

    return currentQueue
  }

  const executeRequest = async (prompt: string, options: AIFunctionOptions) => {
    const modelParams = {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
      seed: options.seed,
      system: options.system,
    }

    const performRequest = async () => {
      try {
        const model = options.model || openai('gpt-4o-mini')
        const { elementStream } = streamObject({
          model,
          output: 'array',
          schema: z.string(),
          prompt: `Generate a list of items based on this prompt: ${prompt}`,
          ...modelParams,
        })

        const elements: string[] = []
        for await (const item of elementStream) {
          elements.push(item)
        }

        return elements.join('\n')
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error('Failed to generate list')
      }
    }

    const queue = getQueue(options)
    return queue 
      ? await queue.add(performRequest)
      : await performRequest()
  }

  const executeStreamingRequest = async function* (prompt: string, options: AIFunctionOptions) {
    const modelParams = {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
      seed: options.seed,
      system: options.system,
    }

    const performRequest = async function* () {
      try {
        const model = options.model || openai('gpt-4o-mini')
        const { elementStream } = streamObject({
          model,
          output: 'array',
          schema: z.string(),
          prompt: `Generate a list of items based on this prompt: ${prompt}`,
          ...modelParams,
        })

        for await (const item of elementStream) {
          yield item
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error('Failed to generate list')
      }
    }

    const queue = getQueue(options)
    if (queue) {
      const generator = await queue.add(() => performRequest())
      for await (const item of generator) {
        yield item
      }
    } else {
      for await (const item of performRequest()) {
        yield item
      }
    }
  }

  const templateFn = async (prompt: string, options: AIFunctionOptions = defaultOptions) => {
    currentPrompt = prompt
    const mergedOptions = { ...defaultOptions, ...options }

    try {
      return await executeRequest(prompt, mergedOptions)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to generate list')
    }
  }

  const asyncIterator = async function* (prompt: string, options: AIFunctionOptions = defaultOptions) {
    currentPrompt = prompt
    const mergedOptions = { ...defaultOptions, ...options }

    try {
      for await (const item of executeStreamingRequest(prompt, mergedOptions)) {
        yield item
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to generate list')
    }
  }

  const createAsyncIterablePromise = <T>(promise: Promise<T>, prompt: string, options: AIFunctionOptions = defaultOptions): AsyncIterablePromise<T> => {
    const asyncIterable = {
      [Symbol.asyncIterator]: () => asyncIterator(prompt, options)
    }
    return Object.assign(promise, asyncIterable) as AsyncIterablePromise<T>
  }

  const baseFn = Object.assign(
    (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): AsyncIterablePromise<string> => {
      if (!stringsOrOptions) {
        return createAsyncIterablePromise(templateFn('', defaultOptions), '', defaultOptions)
      }

      if (Array.isArray(stringsOrOptions)) {
        const strings = stringsOrOptions as TemplateStringsArray
        if (strings.length - 1 !== values.length) {
          throw new Error('Template literal slots must match provided values')
        }

        // Handle the case where the last value is an options object
        const lastValue = values[values.length - 1]
        let options = defaultOptions
        let actualValues = values
        let prompt: string

        if (typeof lastValue === 'object' && !Array.isArray(lastValue)) {
          options = { ...defaultOptions, ...lastValue as AIFunctionOptions }
          actualValues = values.slice(0, -1)
        }

        prompt = strings.reduce((acc, str, i) => acc + str + (actualValues[i] || ''), '')
        return createAsyncIterablePromise(templateFn(prompt, options), prompt, options)
      }

      const options = { ...defaultOptions, ...stringsOrOptions }
      return createAsyncIterablePromise(templateFn('', options), '', options)
    },
    {
      withOptions: (opts: AIFunctionOptions = {}) => {
        const prompt = opts.prompt || currentPrompt || ''
        const options = { ...defaultOptions, ...opts }
        return createAsyncIterablePromise(templateFn(prompt, options), prompt, options)
      },
      [Symbol.asyncIterator]: (): AsyncIterator<string> => asyncIterator(currentPrompt || '', defaultOptions)
    }
  ) as BaseTemplateFunction

  return baseFn
} 