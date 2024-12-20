import { generateText, streamText, generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible, type OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import type { AIFunctionOptions, BaseTemplateFunction, AIFunction, AsyncIterablePromise } from '../types'

function getProvider() {
  return process.env.AI_GATEWAY
    ? createOpenAICompatible({ baseURL: process.env.AI_GATEWAY, name: 'openai' } satisfies OpenAICompatibleProviderSettings)
    : openai
}

export function createAIFunction<T extends z.ZodType>(schema: T) {
  const fn = async (args?: z.infer<T>, options: AIFunctionOptions = {}) => {
    if (!args) {
      return { schema }
    }

    const { object } = await generateObject({
      model: options.model || getProvider()('gpt-4o'),
      schema,
      prompt: options.prompt || '',
      ...options,
    })

    return object as z.infer<T>
  }

  fn.schema = schema
  return fn as AIFunction<T>
}

export function createTemplateFunction(options: AIFunctionOptions = {}): BaseTemplateFunction {
  let currentPrompt: string | undefined
  const provider = getProvider()
  const DEFAULT_MODEL = provider('gpt-4o')

  const templateFn = async (prompt: string) => {
    currentPrompt = prompt
    const { text } = await generateText({
      model: options.model || DEFAULT_MODEL,
      prompt,
      ...options,
    })
    return text
  }

  templateFn.withOptions = async (opts: AIFunctionOptions = {}) => {
    currentPrompt = opts.prompt || ''
    return templateFn(currentPrompt)
  }

  const asyncIterator = async function* () {
    if (!currentPrompt) {
      currentPrompt = ''
    }

    const { textStream } = await streamText({
      model: options.model || DEFAULT_MODEL,
      prompt: currentPrompt,
      ...options,
    })

    for await (const chunk of textStream) {
      yield chunk
    }
  }

  const createAsyncIterablePromise = <T>(promise: Promise<T>): AsyncIterablePromise<T> => {
    const asyncIterable = {
      [Symbol.asyncIterator]: () => asyncIterator(),
    }
    return Object.assign(promise, asyncIterable) as AsyncIterablePromise<T>
  }

  const baseFn = function (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): AsyncIterablePromise<string> {
    if (!Array.isArray(stringsOrOptions)) {
      const opts = stringsOrOptions as AIFunctionOptions
      currentPrompt = opts.prompt || ''
      return createAsyncIterablePromise(templateFn.withOptions(opts))
    }

    const prompt = String.raw({ raw: stringsOrOptions }, ...values)
    currentPrompt = prompt
    return createAsyncIterablePromise(templateFn(prompt))
  } as BaseTemplateFunction

  Object.defineProperty(baseFn, Symbol.asyncIterator, {
    value: function () {
      return asyncIterator()
    },
    writable: true,
    configurable: true,
  })

  baseFn.withOptions = (opts?: AIFunctionOptions) => {
    return createAsyncIterablePromise(templateFn.withOptions(opts))
  }

  return baseFn
}
