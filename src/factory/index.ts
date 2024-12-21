import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible, type OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible'
import { LanguageModelV1 } from '@ai-sdk/provider'
import { z } from 'zod'
import { AIFunction, AIFunctionOptions, BaseTemplateFunction, AsyncIterablePromise } from '../types'

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
        name: 'openai',
      } satisfies OpenAICompatibleProviderSettings)
    : openai
}

export function createAIFunction<T extends z.ZodType>(schema: T) {
  const fn = async (args?: z.infer<T>, options: AIFunctionOptions = {}) => {
    if (!args) {
      return { schema }
    }

    const result = await generateText({
      model: getProvider()('gpt-4') as LanguageModelV1,
      prompt: options.prompt || '',
      maxRetries: 2,
      experimental_output: Output.object({ schema: schema }),
    })

    if (!result.experimental_output) {
      throw new Error('No output received from model')
    }

    return result.experimental_output
  }

  fn.schema = schema
  return fn as AIFunction<T>
}

export function createTemplateFunction(options: AIFunctionOptions = {}): BaseTemplateFunction {
  let currentPrompt: string | undefined
  const provider = getProvider()
  const DEFAULT_MODEL = provider('gpt-4o')

  // Validate output format if provided
  if (options.outputFormat && options.outputFormat !== 'json') {
    throw new Error('Invalid output format. Only JSON is supported')
  }

  const templateFn = async (prompt: string) => {
    currentPrompt = prompt
    const result = await generateText({
      model: options.model || DEFAULT_MODEL,
      prompt,
      ...options,
      ...(options.outputFormat && {
        prompt: `${prompt}\n\nPlease format the response as JSON${options.schema ? ` following this schema:\n${JSON.stringify(options.schema, null, 2)}` : ''}`,
        ...(options.outputFormat === 'json' &&
          options.schema && {
            experimental_output: Output.object({
              schema: options.schema instanceof z.ZodType ? options.schema : z.object(options.schema as z.ZodRawShape),
            }),
          }),
      }),
    })

    if (options.outputFormat === 'json' && result.experimental_output) {
      return JSON.stringify(result.experimental_output)
    }
    return result.text
  }

  templateFn.withOptions = async (opts: AIFunctionOptions = {}) => {
    currentPrompt = opts.prompt || ''
    return templateFn(currentPrompt)
  }

  const asyncIterator = async function* (prompt: string) {
    currentPrompt = prompt
    const result = await generateText({
      model: options.model || DEFAULT_MODEL,
      prompt,
      maxRetries: 2,
      abortSignal: undefined,
      headers: undefined,
      ...options,
      ...(options.outputFormat && {
        prompt: `${prompt}\n\nPlease format the response as JSON${options.schema ? ` following this schema:\n${JSON.stringify(options.schema, null, 2)}` : ''}`,
        ...(options.outputFormat === 'json' &&
          options.schema && {
            experimental_output: Output.object({
              schema: options.schema instanceof z.ZodType ? options.schema : z.object(options.schema as z.ZodRawShape),
            }),
          }),
      }),
    })

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response format')
    }

    if ('experimental_stream' in result) {
      for await (const chunk of result.experimental_stream) {
        if (options.outputFormat === 'json') {
          // For JSON, we accumulate the entire response
          yield chunk
        } else {
          // For text, we split on newlines for list function
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line) yield line
          }
        }
      }
    } else if ('experimental_output' in result && options.outputFormat === 'json') {
      yield JSON.stringify(result.experimental_output)
    } else if ('text' in result) {
      const lines = result.text.split('\n')
      for (const line of lines) {
        if (line) yield line
      }
    } else {
      throw new Error('No text available in response')
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
