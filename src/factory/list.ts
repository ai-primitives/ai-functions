import { generateText, streamObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { AIFunctionOptions, BaseTemplateFunction, AsyncIterablePromise } from '../types'

export function createListFunction(defaultOptions: AIFunctionOptions = {}): BaseTemplateFunction {
  let currentPrompt: string | undefined

  const templateFn = async (prompt: string, options: AIFunctionOptions = defaultOptions) => {
    currentPrompt = prompt

    // Generate a list using streamObject with array output
    const { elementStream } = streamObject({
      model: options.model || openai('gpt-4o-mini'),
      output: 'array',
      schema: z.string(),
      prompt: `Generate a list of items based on this prompt: ${prompt}`,
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
    const { elementStream } = streamObject({
      model: defaultOptions.model || openai('gpt-4o-mini'),
      output: 'array',
      schema: z.string(),
      prompt: `Generate a list of items based on this prompt: ${prompt}`,
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

  const baseFn = (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): AsyncIterablePromise<string> => {
    if (!stringsOrOptions) {
      return createAsyncIterablePromise(templateFn('', defaultOptions), '')
    }

    if (Array.isArray(stringsOrOptions)) {
      const strings = stringsOrOptions as TemplateStringsArray
      if (strings.length - 1 !== values.length) {
        throw new Error('Template literal slots must match provided values')
      }

      const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')
      return createAsyncIterablePromise(templateFn(prompt, defaultOptions), prompt)
    }

    return createAsyncIterablePromise(templateFn('', { ...defaultOptions, ...stringsOrOptions }), '')
  }

  // Add support for calling with options after template literal
  const templateLiteralWithOptions = (strings: TemplateStringsArray, ...values: unknown[]) => {
    return (options: AIFunctionOptions = {}) => {
      const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')
      return createAsyncIterablePromise(templateFn(prompt, { ...defaultOptions, ...options }), prompt)
    }
  }

  // Attach the template literal handler
  Object.defineProperty(baseFn, 'call', {
    value: templateLiteralWithOptions
  })

  baseFn.withOptions = (opts: AIFunctionOptions = {}) => {
    const prompt = opts.prompt || currentPrompt || ''
    return createAsyncIterablePromise(templateFn(prompt, { ...defaultOptions, ...opts }), prompt)
  }

  baseFn[Symbol.asyncIterator] = () => asyncIterator(currentPrompt || '')

  return baseFn as BaseTemplateFunction & { call: typeof templateLiteralWithOptions }
} 