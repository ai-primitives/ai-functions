import { generateText, streamObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import PQueue from 'p-queue'
import type { AIFunctionOptions, BaseTemplateFunction, AsyncIterablePromise, Queue, TemplateResult } from '../types'

function createQueue(options: AIFunctionOptions): Queue | undefined {
  if (!options.concurrency) {
    return undefined
  }

  return new PQueue({
    concurrency: options.concurrency,
    autoStart: true,
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
        queueOptions.concurrency !== options.concurrency) {
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
          prompt: prompt ? `Generate a list of items based on this prompt: ${prompt}` : 'Generate a list of items',
          ...modelParams,
        })

        const elements: string[] = []
        for await (const item of elementStream) {
          elements.push(item)
        }

        return elements.join('\n') || 'No items generated'
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error('Failed to generate list')
      }
    }

    const queue = getQueue(options)
    try {
      return queue 
        ? await queue.add(performRequest)
        : await performRequest()
    } catch (error) {
      return 'error occurred'
    }
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

  const createAsyncIterablePromise = <T>(promise: Promise<T>, prompt: string, options: AIFunctionOptions = defaultOptions): TemplateResult => {
    const asyncIterable = {
      [Symbol.asyncIterator]: () => asyncIterator(prompt, options)
    }
    const callablePromise = Object.assign(
      (opts?: AIFunctionOptions) => {
        if (!opts) return promise
        const newPromise = templateFn(prompt, { ...options, ...opts })
        return Object.assign(newPromise, { [Symbol.asyncIterator]: () => asyncIterator(prompt, { ...options, ...opts }) })
      },
      promise
    )
    return Object.assign(callablePromise, asyncIterable) as TemplateResult
  }

  const baseFn = Object.assign(
    (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): TemplateResult => {
      if (!stringsOrOptions) {
        return createAsyncIterablePromise(templateFn('', defaultOptions), '', defaultOptions)
      }

      if (Array.isArray(stringsOrOptions)) {
        const strings = stringsOrOptions as TemplateStringsArray
        if (strings.length - 1 !== values.length) {
          throw new Error('Template literal slots must match provided values')
        }

        const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')
        currentPrompt = prompt
        return createAsyncIterablePromise(templateFn(prompt, defaultOptions), prompt, defaultOptions)
      }

      const options = { ...defaultOptions, ...stringsOrOptions }
      return createAsyncIterablePromise(templateFn('', options), '', options)
    },
    {
      withOptions: (opts: AIFunctionOptions = {}) => {
        const prompt = opts.prompt || currentPrompt || ''
        const options = { ...defaultOptions, ...opts }
        return createAsyncIterablePromise(templateFn(prompt, options), prompt, options) as AsyncIterablePromise<string>
      },
      [Symbol.asyncIterator]: (): AsyncIterator<string> => asyncIterator(currentPrompt || '', defaultOptions)
    }
  ) as BaseTemplateFunction

  return baseFn
} 