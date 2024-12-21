import { generateText, streamObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import PQueue from 'p-queue'
import type { AIFunctionOptions, BaseTemplateFunction, Queue, TemplateResult } from '../types'

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

  const executeRequest = async (prompt: string, options: AIFunctionOptions): Promise<string> => {
    const modelParams = {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
      seed: options.seed
    }

    const performRequest = async (): Promise<string> => {
      try {
        const model = options.model || openai('gpt-4o-mini')
        const streamOptions = {
          model,
          output: 'array' as const,
          schema: z.string(),
          prompt: `Generate a list of items based on this prompt: ${prompt}`,
          system: options.system,
          ...modelParams
        }

        const { elementStream } = streamObject(streamOptions)
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
    const result = queue 
      ? await queue.add(performRequest)
      : await performRequest()
    
    return result
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
      signal: options.signal
    }

    const performRequest = async function* () {
      try {
        const model = options.model || openai('gpt-4o-mini')
        const streamOptions = {
          model,
          output: 'array' as const,
          schema: z.string(),
          prompt: `Generate a list of items based on this prompt: ${prompt}`,
          system: options.system,
          ...modelParams,
          signal: options.signal,
          onChunk: ({ chunk }: { chunk: { type: string; text?: string } }) => {
            if (chunk.type === 'text-delta' && options.streaming?.onProgress) {
              options.streaming.onProgress(chunk.text || '')
            }
          }
        }

        const { elementStream } = streamObject(streamOptions)

        for await (const item of elementStream) {
          if (options.signal?.aborted) {
            throw new Error('Stream was aborted')
          }
          if (options.streaming?.onProgress) {
            options.streaming.onProgress(item)
          }
          yield item
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError' || (error as any).code === 'ABORT_ERR' || options.signal?.aborted) {
            throw new Error('Stream was aborted')
          } else if (error.name === 'TimeoutError') {
            throw new Error('Stream timed out')
          }
          throw error
        }
        throw new Error('Failed to generate list: Unknown error occurred')
      }
    }

    const queue = getQueue(options)
    if (queue) {
      const generator = await queue.add(performRequest)
      yield* generator
    } else {
      yield* performRequest()
    }
  }

  const templateFn = async (prompt: string, options: AIFunctionOptions = defaultOptions): Promise<string> => {
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

  function createTemplateResult(prompt: string, options: AIFunctionOptions): TemplateResult {
    const promise = templateFn(prompt, options)

    // Create the base result object
    const baseResult = {
      call: (opts?: AIFunctionOptions) => templateFn(prompt, { ...options, ...opts }),
      then: (onfulfilled?: ((value: string) => string | PromiseLike<string>) | null | undefined) =>
        promise.then(onfulfilled),
      catch: (onrejected?: ((reason: any) => string | PromiseLike<string>) | null | undefined) =>
        promise.catch(onrejected),
      finally: (onfinally?: (() => void) | null | undefined) =>
        promise.finally(onfinally)
    }

    // Create a proxy that handles both function calls and async iteration
    const result = new Proxy(
      async function(opts?: AIFunctionOptions) {
        return templateFn(prompt, { ...options, ...opts })
      },
      {
        get(target, prop, receiver) {
          if (prop === Symbol.asyncIterator) {
            return () => executeStreamingRequest(prompt, options)
          }
          return baseResult[prop as keyof typeof baseResult] ?? target[prop as keyof typeof target]
        }
      }
    ) as unknown as TemplateResult

    // Make the result a promise
    Object.setPrototypeOf(result, Promise.prototype)

    return result
  }

  function createBaseFunction(): BaseTemplateFunction {
    const fn = Object.assign(
      function(stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): TemplateResult {
        if (!stringsOrOptions) {
          return createTemplateResult('', defaultOptions)
        }

        if (Array.isArray(stringsOrOptions)) {
          const strings = stringsOrOptions as TemplateStringsArray
          if (strings.length - 1 !== values.length) {
            throw new Error('Template literal slots must match provided values')
          }

          const lastValue = values[values.length - 1]
          const options = typeof lastValue === 'object' && !Array.isArray(lastValue) && lastValue !== null
            ? { ...defaultOptions, ...lastValue as AIFunctionOptions }
            : defaultOptions
          const actualValues = typeof lastValue === 'object' && !Array.isArray(lastValue) && lastValue !== null
            ? values.slice(0, -1)
            : values

          const prompt = strings.reduce((acc, str, i) => acc + str + (actualValues[i] || ''), '')
          currentPrompt = prompt

          return createTemplateResult(prompt, options)
        }

        const options = { ...defaultOptions, ...stringsOrOptions }
        return createTemplateResult('', options)
      },
      {
        withOptions: (opts?: AIFunctionOptions) => {
          const mergedOptions = { ...defaultOptions, ...opts }
          return createTemplateResult(currentPrompt || '', mergedOptions)
        },
        queue: currentQueue
      }
    ) as BaseTemplateFunction

    return fn
  }

  return createBaseFunction()
} 