import { generateText, generateObject, Output, type GenerateTextResult, type GenerateObjectResult, type JSONValue, type CoreTool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible, type OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible'
import { LanguageModelV1 } from '@ai-sdk/provider'
import { Response } from 'undici'
import { z } from 'zod'
import PQueue from 'p-queue'
import { AIFunction, AIFunctionOptions, BaseTemplateFunction, AsyncIterablePromise, Queue } from '../types'
import { createRequestHandler, type RequestHandlingOptions } from '../utils/request-handler';
import { StreamProgressTracker } from '../utils/stream-progress';

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

    const requestHandler = createRequestHandler({ requestHandling: options.requestHandling });

    const result = await requestHandler.execute(async () => {
      return generateText({
        model: options.model || getProvider()('gpt-4o-mini') as LanguageModelV1,
        prompt: options.prompt || '',
        maxRetries: 2,
        experimental_output: Output.object({ schema: schema }),
        system: options.system,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
        seed: options.seed,
      });
    });

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
  let queue: Queue | undefined

  const initQueue = (options: AIFunctionOptions) => {
    if (!queue) {
      queue = new PQueue({ concurrency: options.concurrency || 1 })
    }
    return queue
  }

  const templateFn = async (prompt: string, options: AIFunctionOptions = defaultOptions): Promise<string> => {
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

    const executeRequest = async (): Promise<string> => {
      try {
        if (options.outputFormat === 'json') {
          try {
            const model = openai('gpt-4o-mini', { structuredOutputs: true })
            if (options.schema) {
              const schema = options.schema instanceof z.ZodType 
                ? options.schema 
                : z.object(Object.fromEntries(
                    Object.entries(options.schema as Record<string, string>).map(([key, type]) => [
                      key,
                      type === 'string' ? z.string() :
                      type === 'number' ? z.number() :
                      type === 'boolean' ? z.boolean() :
                      type === 'array' ? z.array(z.unknown()) :
                      type === 'object' ? z.record(z.string(), z.unknown()) :
                      z.unknown()
                    ])
                  ))
              const result = await generateObject({
                model,
                schema,
                prompt,
                ...modelParams,
              })
              return JSON.stringify(result.object)
            } else {
              const result = await generateObject({
                model,
                output: 'no-schema',
                prompt,
                ...modelParams,
              })
              return JSON.stringify(result.object)
            }
          } catch (error) {
            if (error instanceof Error) {
              throw new Error(`Invalid JSON format: ${error.message}`)
            }
            throw new Error('Invalid JSON format')
          }
        }

        const result = (await generateText({
          model: options.model || openai('gpt-4o-mini'),
          prompt,
          ...modelParams,
          ...options,
        })) as GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>>

        if (!result) {
          throw new Error('No result received from model')
        }

        return result.text
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error('Failed to generate text')
      }
    }

    try {
      const currentQueue = initQueue(options)
      if (!currentQueue) {
        return executeRequest()
      }
      return currentQueue.add(executeRequest)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to generate text')
    }
  }

  const asyncIterator = async function* (prompt: string): AsyncGenerator<string> {
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

    const progressTracker = defaultOptions.streaming ? 
      new StreamProgressTracker(defaultOptions.streaming) : undefined;

    const executeRequest = async (): Promise<GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>>> => {
      const result = (await generateText({
        model: defaultOptions.model || openai('gpt-4o-mini'),
        prompt,
        maxRetries: 2,
        abortSignal: undefined,
        headers: undefined,
        ...modelParams,
        ...defaultOptions,
      })) as GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>>

      if (!result) {
        throw new Error('No result received from model')
      }

      return result
    }

    try {
      const currentQueue = initQueue(defaultOptions)
      const result = currentQueue 
        ? await currentQueue.add(executeRequest)
        : await executeRequest()

      if (isStreamingResult(result)) {
        for await (const chunk of result.experimental_stream) {
          if (progressTracker) {
            progressTracker.onChunk(chunk);
          }
          yield chunk
        }
        progressTracker?.onComplete();
      } else if (result) {
        if (progressTracker) {
          progressTracker.onChunk(result.text);
          progressTracker.onComplete();
        }
        yield result.text
      } else {
        const errorMessage = 'Error: No result received';
        progressTracker?.onChunk(errorMessage);
        progressTracker?.onComplete();
        yield errorMessage
      }
    } catch (error) {
      const errorMessage = 'Error: Failed to generate text';
      progressTracker?.onChunk(errorMessage);
      progressTracker?.onComplete();
      console.error('Error in asyncIterator:', error)
      yield errorMessage
    }
  }

  const createAsyncIterablePromise = <T extends string>(promise: Promise<T>, prompt: string): AsyncIterablePromise<T> => {
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
      [Symbol.asyncIterator]: (): AsyncIterator<string> => asyncIterator(currentPrompt || ''),
      get queue() {
        return queue
      }
    }
  ) as BaseTemplateFunction

  return baseFn
}
