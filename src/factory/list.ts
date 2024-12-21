import { generateText, streamObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { AIFunctionOptions, BaseTemplateFunction, AsyncIterablePromise } from '../types'

export function createListFunction(defaultOptions: AIFunctionOptions = {}): BaseTemplateFunction {
  let currentPrompt: string | undefined

  const templateFn = async (prompt: string, options: AIFunctionOptions = defaultOptions) => {
    currentPrompt = prompt

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

    // Generate a list using streamObject with array output
    const { elementStream } = streamObject({
      model: options.model || openai('gpt-4o-mini'),
      output: 'array',
      schema: z.string(),
      prompt: `Generate a list of items based on this prompt: ${prompt}`,
      ...modelParams,
    })

    // Collect all elements
    const elements: string[] = []
    for await (const item of elementStream) {
      elements.push(item)
    }

    // Join the array with newlines for text output
    return elements.join('\n')
  }

  const asyncIterator = async function* (prompt: string) {
    currentPrompt = prompt
    const modelParams = {
      temperature: defaultOptions.temperature,
      maxTokens: defaultOptions.maxTokens,
      topP: defaultOptions.topP,
      frequencyPenalty: defaultOptions.frequencyPenalty,
      presencePenalty: defaultOptions.presencePenalty,
      stopSequences: defaultOptions.stop ? Array.isArray(defaultOptions.stop) ? defaultOptions.stop : [defaultOptions.stop] : undefined,
      seed: defaultOptions.seed,
      system: defaultOptions.system,
    }

    const { elementStream } = streamObject({
      model: defaultOptions.model || openai('gpt-4o-mini'),
      output: 'array',
      schema: z.string(),
      prompt: `Generate a list of items based on this prompt: ${prompt}`,
      ...modelParams,
    })

    // Yield each item individually for streaming
    for await (const item of elementStream) {
      yield item
    }
  }

  const createAsyncIterablePromise = <T>(promise: Promise<T>, prompt: string): AsyncIterablePromise<T> => {
    const asyncIterable = {
      [Symbol.asyncIterator]: () => asyncIterator(prompt)
    }
    return Object.assign(promise, asyncIterable) as AsyncIterablePromise<T>
  }

  const baseFn = Object.assign(
    (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): AsyncIterablePromise<string> => {
      if (!stringsOrOptions) {
        return createAsyncIterablePromise(templateFn('', defaultOptions), '')
      }

      if (Array.isArray(stringsOrOptions)) {
        const strings = stringsOrOptions as TemplateStringsArray
        if (strings.length - 1 !== values.length) {
          throw new Error('Template literal slots must match provided values')
        }

        const lastValue = values[values.length - 1]
        const options = typeof lastValue === 'object' && !Array.isArray(lastValue) ? lastValue as AIFunctionOptions : defaultOptions
        values = typeof lastValue === 'object' && !Array.isArray(lastValue) ? values.slice(0, -1) : values
        
        const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')
        return createAsyncIterablePromise(templateFn(prompt, { ...defaultOptions, ...options }), prompt)
      }

      return createAsyncIterablePromise(templateFn('', { ...defaultOptions, ...stringsOrOptions }), '')
    },
    {
      withOptions: (opts: AIFunctionOptions = {}) => {
        const prompt = opts.prompt || currentPrompt || ''
        return createAsyncIterablePromise(templateFn(prompt, { ...defaultOptions, ...opts }), prompt)
      },
      [Symbol.asyncIterator]: (): AsyncIterator<string> => asyncIterator(currentPrompt || '')
    }
  ) as BaseTemplateFunction

  return baseFn
} 