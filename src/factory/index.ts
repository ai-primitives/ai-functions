import { generateText, generateObject, Output, type GenerateTextResult, type GenerateObjectResult, type JSONValue, type CoreTool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible, type OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible'
import { LanguageModelV1 } from '@ai-sdk/provider'
import { Response } from 'undici'
import { z } from 'zod'
import { AIFunction, AIFunctionOptions, BaseTemplateFunction, AsyncIterablePromise } from '../types'

// PLACEHOLDER: imports and type definitions

export type GenerateResult = GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>>

export type GenerateJsonResult = GenerateResult & {
  object: JSONValue
  toJsonResponse: () => Response
}

export type StreamingResult = GenerateResult & {
  experimental_stream: AsyncIterable<string>
}

export function isStreamingResult(result: unknown): result is StreamingResult {
  return (
    result !== null &&
    typeof result === 'object' &&
    'experimental_stream' in result &&
    typeof (result as StreamingResult).experimental_stream === 'object' &&
    Symbol.asyncIterator in (result as StreamingResult).experimental_stream
  )
}

export function isJsonResult(result: GenerateResult): result is GenerateJsonResult {
  return 'object' in result && 'toJsonResponse' in result
}

// PLACEHOLDER: response creation functions

export function createAIFunction<T extends z.ZodType>(schema: T) {
  const fn = async (args?: z.infer<T>, options: AIFunctionOptions = {}) => {
    if (!args) {
      return { schema }
    }

    const result = await generateText({
      model: options.model || getProvider()('gpt-4o-mini') as LanguageModelV1,
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

// PLACEHOLDER: createTemplateFunction implementation

function getProvider() {
  const gateway = process.env.AI_GATEWAY
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  return gateway
    ? createOpenAICompatible({
        baseURL: gateway,
        name: 'openai',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      } satisfies OpenAICompatibleProviderSettings)
    : openai
}

export function createJsonResponse(result: GenerateJsonResult): Response {
  return result.toJsonResponse()
}

export function createStreamResponse(result: StreamingResult): Response {
  return new Response(result.experimental_stream as unknown as ReadableStream, {
    headers: { 'Content-Type': 'text/plain' },
  })
}

export function createTextResponse(result: GenerateResult): Response {
  return new Response(result.text, {
    headers: { 'Content-Type': 'text/plain' },
  })
}

export function createTemplateFunction(defaultOptions: AIFunctionOptions = {}): BaseTemplateFunction {
  let currentPrompt: string | undefined

  const templateFn = async (prompt: string, options: AIFunctionOptions = defaultOptions) => {
    currentPrompt = prompt
    
    if (options.outputFormat === 'json') {
      const model = openai('gpt-4o-mini', { structuredOutputs: true })
      if (options.schema) {
        const schema = options.schema instanceof z.ZodType ? options.schema : z.object(options.schema as z.ZodRawShape)
        const result = await generateObject({
          model,
          schema,
          prompt,
        })
        return JSON.stringify(result.object)
      } else {
        const result = await generateObject({
          model,
          output: 'no-schema',
          prompt,
        })
        return JSON.stringify(result.object)
      }
    }

    const result = await generateText({
      model: options.model || openai('gpt-4o-mini'),
      prompt,
      ...options,
    })

    return result.text
  }

  const asyncIterator = async function* (prompt: string) {
    currentPrompt = prompt
    const result = await generateText({
      model: defaultOptions.model || openai('gpt-4o-mini'),
      prompt,
      maxRetries: 2,
      abortSignal: undefined,
      headers: undefined,
      ...defaultOptions,
    })

    if (isStreamingResult(result)) {
      for await (const chunk of result.experimental_stream) {
        yield chunk
      }
    } else {
      yield result.text
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

      const lastValue = values[values.length - 1]
      const options = typeof lastValue === 'object' && !Array.isArray(lastValue) ? lastValue as AIFunctionOptions : defaultOptions
      values = typeof lastValue === 'object' && !Array.isArray(lastValue) ? values.slice(0, -1) : values
      
      const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')
      return createAsyncIterablePromise(templateFn(prompt, { ...defaultOptions, ...options }), prompt)
    }

    return createAsyncIterablePromise(templateFn('', { ...defaultOptions, ...stringsOrOptions }), '')
  }

  baseFn.withOptions = (opts: AIFunctionOptions = {}) => {
    const prompt = opts.prompt || currentPrompt || ''
    return createAsyncIterablePromise(templateFn(prompt, { ...defaultOptions, ...opts }), prompt)
  }

  baseFn[Symbol.asyncIterator] = () => asyncIterator(currentPrompt || '')

  return baseFn
}
