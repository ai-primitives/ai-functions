import { LanguageModelV1, generateText, generateObject, type GenerateTextResult, type CoreTool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible, type OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import type { AIFunctionOptions, BaseTemplateFunction, AIFunction, AsyncIterablePromise } from '../types'

function getProvider() {
  const gateway = process.env.AI_GATEWAY
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  // Use gateway if configured, otherwise use default OpenAI provider
  return gateway
    ? createOpenAICompatible({
        baseURL: gateway,
        name: 'openai'
      } satisfies OpenAICompatibleProviderSettings)
    : openai
}

export function createAIFunction<T extends z.ZodType>(schema: T) {
  const fn = async (args?: z.infer<T>, options: AIFunctionOptions = {}) => {
    if (!args) {
      return { schema }
    }

    const { object } = await generateObject<z.infer<T>>({
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

  // Validate output format if provided
  if (options.outputFormat && !['json', 'xml', 'csv'].includes(options.outputFormat)) {
    throw new Error('Invalid output format. Supported formats are: json, xml, csv')
  }

  const templateFn = async (prompt: string) => {
    currentPrompt = prompt
    const { text } = await generateText({
      model: options.model || DEFAULT_MODEL,
      prompt,
      ...options,
      ...(options.outputFormat && {
        prompt: `${prompt}\n\nPlease format the response as ${options.outputFormat.toUpperCase()}${
          options.schema ? ` following this schema:\n${JSON.stringify(options.schema, null, 2)}` :
          options.outputFormat === 'csv' ? ' with headers' :
          options.outputFormat === 'xml' ? ' with a root element' : ''
        }`,
      }),
    })
    return text
  }

  templateFn.withOptions = async (opts: AIFunctionOptions = {}) => {
    currentPrompt = opts.prompt || ''
    return templateFn(currentPrompt)
  }

  const asyncIterator = async function* (prompt: string) {
    currentPrompt = prompt
    const result = await generateText<Record<string, CoreTool<any, any>>, { experimental_stream: AsyncIterable<string> }>({
      model: options.model || DEFAULT_MODEL,
      prompt,
      ...options,
      ...(options.outputFormat && {
        prompt: `${prompt}\n\nPlease format the response as ${options.outputFormat.toUpperCase()}${
          options.schema ? ` following this schema:\n${JSON.stringify(options.schema, null, 2)}` :
          options.outputFormat === 'csv' ? ' with headers' :
          options.outputFormat === 'xml' ? ' with a root element' : ''
        }`,
      }),
    })

    if ('experimental_stream' in result) {
      const stream = result.experimental_stream as AsyncIterable<string>
      for await (const chunk of stream) {
        yield chunk
      }
    } else {
      yield result.text
    }
  }

  const createAsyncIterablePromise = <T>(promise: Promise<T>): AsyncIterablePromise<T> => {
    const asyncIterable = {
      [Symbol.asyncIterator]: () => asyncIterator(currentPrompt || ''),
    }
    return Object.assign(promise, asyncIterable) as AsyncIterablePromise<T>
  }

  const baseFn = function (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): AsyncIterablePromise<string> {
    // Add validation for required arguments
    if (!stringsOrOptions) {
      throw new Error('Template strings or options are required')
    }

    if (!Array.isArray(stringsOrOptions)) {
      const opts = stringsOrOptions as AIFunctionOptions
      if (typeof opts !== 'object' || opts === null) {
        throw new Error('Options must be an object')
      }
      currentPrompt = opts.prompt || ''
      return createAsyncIterablePromise(templateFn.withOptions(opts))
    }

    // Validate values match template slots
    if (stringsOrOptions.length - 1 !== values.length) {
      throw new Error('Template literal slots must match provided values')
    }

    const prompt = String.raw({ raw: stringsOrOptions }, ...values)
    currentPrompt = prompt
    return createAsyncIterablePromise(templateFn(prompt))
  } as BaseTemplateFunction

  Object.defineProperty(baseFn, Symbol.asyncIterator, {
    value: function () {
      return asyncIterator(currentPrompt || '')
    },
    writable: true,
    configurable: true,
  })

  baseFn.withOptions = (opts?: AIFunctionOptions) => {
    return createAsyncIterablePromise(templateFn.withOptions(opts))
  }

  return baseFn
}
